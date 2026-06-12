use std::sync::Arc;
use tokio::sync::{Mutex, RwLock};
use std::time::Instant;
use dashmap::DashMap;
use tracing::{debug, error, info, warn};

use crate::utils::schemas::{WSEvent, PlayerPosition, PlayerMeta, PlayerId};


#[derive(Debug, PartialEq, Clone)]
pub enum PlayerStatus {
    Connected,
    Disconnected,
    InQueue,
    InLobby {
        room_id: String
    },
    InGame {
        room_id: String,
        position: PlayerPosition,
        disconnected_at: Option<Instant>
    },
    Spectating {
        room_id: String
    }
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
        debug!("Creating new PlayerSession for player {}", player_meta.id);
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
            warn!("Failed to send event to player {} (sender is None)", self.player_meta.id);
            Err(())
        }
    }
    pub async fn mark_as_in_lobby(&self, room_id: String) {
        *self.status.write().await = PlayerStatus::InLobby { room_id };
    }

    pub async fn mark_as_in_game(&self, room_id: String, position: PlayerPosition){
        info!("Player {} marked as InGame (room_id: {}, position: {:?})", self.player_meta.id, room_id, position);
        *self.status.write().await = PlayerStatus::InGame { room_id, position, disconnected_at: None }
    }
    pub async fn mark_as_spectating(&self, room_id: String) {
        info!("Player {} marked as Spectating (room_id: {})", self.player_meta.id, room_id);
        *self.status.write().await = PlayerStatus::Spectating { room_id }
    }
    pub async fn mark_as_disconnected(&self){
        info!("Player {} marked as Disconnected", self.player_meta.id);
        *self.status.write().await = PlayerStatus::Disconnected;
    }
    pub async fn mark_temp_disconnected(&self) {
        let mut status = self.status.write().await;
        if let PlayerStatus::InGame { disconnected_at, .. } = &mut *status {
            info!("Player {} marked as temporarily disconnected while InGame", self.player_meta.id);
            *disconnected_at = Some(Instant::now());
        }
    }
    pub async fn mark_back_to_connected(&self) {
        info!("Player {} marked back to Connected", self.player_meta.id);
        *self.status.write().await = PlayerStatus::Connected;
    }

    pub async fn mark_reconnected_in_game(&self) {
        let mut status = self.status.write().await;
        if let PlayerStatus::InGame { disconnected_at, .. } = &mut *status {
            info!("Player {} marked as reconnected while InGame", self.player_meta.id);
            *disconnected_at = None;
        }
    }
    pub async fn mark_as_in_queue(&self){
        info!("Player {} marked as InQueue", self.player_meta.id);
        *self.status.write().await = PlayerStatus::InQueue;
    }
    async fn clear_sender(&self) {
        debug!("Clearing sender for player {}", self.player_meta.id);
        *self.sender.lock().await = None;
    }
    async fn update_sender(&self, new_sender: tokio::sync::mpsc::UnboundedSender<WSEvent>){
        debug!("Updating sender for player {}", self.player_meta.id);
        *self.sender.lock().await = Some(new_sender);
    }
    pub async fn update_last_ping(&self){
        *self.last_ping.lock().await = Instant::now();
    }
}

impl ConnectionPool{
    pub fn new() -> Self{
        info!("Initializing ConnectionPool");
        Self {
            players: DashMap::new(),
        }
    }

    pub fn count(&self) -> usize {
        self.players.len()
    }

    pub fn get(&self, player_id: &i64) -> Option<Arc<PlayerSession>>{
        self.players.get(player_id).map(|p| p.value().clone())
    }
    pub async fn send_to(&self, player_id: &i64, event: WSEvent){
        if let Some(player) = self.get(player_id){
            if player.send(event.clone()).await.is_err() {
                error!("Ошибка отправки {:?} и дисконнект игрока {}", event.clone(), player_id);
                self.temp_disconnected(&player_id).await;
            }
        } else {
            warn!("Attempted to send event to unknown player: {}", player_id);
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
            info!("Player {} re-pooling (already in ConnectionPool)", player_meta.id);
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
                | PlayerStatus::Spectating { .. }
                | PlayerStatus::InQueue
                | PlayerStatus::InLobby { .. }
                | PlayerStatus::InGame {
                    disconnected_at: None,
                    ..
                } => {}
            }
        } else {
            info!("Adding new player {} to ConnectionPool", player_meta.id);
            self.players.insert(
                player_meta.id,
                Arc::new(PlayerSession::new(player_meta, sender)),
            );
        }
    }
    pub async fn temp_disconnected(&self, player_id: &i64){
        info!("Processing temporary disconnect for player {}", player_id);
        if let Some(player) = self.get(player_id) {
            player.mark_temp_disconnected().await;
            player.clear_sender().await;
        }
    }
    pub async fn disconnect(&self, player_id: &i64){
        info!("Processing disconnect for player {}", player_id);
        if let Some(player) = self.get(player_id) {
            player.mark_as_disconnected().await;
            player.clear_sender().await;
        }
    }
    pub fn remove(&self, player_id: &i64){
        info!("Removing player {} from ConnectionPool", player_id);
        self.players.remove(player_id);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::utils::schemas::{PlayerMeta, PlayerPosition};
    use tokio::sync::mpsc;

    fn mock_player_meta(id: i64) -> PlayerMeta {
        PlayerMeta {
            id,
            username: Some(format!("Player {}", id)),
            rating: 1000,
            photo_url: None,
        }
    }

    #[tokio::test]
    async fn test_pool_connection() {
        let pool = ConnectionPool::new();
        let (tx, mut rx) = mpsc::unbounded_channel();
        let meta = mock_player_meta(1);
        pool.pool(meta.clone(), tx).await;
        
        assert!(pool.get(&1).is_some());
        
        let session = pool.get(&1).unwrap();
        assert_eq!(*session.status.read().await, PlayerStatus::Connected);
        
        let sent = session.send(WSEvent::SuccessLogin { username: "demo".to_string() }).await;
        assert!(sent.is_ok());
        assert!(rx.recv().await.is_some());
    }

    #[tokio::test]
    async fn test_session_status_changes() {
        let pool = ConnectionPool::new();
        let (tx, _rx) = mpsc::unbounded_channel();
        let meta = mock_player_meta(2);
        pool.pool(meta.clone(), tx).await;
        
        let session = pool.get(&2).unwrap();
        
        session.mark_as_in_queue().await;
        assert_eq!(*session.status.read().await, PlayerStatus::InQueue);
        
        session.mark_as_in_game("room_1".to_string(), PlayerPosition::North).await;
        if let PlayerStatus::InGame { room_id, position, disconnected_at } = &*session.status.read().await {
            assert_eq!(room_id, "room_1");
            assert_eq!(position, &PlayerPosition::North);
            assert!(disconnected_at.is_none());
        } else {
            panic!("Expected InGame status");
        }
        
        session.mark_temp_disconnected().await;
        if let PlayerStatus::InGame { disconnected_at, .. } = &*session.status.read().await {
            assert!(disconnected_at.is_some());
        } else {
            panic!("Expected InGame status with disconnected time");
        }
        
        session.mark_reconnected_in_game().await;
        if let PlayerStatus::InGame { disconnected_at, .. } = &*session.status.read().await {
            assert!(disconnected_at.is_none());
        } else {
            panic!("Expected InGame status without disconnect time");
        }
        
        session.mark_as_disconnected().await;
        assert_eq!(*session.status.read().await, PlayerStatus::Disconnected);
        
        session.mark_back_to_connected().await;
        assert_eq!(*session.status.read().await, PlayerStatus::Connected);
    }
    
    #[tokio::test]
    async fn test_pool_methods() {
        let pool = ConnectionPool::new();
        let (tx, _rx) = mpsc::unbounded_channel();
        let meta = mock_player_meta(3);
        pool.pool(meta.clone(), tx).await;
        
        pool.temp_disconnected(&3).await;
        let session = pool.get(&3).unwrap();
        assert_eq!(*session.status.read().await, PlayerStatus::Connected);
        
        let has_sender = session.sender.lock().await.is_some();
        assert!(!has_sender);
        
        pool.disconnect(&3).await;
        assert_eq!(*session.status.read().await, PlayerStatus::Disconnected);
        
        pool.remove(&3);
        assert!(pool.get(&3).is_none());
    }
}
