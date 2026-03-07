use tokio::{sync::mpsc, time::sleep};
use url::quirks::username;
use std::{collections::{HashMap, VecDeque}, sync::{Mutex, Arc}, time::{Instant, Duration}};

use crate::{utils::schemas::{Currency, League, PlayerId, Room, RoomId, QueueKey, QueueCommand, RoomManagerCommand, RoomKind, WSEvent, RoomMeta, PlayerPosition, GameState, Suit, RoomActorCommand, PlayerMeta, Team, GameSnapshot, PlayerInfo, Card}, core::{context::get_global_context, pool::PlayerSession}};
use tracing::info;
use uuid::Uuid;
use bimap::BiMap;

use super::pool::PlayerStatus;

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
            info!("subs before : {:?}", room_subscribers.clone());
            match cmd {
                RoomManagerCommand::CreateRoom { key, players, password_hash, kind } => {
                    let room_id = Uuid::new_v4().to_string();
                    let players_meta: Vec<PlayerMeta> = players
                        .iter()
                        .filter_map(|id| app_ctx.connection_pool().get(id))
                        .map(|session| session.player_meta.clone())
                        .collect();
                    let room_meta = RoomMeta{
                        id: room_id.clone(),
                        name: room_id.clone(),
                        key,
                        players: players_meta.clone(),
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
                        room_subscribers.clone(),
                        WSEvent::RoomCreated { room: room_meta }
                    ).await;
                    if players.len().eq(&4){
                        let room_actor = start_room_actor(
                            room_id,
                            players_meta,
                            manager_tx.clone()
                        );
                        room.actor = Some(room_actor);
                    }
                }
                RoomManagerCommand::LeaveAllRoom { player } => {
                    let mut empty_room_ids: Vec<RoomId> = Vec::new();

                    for (room_id, room) in rooms.iter_mut() {
                        let was_in_room = room.meta.players.iter().any(|p| p.id == player);

                        if !was_in_room {
                            continue;
                        }

                        room.meta.players.retain(|p| p.id != player);

                        if room.meta.players.is_empty() {
                            empty_room_ids.push(room_id.clone());
                        } else {
                            app_ctx.connection_pool().broadcast(
                                room_subscribers.clone(),
                                WSEvent::RoomUpdated {
                                    room: room.meta.clone(),
                                },
                            ).await;
                        }
                    }

                    for room_id in empty_room_ids {
                        rooms.remove(&room_id);

                        app_ctx.connection_pool().broadcast(
                            room_subscribers.clone(),
                            WSEvent::RoomRemoved { room_id },
                        ).await;
                    }
                }
                RoomManagerCommand::JoinRoom { player, room_id } => {
                    if let Some(room) = rooms.get_mut(&room_id) {
                        if room.meta.players.len() < 4 {
                            if room.meta.players.iter().any(|p| p.id == player){
                                continue;
                            }else{
                                let player_meta = app_ctx.connection_pool().get(&player).unwrap().player_meta.clone();
                                room.meta.players.push(player_meta);
                            }

                            app_ctx.connection_pool().broadcast(
                                room_subscribers.clone(),
                                WSEvent::RoomUpdated {
                                    room: room.meta.clone(),
                                },
                            ).await;

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
                        room.meta.players.retain(|p| p.id != player);

                        if room.meta.players.is_empty() {
                            rooms.remove(&room_id);

                            app_ctx.connection_pool().broadcast(
                                room_subscribers.clone(),
                                WSEvent::RoomRemoved { room_id },
                            ).await;
                        } else {
                            app_ctx.connection_pool().broadcast(
                                room_subscribers.clone(),
                                WSEvent::RoomUpdated {
                                    room: room.meta.clone(),
                                },
                            ).await;
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

                   app_ctx.connection_pool().send_to(&player, WSEvent::RoomsSnapshot { items: snapshot }).await
               }
               RoomManagerCommand::UnsubscribeRooms { player } => {
                   room_subscribers.retain(|p| p != &player);
               }
               RoomManagerCommand::FinishRoom { room_id } => {
                    let sessions: Vec<Arc<PlayerSession>> = rooms
                        .get(&room_id)
                        .map(|room| {
                            room.meta.players
                                .iter()
                                .filter_map(|p| app_ctx.connection_pool().get(&p.id))
                                .collect()
                        })
                        .unwrap_or_default();

                    for session in sessions {
                        session.mark_back_to_connected().await;
                    }

                    if rooms.remove(&room_id).is_some() {
                        app_ctx.connection_pool().broadcast(
                            room_subscribers.clone(),
                            WSEvent::RoomRemoved { room_id },
                        ).await;
                    }
               }

                RoomManagerCommand::PlayCard { player, room_id, card } => {
                    let Some(room) = rooms.get(&room_id) else {
                        app_ctx.connection_pool().send_to(
                            &player,
                            WSEvent::Error {
                                detail: "Комната не найдена".to_string(),
                            },
                        ).await;
                        continue;
                    };

                    let Some(actor) = room.actor.clone() else {
                        app_ctx.connection_pool().send_to(
                            &player,
                            WSEvent::Error {
                                detail: "Игра в комнате ещё не началась".to_string(),
                            },
                        ).await;
                        continue;
                    };

                    let _ = actor.send(RoomActorCommand::PlayCard { player, card });
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
                RoomManagerCommand::PlayerTemporaryDisconnect { player, room_id } => {
                    if let Some(room) = rooms.get(&room_id) {
                        if let Some(actor) = &room.actor {
                            let _ = actor.send(
                                RoomActorCommand::PlayerTemporaryDisconnect { player  }
                            );
                        }
                    }
                }
                RoomManagerCommand::PlayerReconnect { player, room_id } => {
                    if let Some(room) = rooms.get(&room_id) {
                        if let Some(actor) = &room.actor {
                            let _ = actor.send(
                                RoomActorCommand::PlayerReconnect { player }
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
    players: Vec<PlayerMeta>,
    room_manager_tx: mpsc::UnboundedSender<RoomManagerCommand>,
) -> mpsc::UnboundedSender<RoomActorCommand> {
    fn build_snapshot(
        room_id: &RoomId,
        state: &GameState,
        players: &Vec<PlayerMeta>,
        player_positions: &BiMap<PlayerId, PlayerPosition>,
    ) -> GameSnapshot {

        let players_info = players.iter().map(|meta| {
            let pos = *player_positions.get_by_left(&meta.id).unwrap();
            PlayerInfo {
                meta: meta.clone(),
                position: pos,
                team: pos.team(),
            }
        }).collect();

        GameSnapshot {
            room_id: room_id.clone(),
            players: players_info,
            trump: state.trump,
            eyes: state.team_eye.clone(),
            scores: state.team_scores.clone(),
            current_turn: state.current_turn,
            current_trick: state.current_trick.clone(),
            last_trick: state.last_trick.clone()
        }
    }

    let (tx, mut rx) = mpsc::unbounded_channel();
    let player_ids: Vec<PlayerId> = players.iter().map(|meta| meta.id).collect();

    tokio::spawn(async move {
        // let mut subs: Vec<mpsc::UnboundedSender<WSEvent>> = Vec::new();
        let app_ctx = get_global_context();
        let mut player_positions: BiMap<PlayerId, PlayerPosition> = BiMap::new();
        let mut state = GameState::new();
        let mut disconnected: HashMap<PlayerId, Instant> = HashMap::new();


        for (i, pos) in [PlayerPosition::North, PlayerPosition::East, PlayerPosition::South, PlayerPosition::West].iter().enumerate() {
            let player = players.get(i).unwrap();  // NOTE unwrap_or
            app_ctx.connection_pool()
                   .get(&player.id)
                   .unwrap()
                   .mark_as_in_game(room_id.clone(), *pos).await;

            player_positions.insert(player.id, *pos);
            app_ctx.connection_pool().send_to(
                &player.id,
                WSEvent::YourHand{cards: state.hands.get(pos).unwrap().to_vec()}
            ).await;
        }

        for idx in player_ids.iter(){
            let snapshot = build_snapshot(&room_id, &state, &players, &player_positions);
            app_ctx.connection_pool().send_to(
                &idx,
                WSEvent::GameSnapshot(snapshot)
            ).await;

        }


        while let Some(cmd) = rx.recv().await {
            match cmd {
                RoomActorCommand::PlayCard { player, card } => {
                    let player_position = player_positions.get_by_left(&player.clone()).unwrap();
                    match state.play_card(*player_position, card){
                        Ok(_) => {
                            app_ctx.connection_pool().broadcast(
                                player_ids.clone(),
                                WSEvent::CardPlayed{position: *player_position, card}
                            ).await;

                            if let Some(updated_hand) = state.hands.get(player_position) {
                                app_ctx.connection_pool().send_to(
                                    &player,
                                    WSEvent::YourHand {
                                        cards: updated_hand.clone(),
                                    }
                                ).await;
                            }
                            // если взятка завершенна
                            if let Some(winner) = state.resolve_trick() {
                                app_ctx.connection_pool().broadcast(
                                    player_ids.clone(),
                                    WSEvent::TrickWon{position: winner, team: winner.team()}
                                ).await;
                                // если раунд закончен
                                if state.hands.values().all(|h| h.is_empty()) {
                                    let _ = state.update_eye_after_round();
                                    state.update_team_score_afrer_round();
                                    let eye = state.team_eye.clone();
                                    let _ = state.update_hands(); //
                                    state.update_round_trump();
                                    state.update_round_attacking_team();


                                    for player in &players.clone() {
                                        if let Some(pos) = player_positions.get_by_left(&player.id) {
                                            if let Some(hand) = state.hands.get(pos) {
                                                let _ = app_ctx.connection_pool().send_to(
                                                    &player.id,
                                                    WSEvent::YourHand { cards: hand.clone() }
                                                ).await;
                                            }
                                        }
                                    }


                                    if eye.get(&Team::Kaskyr).copied().unwrap_or(0) >= 12 || eye.get(&Team::Uzi).copied().unwrap_or(0) >= 12 {
                                        app_ctx.connection_pool().broadcast(
                                            player_ids.clone(),
                                            WSEvent::GameOver {
                                                scores: state.team_eye.clone()
                                            }
                                        ).await;
                                        break;
                                    }
                                }
                            }
                            let snapshot = build_snapshot(&room_id, &state, &players, &player_positions);

                            app_ctx.connection_pool().broadcast(
                                player_ids.clone(),
                                WSEvent::GameSnapshot(snapshot)
                            ).await;
                        }
                        Err(e) => {
                            app_ctx.connection_pool().send_to(
                                &player.clone(),
                                WSEvent::Error { detail: e.to_string() }
                            ).await
                        }
                    }
                }
                RoomActorCommand::PlayerDisconnected { player } => {
                    app_ctx.connection_pool().disconnect(&player).await;
                    app_ctx.connection_pool().broadcast(
                        player_ids.clone(),
                        WSEvent::GameClose {
                            reason: format!("Player {} disconnected", player),
                        },
                    ).await;
                    break;
                }
                RoomActorCommand::PlayerTemporaryDisconnect { player } => {

                    disconnected.insert(player.clone(), Instant::now());
                    state.paused = true;

                    app_ctx.connection_pool().broadcast(
                        player_ids.clone(),
                        WSEvent::PlayerDisconnected {
                            position: *player_positions.get_by_left(&player).unwrap()
                        }
                    ).await;

                    // Запускаем таймер 30 секунд
                    let room_id_clone = room_id.clone();
                    let manager_tx_clone = room_manager_tx.clone();
                    let player_clone = player.clone();

                    tokio::spawn(async move {
                        tokio::time::sleep(Duration::from_secs(30)).await;

                        let app_ctx = get_global_context();

                        if let Some(session) = app_ctx.connection_pool().get(&player_clone) {
                            let status_now = session.status.read().await.clone();

                            if let PlayerStatus::InGame { disconnected_at: Some(ts), .. } = status_now {
                                if ts.elapsed() >= Duration::from_secs(30) {
                                    let _ = manager_tx_clone.send(
                                        RoomManagerCommand::PlayerDisconnected {
                                            player: player_clone,
                                            room_id: room_id_clone,
                                        }
                                    );
                                }
                            }
                        }
                    });
                }
                RoomActorCommand::PlayerReconnect { player } => {


                    disconnected.remove(&player);

                    if let Some(session) = app_ctx.connection_pool().get(&player) {
                        if let PlayerStatus::InGame { disconnected_at, position, .. } =
                            &mut *session.status.write().await
                        {
                            *disconnected_at = None;

                            // отправить snapshot
                            let pos = *position;
                            let snapshot = build_snapshot(&room_id, &state, &players, &player_positions);

                            app_ctx.connection_pool().broadcast(
                                player_ids.clone(),
                                WSEvent::PlayerReconnected { position: pos }
                            ).await;

                            app_ctx.connection_pool().send_to(
                                &player,
                                WSEvent::GameSnapshot (snapshot)
                            ).await;

                            app_ctx.connection_pool().send_to(
                                &player,
                                WSEvent::YourHand {
                                    cards: state.hands.get(&pos).unwrap().clone()
                                }
                            ).await;
                        }
                    }

                    if disconnected.is_empty() {
                        state.paused = false;
                    }
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
