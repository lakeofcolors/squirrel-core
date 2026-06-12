use crate::config::settings::AppSettings;
use crate::core::pool::ConnectionPool;
use crate::utils::schemas::{QueueCommand, RoomManagerCommand};
use once_cell::sync::OnceCell;
use sqlx::PgPool;
use std::sync::Arc;
use tokio::sync::mpsc;

#[derive(Debug)]
pub struct AppContext {
    connection_pool: Arc<ConnectionPool>,
    pub room_manager: mpsc::UnboundedSender<RoomManagerCommand>,
    pub queue_manager: mpsc::UnboundedSender<QueueCommand>,
    pub db_pool: PgPool,
    pub config: AppSettings,
}

static GLOBAL_CONTEXT: OnceCell<Arc<AppContext>> = OnceCell::new();

pub fn set_global_context(ctx: Arc<AppContext>) {
    GLOBAL_CONTEXT
        .set(ctx)
        .expect("AppContext is already initialized");
}

pub fn get_global_context() -> Arc<AppContext> {
    GLOBAL_CONTEXT
        .get()
        .expect("AppContext not initialized")
        .clone()
}

impl AppContext {
    pub fn new(
        room_manager: mpsc::UnboundedSender<RoomManagerCommand>,
        queue_manager: mpsc::UnboundedSender<QueueCommand>,
        db_pool: PgPool,
    ) -> Self {
        Self {
            connection_pool: Arc::new(ConnectionPool::new()),
            room_manager,
            queue_manager,
            db_pool,
            config: AppSettings::new(),
        }
    }

    pub fn connection_pool(&self) -> Arc<ConnectionPool> {
        self.connection_pool.clone()
    }
}
