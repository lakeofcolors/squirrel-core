use tokio::{sync::mpsc, time::sleep};
use std::{collections::{HashMap, VecDeque}, sync::Mutex, time::{Instant, Duration}};

use crate::{utils::schemas::{Currency, League, PlayerId, Room, RoomId, QueueKey, QueueCommand, RoomManagerCommand, RoomKind, WSEvent, RoomMeta}, core::context::get_global_context};
use tracing::info;
use uuid::Uuid;


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
                    rooms.entry(room_id.clone())
                         .or_insert(
                             Room{
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
                        start_room_actor(
                            room_id,
                            players,
                            manager_tx.clone()
                        )
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
                                start_room_actor(
                                    room_id.clone(),
                                    room.meta.players.clone(),
                                    manager_tx.clone(),
                                );
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
) {
    tokio::spawn(async move {
        let mut subs: Vec<mpsc::UnboundedSender<WSEvent>> = Vec::new();
        let mut alive = true;

        // while let Some(cmd) = rx.recv().await {
        //     match cmd {
        //         RoomCommand::Subscribe { ws, .. } => {
        //             subs.push(ws);
        //         }

        //         RoomCommand::PlayCard { player, card } => {
        //             // game logic here
        //             for sub in &subs {
        //                 let _ = sub.send(WSEvent::GameEvent(format!(
        //                     "{player} played {card}"
        //                 )));
        //             }
        //         }
        //     }

        //     if !alive {
        //         break;
        //     }
        // }

        // let _ = room_manager_tx.send(
        //     RoomManagerCommand::RoomFinished { room_id }
        // );
    });
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
