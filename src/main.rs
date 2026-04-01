use tokio::net::TcpListener;
use axum::{
    extract::Extension,
    routing::{get, post},
    Router,
};
use tracing::info;
use tracing_subscriber;
use crate::{core::{context::{AppContext, set_global_context}, engine::start_room_manager}, handlers::store::{equip_item, get_store}};
// use crate::utils::jwt::handle_auth;
use crate::handlers::auth::{telegram_login, me, refresh_token};
use crate::handlers::ws::ws_handler;
use crate::handlers::store::{telegram_update_webhook, create_invoice, buy_item_for_nuts, start_rewarded_session};
use crate::utils::db::pg_pool;
pub mod handlers;
pub mod utils;
pub mod core;
pub mod config;
use std::sync::Arc;
use tower_http::cors::{CorsLayer, Any};
use axum::http::{Method, HeaderName};
use tower_http::trace::TraceLayer;
use core::engine::start_queue_manager;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter("debug")
        .init();

    info!("Logical cores: {}", num_cpus::get());
    info!("Physical cores: {}", num_cpus::get_physical());
    let room_manager_writter = start_room_manager();
    let queue_manager_writter = start_queue_manager(room_manager_writter.clone());
    let db_pool = crate::utils::db::pg_pool()
        .await
        .expect("Failed to create PgPool");

    let app_ctx = Arc::new(
        AppContext::new(
            room_manager_writter,
            queue_manager_writter,
            db_pool
        )
    );

    set_global_context(app_ctx.clone());

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([Method::POST, Method::GET, Method::OPTIONS])
        .allow_headers([HeaderName::from_static("content-type"), HeaderName::from_static("authorization")]);

    let router = Router::new()
        .route("/v1/ws", get(ws_handler))
        .route("/auth/login", post(telegram_login))
        .route("/auth/refresh", post(refresh_token))
        .route("/auth/me", get(me))
        .route("/v1/store/invoice", post(create_invoice))
        .route("/v1/store", get(get_store))
        .route("/v1/store/equip", post(equip_item))
        .route("/v1/store/buy", post(buy_item_for_nuts))
        .route("/telegram/webhook", post(telegram_update_webhook))
        .layer(cors)
        .layer(Extension(app_ctx))
        .layer(TraceLayer::new_for_http());

    info!("Start server!");
    let server = TcpListener::bind("0.0.0.0:9221").await.unwrap();
    axum::serve(server, router.into_make_service()).await.unwrap();
}
