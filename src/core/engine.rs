use tokio::sync::mpsc;
use std::{collections::{HashMap, VecDeque}, sync::Mutex, time::Instant};

use crate::utils::schemas::{Currency, League, PlayerId, Room, RoomId, QueueKey, QueueCommand, RoomCommand, RoomKind};
use rust_decimal::Decimal;
use tracing::info;
use uuid::Uuid;


fn try_match(
    queues: &mut HashMap<QueueKey, VecDeque<PlayerId>>,
    room_tx: &mpsc::UnboundedSender<RoomCommand>,
) {
    for (key, queue) in queues.iter_mut() {
        while queue.len() >= 4 {
            let players: Vec<PlayerId> =
                (0..4).map(|_| queue.pop_front().unwrap()).collect();

            let _ = room_tx.send(RoomCommand::Create {
                key: key.clone(),
                players,
            });
        }
    }
}

pub fn start_room_manager() -> mpsc::UnboundedSender<RoomCommand>{
    info!("Start room manager");
    let (tx, mut rx) = mpsc::unbounded_channel();

    tokio::spawn(async move {
        let mut rooms: HashMap<RoomId, Room> = HashMap::new();
        while let Some(cmd) = rx.recv().await {
           match cmd {
               RoomCommand::Create { key, players } => {
                   let room_id = Uuid::new_v4().to_string();
                   rooms.entry(room_id.clone())
                       .or_insert(
                           Room{
                               id: room_id,
                               key,
                               players,
                               password_hash: Some("hash".to_string()),
                               kind: RoomKind::Queue,
                               created_at: Instant::now()
                           }
                       );
               }
           }
        }
    });
    tx
}


pub fn start_queue_manager(
    room_tx: mpsc::UnboundedSender<RoomCommand>,
) -> mpsc::UnboundedSender<QueueCommand> {
    info!("Start queue manager");
    let (tx, mut rx) = mpsc::unbounded_channel();

    tokio::spawn(async move {
        let mut queues: HashMap<QueueKey, VecDeque<PlayerId>> = HashMap::new();

        while let Some(cmd) = rx.recv().await {
            match cmd {
                QueueCommand::Enqueue { player, key } => {
                    info!("Player add to queue");
                    queues.entry(key).or_default().push_back(player);
                    try_match(&mut queues, &room_tx);
                }

                QueueCommand::Dequeue { player, key } => {
                    info!("Player remove from queue");
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
