use tokio::net::TcpListener;
use axum::{
    extract::ws::{WebSocketUpgrade, WebSocket, Message},
    extract::Extension,
    response::IntoResponse,
    routing::{get, post},
    Router,
};
use tracing::{info, warn, error};
use tracing_subscriber;
use crate::utils::schemas::{WSIncomingMessage, SubOrUnsub};
use crate::core::context::{AppContext, set_global_context};
// use crate::utils::jwt::handle_auth;
use crate::handlers::auth::{login, me};
use crate::handlers::ws::ws_handler;
use crate::utils::db::pg_pool;
pub mod handlers;
pub mod utils;
pub mod core;
use std::sync::Arc;
use tokio::sync::Mutex;
use futures_util::StreamExt;
use futures_util::SinkExt;
use tower_http::cors::{CorsLayer, Any};
use axum::http::{Method, HeaderName};

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter("info")
        .init();

    info!("Logical cores: {}", num_cpus::get());
    info!("Physical cores: {}", num_cpus::get_physical());

    let app_ctx = Arc::new(AppContext::new());
    let gm = app_ctx.game_manager();
    let pg_pool = Arc::new(pg_pool().await.expect(""));
    set_global_context(app_ctx.clone());

    gm.start_monitoring();


    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([Method::POST, Method::GET, Method::OPTIONS])
        .allow_headers([HeaderName::from_static("content-type"), HeaderName::from_static("authorization")]);

    let router = Router::new()
        .route("/v1/ws", get(ws_handler))
        .route("/auth/login", post(login))
        .with_state(pg_pool)
        .route("/me", post(me))
        .layer(cors)
        .layer(Extension(app_ctx));

    info!("Start server!");
    let server = TcpListener::bind("0.0.0.0:9221").await.unwrap();
    axum::serve(server, router.into_make_service()).await.unwrap();
}
