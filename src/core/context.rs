// use crate::core::pool::ConnectionPool;
use crate::core::manager::GameManager;
use once_cell::sync::OnceCell;
use std::sync::Arc;

#[derive(Debug)]
pub struct AppContext{
    game_manager: Arc<GameManager>,
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
            game_manager: Arc::new(GameManager::new()),
        }
    }

    pub fn game_manager(&self) -> Arc<GameManager>{
        self.game_manager.clone()
    }

}
