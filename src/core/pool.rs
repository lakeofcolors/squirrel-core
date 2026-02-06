use std::sync::{Arc, Mutex, RwLock};
use std::time::{Instant, Duration};
use dashmap::DashMap;

use crate::utils::schemas::{WSEvent, PlayerPosition};

#[derive(Debug, PartialEq)]
pub enum PlayerStatus {
    Connected,
    Disconnected,
    InQueue,
    InGame { room_id: String, position: PlayerPosition },
}

#[derive(Debug, Clone)]
pub struct PlayerSession {
    pub username: String,
    pub sender: Arc<Mutex<Option<tokio::sync::mpsc::UnboundedSender<WSEvent>>>>,
    pub status: Arc<RwLock<PlayerStatus>>,
    pub last_ping: Arc<Mutex<Instant>>,
}

#[derive(Debug)]
pub struct ConnectionPool{
    players: DashMap<String, Arc<PlayerSession>>
}


impl PlayerSession{
    pub fn new(username: String, sender: tokio::sync::mpsc::UnboundedSender<WSEvent>) -> Self {
        Self{
            username,
            sender: Arc::new(Mutex::new(Some(sender))),
            status: Arc::new(RwLock::new(PlayerStatus::Connected)),
            last_ping: Arc::new(Mutex::new(Instant::now()))
        }
    }

    fn mark_as_disconnected(&self){
        *self.status.write().unwrap() = PlayerStatus::Disconnected;
    }
    fn mark_as_connected(&self){
        *self.status.write().unwrap() = PlayerStatus::Connected;
    }
    fn clear_sender(&self) {
        *self.sender.lock().unwrap() = None;
    }
    fn update_sender(&self, new_sender: tokio::sync::mpsc::UnboundedSender<WSEvent>){
        *self.sender.lock().unwrap() = Some(new_sender);
    }
    pub fn update_last_ping(&self){
        *self.last_ping.lock().unwrap() = Instant::now();
    }


}

impl ConnectionPool{
    pub fn new() -> Self{
        Self {
            players: DashMap::new(),
        }
    }

    pub fn get(&self, username: &str) -> Option<Arc<PlayerSession>>{
        self.players.get(username).map(|p| p.value().clone())
    }

    pub fn pool(&self, player: Arc<PlayerSession>){
        if let Some(existing_player) = self.get(&player.username) {
            existing_player.mark_as_connected();
            let new_sender = player.sender.lock().unwrap().clone().expect("ws sender not found");
            existing_player.update_sender(new_sender);
        }else{
            self.players.insert(player.username.clone(), player);
        }
    }

    pub fn disconnect(&self, username: &str){
        if let Some(player) = self.get(username){
            player.mark_as_disconnected();
            player.clear_sender();
        }
    }

    pub fn remove(&self, username: &str){
        self.players.remove(username);
    }

    pub fn clean_inactive(&self, timeout: Duration){
        let now = Instant::now();
        let mut to_remove: Vec<PlayerSession> = Vec::new();

        for entry in self.players.iter() {
            let player = entry.value();
            let last_ping_guard = player.last_ping.lock();
            // NOTE to be continue...
        }
    }

}


#[cfg(test)]
mod tests {
    use super::*;
    use rstest::*;

    #[fixture]
    fn empty_pool() -> ConnectionPool {
        ConnectionPool::new()
    }

    #[fixture]
    fn dummy_sender() -> tokio::sync::mpsc::UnboundedSender<WSEvent> {
        let (tx, _) = tokio::sync::mpsc::unbounded_channel();
        tx
    }

    #[fixture]
    fn sample_player(dummy_sender: tokio::sync::mpsc::UnboundedSender<WSEvent>) -> Arc<PlayerSession> {
        Arc::new(PlayerSession {
            username: "kagura8me".to_string(),
            sender: Arc::new(Mutex::new(Some(dummy_sender))),
            status: Arc::new(RwLock::new(PlayerStatus::Connected)),
            last_ping: Arc::new(Mutex::new(Instant::now())),
        })
    }

    #[fixture]
    fn pool_with_player(empty_pool: ConnectionPool, sample_player: Arc<PlayerSession>) -> ConnectionPool {
        empty_pool.pool(sample_player);
        empty_pool
    }


    #[rstest]
    fn test_pool_get(pool_with_player: ConnectionPool, sample_player: Arc<PlayerSession>) {
        let player_name = sample_player.clone().username.clone();
        let player = pool_with_player.get(&sample_player.username.clone()).unwrap();
        assert_eq!(player.username, player_name);
    }

    #[rstest]
    fn test_pool_disconnect(pool_with_player: ConnectionPool, sample_player: Arc<PlayerSession>){
        let player = sample_player.clone();
        let status = player.status.read().unwrap();
        if let Some(p) = pool_with_player.get(&player.clone().username){
            assert_eq!(*status, *p.status.read().unwrap());
        }
    }

    #[rstest]
    fn test_pool_remove(pool_with_player: ConnectionPool, sample_player: Arc<PlayerSession>){
        let player_name = sample_player.username.clone();
        pool_with_player.remove(&player_name);
        let nothing = pool_with_player.get(&player_name);
        assert!(nothing.is_none())
    }


}
