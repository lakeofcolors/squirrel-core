use crate::core::pool::ConnectionPool;
use once_cell::sync::OnceCell;
use std::sync::Arc;

#[derive(Debug)]
pub struct AppContext{
    connection_pool: Arc<ConnectionPool>,
}

static GLOBAL_CONTEXT: OnceCell<Arc<AppContext>> = OnceCell::new();

pub fn set_global_context(ctx: Arc<AppContext>) {
    GLOBAL_CONTEXT.set(ctx).expect("AppContext is already initialized");
}

pub fn get_global_context() -> Arc<AppContext> {
    GLOBAL_CONTEXT.get().expect("AppContext not initialized").clone()
}

impl AppContext {
    pub fn new() -> Self{
        Self{
            connection_pool: ConnectionPool::new(),
        }
    }

    pub fn connection_pool(&self) -> Arc<ConnectionPool>{
        self.connection_pool.clone()
    }

}
