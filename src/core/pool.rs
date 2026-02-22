use std::sync::{Arc, Mutex, RwLock};
use std::time::{Instant, Duration};
use dashmap::DashMap;
use tracing::error;

use crate::utils::schemas::{WSEvent, PlayerPosition, RoomManagerCommand, RoomId};

use super::context::get_global_context;

#[derive(Debug, PartialEq)]
pub enum PlayerStatus {
    Connected,
    Disconnected,
    InQueue,
    InGame { room_id: String, position: PlayerPosition },
}

#[derive(Debug)]
pub struct PlayerSession {
    pub username: String,
    pub sender: Mutex<Option<tokio::sync::mpsc::UnboundedSender<WSEvent>>>,
    pub status: Arc<RwLock<PlayerStatus>>,
    pub last_ping: Mutex<Instant>,
}

#[derive(Debug)]
pub struct ConnectionPool{
    players: DashMap<String, Arc<PlayerSession>>
}


impl PlayerSession{
    pub fn new(username: String, sender: tokio::sync::mpsc::UnboundedSender<WSEvent>) -> Self {
        Self{
            username,
            sender: Mutex::new(Some(sender)),
            status: Arc::new(RwLock::new(PlayerStatus::Connected)),
            last_ping: Mutex::new(Instant::now())
        }
    }
    pub fn send(&self, event: WSEvent) -> Result<(), ()> {
        let sender = self.sender.lock().unwrap();

        if let Some(tx) = sender.as_ref() {
            tx.send(event).map_err(|_| ())?;
            Ok(())
        } else {
            Err(())
        }
    }
    pub fn mark_as_in_game(&self, room_id: String, position: PlayerPosition){
        *self.status.write().unwrap() = PlayerStatus::InGame { room_id, position }
    }
    pub fn mark_as_disconnected(&self){
        *self.status.write().unwrap() = PlayerStatus::Disconnected;
    }
    pub fn mark_as_connected(&self){
        *self.status.write().unwrap() = PlayerStatus::Connected;
    }
    pub fn mark_as_in_queue(&self){
        *self.status.write().unwrap() = PlayerStatus::InQueue;
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

    pub fn send_to(&self, username: &str, event: WSEvent){
        if let Some(player) = self.get(username){
            if player.send(event.clone()).is_err() {
                error!("Ошибка отправки {:?} и дисконнект", event.clone());
                // self.disconnect(username);
            }
        }
    }

    pub fn broadcast<I>(&self, players: I, event: WSEvent)
    where
        I: IntoIterator,
        I::Item: AsRef<str>,
    {
        for player in players{
            self.send_to(player.as_ref(), event.clone())
        }
    }

    pub fn pool(&self, username: &str, sender: tokio::sync::mpsc::UnboundedSender<WSEvent>){
        self.players
            .entry(username.to_string())
            .and_modify(|p| {
                p.mark_as_connected();
                p.update_sender(sender.clone());
            })
            .or_insert_with(|| Arc::new(PlayerSession::new(username.to_string(), sender)));
    }

    pub fn disconnect(&self, username: &str) -> Option<RoomId> {
        if let Some(player) = self.get(username) {
            let room_id = {
                let status = player.status.read().unwrap();
                match &*status {
                    PlayerStatus::InGame { room_id, .. } => Some(room_id.clone()),
                    _ => None,
                }
            };
            player.mark_as_disconnected();
            player.clear_sender();
            return room_id
        }
        None
    }

    pub fn remove(&self, username: &str){
        self.players.remove(username);
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
    fn sample_player_name() -> String {
        "kagura8me".to_string()
    }


    #[fixture]
    fn sample_player(sample_player_name: String, dummy_sender: tokio::sync::mpsc::UnboundedSender<WSEvent>) -> Arc<PlayerSession> {
        Arc::new(PlayerSession::new(sample_player_name, dummy_sender))
    }

    #[fixture]
    fn pool_with_player(empty_pool: ConnectionPool, sample_player_name: String, dummy_sender: tokio::sync::mpsc::UnboundedSender<WSEvent>) -> ConnectionPool {
        empty_pool.pool(&sample_player_name, dummy_sender);
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
