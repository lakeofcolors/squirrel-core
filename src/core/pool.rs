use std::sync::Arc;
use tokio::sync::{Mutex, RwLock};
use std::time::{Instant, Duration};
use dashmap::DashMap;
use tracing::error;

use crate::utils::schemas::{WSEvent, PlayerPosition, RoomManagerCommand, RoomId, PlayerMeta, PlayerId};

use super::context::get_global_context;

#[derive(Debug, PartialEq, Clone)]
pub enum PlayerStatus {
    Connected,
    Disconnected,
    InQueue,
    InGame {
        room_id: String,
        position: PlayerPosition,
        disconnected_at: Option<Instant>
    },
}

#[derive(Debug)]
pub struct PlayerSession {
    pub player_meta: PlayerMeta,
    pub sender: Mutex<Option<tokio::sync::mpsc::UnboundedSender<WSEvent>>>,
    pub status: Arc<RwLock<PlayerStatus>>,
    pub last_ping: Mutex<Instant>,
}

#[derive(Debug)]
pub struct ConnectionPool{
    players: DashMap<PlayerId, Arc<PlayerSession>>
}


impl PlayerSession{
    pub fn new(player_meta: PlayerMeta, sender: tokio::sync::mpsc::UnboundedSender<WSEvent>) -> Self {
        Self{
            player_meta,
            sender: Mutex::new(Some(sender)),
            status: Arc::new(RwLock::new(PlayerStatus::Connected)),
            last_ping: Mutex::new(Instant::now())
        }
    }
    pub async fn send(&self, event: WSEvent) -> Result<(), ()> {
        let sender = self.sender.lock().await;

        if let Some(tx) = sender.as_ref() {
            tx.send(event).map_err(|_| ())?;
            Ok(())
        } else {
            Err(())
        }
    }
    pub async fn mark_as_in_game(&self, room_id: String, position: PlayerPosition){
        *self.status.write().await = PlayerStatus::InGame { room_id, position, disconnected_at: None }
    }
    pub async fn mark_as_disconnected(&self){
        *self.status.write().await = PlayerStatus::Disconnected;
    }
    pub async fn mark_temp_disconnected(&self) {
        let mut status = self.status.write().await;
        if let PlayerStatus::InGame { disconnected_at, .. } = &mut *status {
            *disconnected_at = Some(Instant::now());
        }
    }
    pub async fn mark_back_to_connected(&self) {
        *self.status.write().await = PlayerStatus::Connected;
    }

    pub async fn mark_reconnected_in_game(&self) {
        let mut status = self.status.write().await;
        if let PlayerStatus::InGame { disconnected_at, .. } = &mut *status {
            *disconnected_at = None;
        }
    }
    pub async fn mark_as_in_queue(&self){
        *self.status.write().await = PlayerStatus::InQueue;
    }
    async fn clear_sender(&self) {
        *self.sender.lock().await = None;
    }
    async fn update_sender(&self, new_sender: tokio::sync::mpsc::UnboundedSender<WSEvent>){
        *self.sender.lock().await = Some(new_sender);
    }
    pub async fn update_last_ping(&self){
        *self.last_ping.lock().await = Instant::now();
    }
}

impl ConnectionPool{
    pub fn new() -> Self{
        Self {
            players: DashMap::new(),
        }
    }
    pub fn get(&self, player_id: &i64) -> Option<Arc<PlayerSession>>{
        self.players.get(player_id).map(|p| p.value().clone())
    }
    pub async fn send_to(&self, player_id: &i64, event: WSEvent){
        if let Some(player) = self.get(player_id){
            if player.send(event.clone()).await.is_err() {
                error!("Ошибка отправки {:?} и дисконнект", event.clone());
                // self.disconnect(username);
            }
        }
    }
    pub async fn broadcast<I>(&self, players: I, event: WSEvent)
    where
        I: IntoIterator<Item = i64>,
    {
        for player in players{
            self.send_to(&player, event.clone()).await
        }
    }
    pub async fn pool(
        &self,
        player_meta: PlayerMeta,
        sender: tokio::sync::mpsc::UnboundedSender<WSEvent>,
    ) {
        if let Some(player) = self.players.get(&player_meta.id) {
            player.update_sender(sender).await;
            player.update_last_ping().await;

            let status = player.status.read().await.clone();
            match status {
                PlayerStatus::InGame {
                    disconnected_at: Some(_),
                    ..
                } => {
                    player.mark_reconnected_in_game().await;
                }
                PlayerStatus::Disconnected => {
                    player.mark_back_to_connected().await;
                }
                PlayerStatus::Connected
                | PlayerStatus::InQueue
                | PlayerStatus::InGame {
                    disconnected_at: None,
                    ..
                } => {}
            }
        } else {
            self.players.insert(
                player_meta.id,
                Arc::new(PlayerSession::new(player_meta, sender)),
            );
        }
    }
    pub async fn temp_disconnected(&self, player_id: &i64){
        if let Some(player) = self.get(player_id) {
            player.mark_temp_disconnected().await;
            player.clear_sender().await;
        }
    }
    pub async fn disconnect(&self, player_id: &i64){
        if let Some(player) = self.get(player_id) {
            player.mark_as_disconnected().await;
            player.clear_sender().await;
        }

    }
    pub fn remove(&self, player_id: &i64){
        self.players.remove(player_id);
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
