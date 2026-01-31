use std::collections::{HashMap, VecDeque};
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use tokio::sync::Mutex;
use once_cell::sync::Lazy;
use uuid::Uuid;
use crate::utils::schemas::{GameState, PlayerPosition, Suit, WSEvent};
use tracing::{info, warn, error};
use std::time::{Instant, Duration};
use crate::core::context::get_global_context;
use tokio::task;
use futures_util::FutureExt;


#[derive(Debug, Clone)]
pub struct PlayerSession {
    pub id: String,
    pub sender: tokio::sync::mpsc::UnboundedSender<WSEvent>,
    pub is_connected: Arc<AtomicBool>,
    pub last_ping: Arc<Mutex<Instant>>,
}

impl PlayerSession{
    pub fn new(
        id: String,
        sender: tokio::sync::mpsc::UnboundedSender<WSEvent>
    ) -> Arc<Mutex<Self>> {
        Arc::new(Mutex::new(Self{
            id,
            sender,
            is_connected: Arc::new(AtomicBool::new(true)),
            last_ping: Arc::new(Mutex::new(Instant::now()))
        }))
    }
    pub fn is_connected(&self) -> bool{
        self.is_connected.load(std::sync::atomic::Ordering::SeqCst)
    }

    pub fn mark_as_connected(&mut self) {
        self.is_connected.store(true, std::sync::atomic::Ordering::SeqCst);
    }

    pub fn mark_as_disconnected(&mut self) {
        self.is_connected.store(false, std::sync::atomic::Ordering::SeqCst);
    }
}



#[derive(Debug)]
pub struct GameRoom {
    pub id: String,
    pub players: HashMap<PlayerPosition, Arc<Mutex<PlayerSession>>>,
    pub state: Arc<Mutex<GameState>>,
}

impl GameRoom {
    pub fn new(players: HashMap<PlayerPosition, Arc<Mutex<PlayerSession>>>) -> Self {
        let state = GameState::new(Suit::Hearts);
        Self {
            id: Uuid::new_v4().to_string(),
            players,
            state: Arc::new(Mutex::new(state)),
        }
    }
    pub async fn kick_player(&self, pos: PlayerPosition) {
        if let Some(player) = self.players.get(&pos) {
            let mut player_guard = player.lock().await;

            // Пометить как отключённого
            player_guard.mark_as_disconnected();

            // Отправить сообщение об отключении другим
            for (other_pos, other_player) in &self.players {
                if *other_pos != pos {
                    let _ = other_player.lock().await.sender.send(WSEvent::PlayerDisconnected {
                        position: pos,
                    });
                }
            }
        }

        // TODO: тут ты можешь завершить игру, если это критично:
        // например, если кто-то из игроков вышел — остановить партию.
    }
}

#[derive(Debug)]
pub struct GameManager {
    pub waiting_queue: Mutex<VecDeque<Arc<Mutex<PlayerSession>>>>,
    pub active_rooms: Mutex<HashMap<String, Arc<GameRoom>>>,
}

impl GameManager {
    pub fn new() -> Self {
        Self {
            waiting_queue: Mutex::new(VecDeque::new()),
            active_rooms: Mutex::new(HashMap::new()),
        }
    }

    pub async fn find_player_by_uid(&self, uid: &str) -> Option<Arc<Mutex<PlayerSession>>> {
        let rooms = self.active_rooms.lock().await;
        for room in rooms.values() {
            for player in room.players.values() {
                let player_guard = player.lock().await;
                if player_guard.id == uid {
                    return Some(player.clone());
                }
            }
        }
        drop(rooms);

        let queue = self.waiting_queue.lock().await;
        for player in queue.iter() {
            let player_guard = player.lock().await;
            if player_guard.id == uid {
                return Some(player.clone());
            }
        }

        None
    }

    pub async fn is_already_playing(&self, uid: &str) -> bool {
        if let Some(_player) = self.find_player_by_uid(uid).await {
            return true;
        }
        return false;
    }

    pub async fn try_start_game(&self) {
        let mut queue = self.waiting_queue.lock().await;
        if queue.len() >= 4 {
            let mut map = HashMap::new();
            for (i, pos) in [PlayerPosition::North, PlayerPosition::East, PlayerPosition::South, PlayerPosition::West].iter().enumerate() {
                if let Some(player) = queue.pop_front() {
                    map.insert(*pos, player);
                }
            }
            let room = Arc::new(GameRoom::new(map));
            self.active_rooms.lock().await.insert(room.id.clone(), room.clone());
            for (pos, player) in &room.players {
                let player = player.lock().await;
                let _ = player.sender.send(WSEvent::GameStart {
                    room_id: room.id.clone(),
                    position: *pos,
                });
            }
        }
    }

    pub async fn close_room(&self, room_id: &str, reason: &str) {
        let mut rooms_guard = self.active_rooms.lock().await;

        if let Some(room) = rooms_guard.remove(room_id) {
            for player in room.players.values() {
                let player_guard = player.lock().await;
                let _ = player_guard.sender.send(
                    WSEvent::GameClose {
                        reason: reason.to_string(),
                    },
                );
            }

            tracing::info!("Room {room_id} closed: {reason}");
        }
    }

    pub fn start_monitoring(self: Arc<Self>) {
        task::spawn(async move {
            loop {
                // Защита от паник
                let result = std::panic::AssertUnwindSafe(async {
                    tokio::time::sleep(Duration::from_secs(5)).await;

                    let now = Instant::now();
                    let mut to_kick = vec![];

                    let mut rooms_guard = self.active_rooms.lock().await;
                    for (room_id, room) in rooms_guard.iter_mut() {
                        for (pos, player) in room.players.iter() {
                            let player_guard = player.lock().await;
                            let last_ping = player_guard.last_ping.lock().await;
                            let elapsed = now.duration_since(*last_ping);

                            if elapsed > Duration::from_secs(15) {
                                info!("⏰ Kick: player {} (no ping for {:?})", player_guard.id, elapsed);
                                to_kick.push((room_id.clone(), *pos));
                            }
                        }
                    }

                    for (room_id, pos) in &to_kick {
                        if let Some(room) = rooms_guard.get_mut(room_id) {
                            room.kick_player(*pos).await;
                            info!("❌ Room {} — kicked player at position {:?}", room_id, pos);
                        }
                    }
                    drop(rooms_guard);
                    for (room_id, pos) in &to_kick {
                        self.close_room(room_id.as_str(), "Timeout").await;
                        info!("❌ Room {} closed {:?}", room_id, pos);
                    }




                }).catch_unwind().await;

                if let Err(e) = result {
                    error!("⚠️ Monitoring task panicked: {:?}", e);
                    break;
                }
            }
        });
    }

    pub async fn join(&self, player: Arc<Mutex<PlayerSession>>) {
        let player_id = {
            let player_guard = player.lock().await;
            player_guard.id.clone()
        };

        {
            let queue = self.waiting_queue.lock().await;
            for p in queue.iter() {
                let p_id = p.lock().await.id.clone();
                if p_id == player_id {
                    let _ = player.lock().await.sender.send(WSEvent::Error {
                        detail: "Already in queue".to_string(),
                    });
                    info!("Player {player_id} already in queue");
                    return;
                }
            }
        }

        {
            let rooms = self.active_rooms.lock().await;
            for room in rooms.values() {
                for p in room.players.values() {
                    let p_id = p.lock().await.id.clone();
                    if p_id == player_id {
                        let _ = player.lock().await.sender.send(WSEvent::Error {
                            detail: "Already in game".to_string(),
                        });
                        info!("Player {player_id} already in game");
                        return;
                    }
                }
            }
        }
        {
            info!("Player {player_id} added to queue");
            let mut queue = self.waiting_queue.lock().await;
            queue.push_back(player.clone());
        }

        self.try_start_game().await;
    }
}

pub static GAME_MANAGER: Lazy<GameManager> = Lazy::new(|| GameManager::new());
