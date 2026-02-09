use tokio::{sync::mpsc, time::sleep};
use std::{collections::{HashMap, VecDeque}, sync::Mutex, time::{Instant, Duration}};

use crate::{utils::schemas::{Currency, League, PlayerId, Room, RoomId, QueueKey, QueueCommand, RoomManagerCommand, RoomKind, WSEvent, RoomMeta}, core::context::get_global_context};
use rust_decimal::Decimal;
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

            let _ = room_tx.send(RoomManagerCommand::Create {
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
        while let Some(cmd) = rx.recv().await {
           match cmd {
               RoomManagerCommand::Create { key, players, password_hash, kind } => {
                   let room_id = Uuid::new_v4().to_string();
                   rooms.entry(room_id.clone())
                       .or_insert(
                           Room{
                               meta: RoomMeta{
                                   id: room_id.clone(),
                                   key,
                                   players: players.clone(),
                                   kind
                               },
                               password_hash,
                               created_at: Instant::now()
                           }
                       );
                   if players.len().eq(&4){
                       start_room_actor(
                           room_id,
                           players,
                           manager_tx.clone()
                       )
                   }
               }
               RoomManagerCommand::List{ player } => {
                   let room_list: Vec<RoomMeta> = rooms
                       .values()
                       .filter(|room| room.meta.players.len() < 4)
                       .map(|room| room.meta.clone())
                       .collect();

                   app_ctx.connection_pool().send_to(&player, WSEvent::RoomList { items: room_list })
               }
           }
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
