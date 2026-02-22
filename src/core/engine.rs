use tokio::{sync::mpsc, time::sleep};
use std::{collections::{HashMap, VecDeque}, sync::Mutex, time::{Instant, Duration}};

use crate::{utils::schemas::{Currency, League, PlayerId, Room, RoomId, QueueKey, QueueCommand, RoomManagerCommand, RoomKind, WSEvent, RoomMeta, PlayerPosition, GameState, Suit, RoomActorCommand}, core::context::get_global_context};
use tracing::info;
use uuid::Uuid;
use bimap::BiMap;

fn try_match(
    queues: &mut HashMap<QueueKey, VecDeque<PlayerId>>,
    room_tx: &mpsc::UnboundedSender<RoomManagerCommand>,
) {
    for (key, queue) in queues.iter_mut() {
        while queue.len() >= 4 {
            let players: Vec<PlayerId> =
                (0..4).map(|_| queue.pop_front().unwrap()).collect();

            let _ = room_tx.send(RoomManagerCommand::CreateRoom {
                key: key.clone(),
                players,
                password_hash: None,
                kind: RoomKind::Queue
            });
        }
    }
}

pub fn start_room_manager() -> mpsc::UnboundedSender<RoomManagerCommand>{
    info!("Start room manager");
    let (tx, mut rx) = mpsc::unbounded_channel();
    let manager_tx = tx.clone();

    tokio::spawn(async move {
        sleep(Duration::from_secs(2)).await; // NOTE for app_ctx init
        let app_ctx = get_global_context();
        let mut rooms: HashMap<RoomId, Room> = HashMap::new();
        let mut room_subscribers: Vec<PlayerId> = Vec::new();

        while let Some(cmd) = rx.recv().await {
            info!("cmd before: {:?}", cmd);
            info!("rooms before: {:?}", rooms);
            info!("subs before : {:?}", room_subscribers);
            match cmd {
                RoomManagerCommand::CreateRoom { key, players, password_hash, kind } => {
                    let room_id = Uuid::new_v4().to_string();
                    let room_meta = RoomMeta{
                        id: room_id.clone(),
                        name: room_id.clone(),
                        key,
                        players: players.clone(),
                        kind
                    };
                    let room = rooms.entry(room_id.clone())
                         .or_insert(
                             Room{
                                 actor: None,
                                 meta: room_meta.clone(),
                                 password_hash,
                                 created_at: Instant::now()
                             }
                       );
                    app_ctx.connection_pool().broadcast(
                        &room_subscribers,
                        WSEvent::RoomCreated { room: room_meta }
                    );
                    if players.len().eq(&4){
                        let room_actor = start_room_actor(
                            room_id,
                            players,
                            manager_tx.clone()
                        );
                        room.actor = Some(room_actor);
                    }
                }
                RoomManagerCommand::LeaveAllRoom { player } => {
                    let mut empty_room_ids: Vec<RoomId> = Vec::new();

                    for (room_id, room) in rooms.iter_mut() {
                        let was_in_room = room.meta.players.contains(&player);

                        if !was_in_room {
                            continue;
                        }

                        room.meta.players.retain(|p| p != &player);

                        if room.meta.players.is_empty() {
                            empty_room_ids.push(room_id.clone());
                        } else {
                            app_ctx.connection_pool().broadcast(
                                &room_subscribers,
                                WSEvent::RoomUpdated {
                                    room: room.meta.clone(),
                                },
                            );
                        }
                    }

                    for room_id in empty_room_ids {
                        rooms.remove(&room_id);

                        app_ctx.connection_pool().broadcast(
                            &room_subscribers,
                            WSEvent::RoomRemoved { room_id },
                        );
                    }
                }
                RoomManagerCommand::JoinRoom { player, room_id } => {
                    if let Some(room) = rooms.get_mut(&room_id) {
                        if room.meta.players.len() < 4 {
                            if room.meta.players.contains(&player.clone()){
                                continue;
                            }else{
                                room.meta.players.push(player.clone());
                            }

                            app_ctx.connection_pool().broadcast(
                                &room_subscribers,
                                WSEvent::RoomUpdated {
                                    room: room.meta.clone(),
                                },
                            );

                            if room.meta.players.len() == 4 {
                                let room_actor = start_room_actor(
                                    room_id.clone(),
                                    room.meta.players.clone(),
                                    manager_tx.clone(),
                                );
                                room.actor = Some(room_actor)
                            }
                        }
                    }
                }
                RoomManagerCommand::LeaveRoom { player, room_id } => {
                    if let Some(room) = rooms.get_mut(&room_id) {
                        room.meta.players.retain(|p| p != &player);

                        if room.meta.players.is_empty() {
                            rooms.remove(&room_id);

                            app_ctx.connection_pool().broadcast(
                                &room_subscribers,
                                WSEvent::RoomRemoved { room_id },
                            );
                        } else {
                            app_ctx.connection_pool().broadcast(
                                &room_subscribers,
                                WSEvent::RoomUpdated {
                                    room: room.meta.clone(),
                                },
                            );
                        }
                    }
                }
                RoomManagerCommand::SubscribeRooms{ player } => {
                    if !room_subscribers.contains(&player) {
                        room_subscribers.push(player.clone());
                    }
                   let snapshot: Vec<RoomMeta> = rooms
                       .values()
                       .filter(|room| room.meta.players.len() < 4)
                       .map(|room| room.meta.clone())
                       .collect();

                   app_ctx.connection_pool().send_to(&player, WSEvent::RoomsSnapshot { items: snapshot })
               }
               RoomManagerCommand::UnsubscribeRooms { player } => {
                   room_subscribers.retain(|p| p != &player);
               }
               RoomManagerCommand::FinishRoom { room_id } => {
                   rooms.remove(&room_id);
                    app_ctx.connection_pool().broadcast(
                        &room_subscribers,
                        WSEvent::RoomRemoved { room_id },
                    );
               }
               RoomManagerCommand::PlayCard { player, room_id, card } => {
                    let room = rooms.get(&room_id).unwrap(); // NOTE handle unwrap
                    let _ = room.actor.clone().unwrap().send(
                        RoomActorCommand::PlayCard { player: player.clone(), card }
                    );

               }
                RoomManagerCommand::PlayerDisconnected { player, room_id } => {
                    if let Some(room) = rooms.get(&room_id) {
                        if let Some(actor) = &room.actor {
                            let _ = actor.send(
                                RoomActorCommand::PlayerDisconnected { player }
                            );
                        }
                    }
                }
           }

        info!("rooms after: {:?}", rooms);
        info!("subs  after: {:?}", room_subscribers);
        }
    });
    tx
}

fn start_room_actor(
    room_id: RoomId,
    players: Vec<PlayerId>,
    room_manager_tx: mpsc::UnboundedSender<RoomManagerCommand>,
) -> mpsc::UnboundedSender<RoomActorCommand> {
    let (tx, mut rx) = mpsc::unbounded_channel();

    tokio::spawn(async move {
        // let mut subs: Vec<mpsc::UnboundedSender<WSEvent>> = Vec::new();
        let app_ctx = get_global_context();
        let mut player_positions: BiMap<PlayerId, PlayerPosition> = BiMap::new();
        let mut state = GameState::new(Suit::Clubs);


        for (i, pos) in [PlayerPosition::North, PlayerPosition::East, PlayerPosition::South, PlayerPosition::West].iter().enumerate() {
            let player = players.get(i).unwrap().to_string();  // NOTE unwrap_or
            app_ctx.connection_pool()
                   .get(&player.clone())
                   .unwrap()
                   .mark_as_in_game(room_id.clone(), *pos);

            player_positions.insert(player.clone(), *pos);
            app_ctx.connection_pool().send_to(
                &player,
                WSEvent::GameStart { room_id: room_id.clone(), position: *pos }
            );
            app_ctx.connection_pool().send_to(
                &player,
                WSEvent::YourHand{cards: state.hands.get(pos).unwrap().to_vec()}
            );
            if state.current_turn == *pos {
                app_ctx.connection_pool().send_to(
                    &player,
                    WSEvent::YourTurn
                )
            }
        }


        while let Some(cmd) = rx.recv().await {
            match cmd {
                RoomActorCommand::PlayCard { player, card } => {
                    let player_position = player_positions.get_by_left(&player.clone()).unwrap();
                    match state.play_card(*player_position, card){
                        Ok(_) => {
                            app_ctx.connection_pool().broadcast(
                                players.clone(),
                                WSEvent::CardPlayed{position: *player_position, card}
                            );
                            if let Some(winner) = state.resolve_trick() {
                                app_ctx.connection_pool().broadcast(
                                    &players.clone(),
                                    WSEvent::TrickWon{position: winner}
                                );
                                if state.hands.values().all(|h| h.is_empty()) {
                                    let _ = state.update_eye_after_round();
                                    let eye = state.team_eye.clone();
                                    state.update_round_trump();
                                    state.update_round_attacking_team();
                                    let _ = state.update_hands(); //

                                    app_ctx.connection_pool().broadcast(
                                        players.clone(),
                                        WSEvent::EyeUpdated {
                                            team_a: eye.get(&1).copied().unwrap_or(0),
                                            team_b: eye.get(&2).copied().unwrap_or(0),
                                        }
                                    );

                                    app_ctx.connection_pool().broadcast(
                                        players.clone(),
                                        WSEvent::TrumpUpdated { trump: state.trump.clone() }
                                    );


                                    for player in &players.clone() {
                                        if let Some(pos) = player_positions.get_by_left(player) {
                                            if let Some(hand) = state.hands.get(pos) {
                                                let _ = app_ctx.connection_pool().send_to(
                                                    &player.clone(),
                                                    WSEvent::YourHand { cards: hand.clone() }
                                                );
                                                if state.current_turn == *pos {
                                                    let _ = app_ctx.connection_pool().send_to(
                                                        &player.clone(),
                                                        WSEvent::YourTurn
                                                    );
                                                }
                                            }
                                        }
                                    }


                                    if eye.get(&1).copied().unwrap_or(0) >= 12 || eye.get(&2).copied().unwrap_or(0) >= 12 {
                                        app_ctx.connection_pool().broadcast(
                                            players.clone(),
                                            WSEvent::GameOver {
                                                scores: state.team_eye.clone()
                                            }
                                        );
                                        break;
                                    }
                                } else {
                                    let player = player_positions.get_by_right(&winner).unwrap();
                                    app_ctx.connection_pool().send_to(
                                        &player.clone(),
                                        WSEvent::YourTurn
                                    );
                                }

                            }else{
                                let player = player_positions.get_by_right(&state.current_turn).unwrap();
                                app_ctx.connection_pool().send_to(
                                    &player.clone(),
                                    WSEvent::YourTurn
                                );
                            }
                        }
                        Err(e) => {
                            app_ctx.connection_pool().send_to(
                                &player.clone(),
                                WSEvent::Error { detail: e.to_string() }
                            )
                        }
                    }
                }
                RoomActorCommand::PlayerDisconnected { player } => {
                    app_ctx.connection_pool().broadcast(
                        &players,
                        WSEvent::GameClose {
                            reason: format!("Player {} disconnected", player),
                        },
                    );
                    break;
                }

            };
        }

        let _ = room_manager_tx.send(
            RoomManagerCommand::FinishRoom { room_id }
        );
    });
    tx
}

pub fn start_queue_manager(
    room_tx: mpsc::UnboundedSender<RoomManagerCommand>,
) -> mpsc::UnboundedSender<QueueCommand> {
    info!("Start queue manager");
    let (tx, mut rx) = mpsc::unbounded_channel();

    tokio::spawn(async move {
        let mut queues: HashMap<QueueKey, VecDeque<PlayerId>> = HashMap::new();

        while let Some(cmd) = rx.recv().await {
            match cmd {
                QueueCommand::Enqueue { player, key } => {
                    queues.entry(key).or_default().push_back(player);
                    try_match(&mut queues, &room_tx);
                }

                QueueCommand::Dequeue { player, key } => {
                    if let Some(q) = queues.get_mut(&key) {
                        q.retain(|p| p != &player);
                        if q.is_empty() {
                            queues.remove(&key);
                        }
                    }
                }

                QueueCommand::Disconnect { player } => {
                    for q in queues.values_mut() {
                        q.retain(|p| p != &player);
                    }
                }
            }
        }
    });

    tx
}
