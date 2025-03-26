use sqlx::__rt::spawn;
use tokio::sync::{RwLock, Mutex};
use std::sync::Arc;
use std::collections::HashMap;
use crate::utils::schemas::SubManageMsg;
use futures_util::stream::SplitSink;
use futures_util::SinkExt;
use axum::extract::ws::WebSocket;
use tracing::info;
use axum::extract::ws::Message;
use crate::core::engine::SearchEngine;
use crate::utils::schemas::Player;


#[derive(Debug)]
pub struct ConnectionPool{
    client_by_uid: RwLock<HashMap<String, Vec<Arc<Mutex<SplitSink<WebSocket, axum::extract::ws::Message>>>>>>,
    search_engine: Arc<SearchEngine>,
}


impl ConnectionPool{
    pub fn new() -> Arc<Self>{
        let pool = Arc::new(Self{
            client_by_uid: RwLock::new(HashMap::new()),
            search_engine: Arc::new(SearchEngine::new())
        });

        let search_engine = pool.search_engine.clone();
        let pool_clone = pool.clone();

        spawn(async move {
            search_engine.process_queue(pool_clone).await;
        });
        pool
    }

    pub async fn find_game(
        &self,
        client_uid: String,
        client_writer: Arc<Mutex<SplitSink<WebSocket, axum::extract::ws::Message>>>
    ){
        let player = Player{
            username: client_uid,
            hand: Vec::new(),
            client_writer,
        };
        self.search_engine.add_player(player).await;
    }

    pub async fn register_client(
        &self,
        client_uid: String,
        client_writer: Arc<Mutex<SplitSink<WebSocket, axum::extract::ws::Message>>>
    ){
        let mut clients_by_uid = self.client_by_uid.write().await;
        clients_by_uid.entry(client_uid).or_insert_with(Vec::new).push(client_writer)
    }
}
