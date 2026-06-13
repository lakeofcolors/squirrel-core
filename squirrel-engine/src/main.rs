#![allow(
    clippy::ptr_arg,
    clippy::nonminimal_bool,
    clippy::too_many_arguments,
    clippy::comparison_chain,
    clippy::redundant_pattern_matching,
    clippy::needless_range_loop,
    clippy::let_underscore_future,
    clippy::result_unit_err,
    dead_code,
    unused_variables,
    unused_assignments,
    unused_imports
)]


use crate::{
    core::{
        context::{set_global_context, AppContext},
        engine::start_room_manager,
    },
    handlers::store::{equip_item, get_store},
};

use axum::{
    extract::Extension,
    routing::{get, post},
    Router,
};
use tokio::net::TcpListener;
use tracing::info;
// use crate::utils::jwt::handle_auth;
use crate::handlers::auth::{me, refresh_token, telegram_login};
use crate::handlers::chests::{buy_chest, get_chests, open_chest};
use crate::handlers::clans::{
    create_clan, get_clan_details, get_clans, get_tournament_details, get_tournaments, join_clan, register_for_tournament,
};
use crate::handlers::daily::{claim_daily_reward, get_daily_status};
use crate::handlers::friends::{
    accept_request, consume_invite, decline_request, get_friends, get_requests, search_users,
    send_request,
};
use crate::handlers::history::get_match_replay;
use crate::handlers::profile::{get_profile, get_public_profile};
use crate::handlers::rating::get_leaderboard;
use crate::handlers::slots::spin_slots;
use crate::handlers::store::{buy_item_for_nuts, create_invoice, telegram_update_webhook};
use crate::handlers::ws::ws_handler;
pub mod config;
pub mod core;
pub mod handlers;
pub mod utils;
use axum::http::{HeaderName, Method};
use core::engine::start_queue_manager;
use core::tournaments::start_tournament_manager;
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt().with_env_filter("debug").init();

    info!("Logical cores: {}", num_cpus::get());
    info!("Physical cores: {}", num_cpus::get_physical());
    let room_manager_writter = start_room_manager();
    let queue_manager_writter = start_queue_manager(room_manager_writter.clone());
    let db_pool = crate::utils::db::pg_pool()
        .await
        .expect("Failed to create PgPool");

    start_tournament_manager(db_pool.clone(), room_manager_writter.clone());

    let app_ctx = Arc::new(AppContext::new(
        room_manager_writter,
        queue_manager_writter,
        db_pool,
    ));

    set_global_context(app_ctx.clone());

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([Method::POST, Method::GET, Method::OPTIONS])
        .allow_headers([
            HeaderName::from_static("content-type"),
            HeaderName::from_static("authorization"),
        ]);

    let router = Router::new()
        .route("/v1/ws", get(ws_handler))
        .route("/auth/login", post(telegram_login))
        .route("/auth/refresh", post(refresh_token))
        .route("/auth/me", get(me))
        .route("/v1/store/invoice", post(create_invoice))
        .route("/v1/store", get(get_store))
        .route("/v1/store/equip", post(equip_item))
        .route("/v1/store/buy", post(buy_item_for_nuts))
        .route("/v1/rating", get(get_leaderboard))
        .route("/v1/profile", get(get_profile))
        .route("/v1/profile/:id", get(get_public_profile))
        .route("/v1/friends", get(get_friends))
        .route("/v1/users/search", get(search_users))
        .route("/v1/friends/invite/consume", post(consume_invite))
        .route("/v1/friends/requests", post(send_request).get(get_requests))
        .route("/v1/friends/requests/:id/accept", post(accept_request))
        .route("/v1/friends/requests/:id/decline", post(decline_request))
        .route("/v1/history/:match_id/replay", get(get_match_replay))
        .route("/v1/events", get(crate::handlers::events::get_active_event))
        .route(
            "/v1/events/claim",
            post(crate::handlers::events::claim_quest),
        )
        .route(
            "/v1/events/buy",
            post(crate::handlers::events::buy_event_item),
        )
        .route(
            "/v1/inventory/use",
            post(crate::handlers::inventory::use_item),
        )
        .route("/v1/chests", get(get_chests))
        .route("/v1/chests/open", post(open_chest))
        .route("/v1/chests/buy", post(buy_chest))
        .route("/v1/daily_reward", get(get_daily_status))
        .route("/v1/daily_reward/claim", post(claim_daily_reward))
        .route("/v1/spin", get(crate::handlers::spin::get_spin_info))
        .route("/v1/spin/draw", post(crate::handlers::spin::draw_spin))
        .route("/v1/slots/spin", post(spin_slots))
        .route("/v1/clans", post(create_clan).get(get_clans))
        .route("/v1/clans/:id", get(get_clan_details))
        .route("/v1/clans/:id/join", post(join_clan))
        .route(
            "/v1/clans/:id/chat",
            post(crate::handlers::clans::send_clan_message)
                .get(crate::handlers::clans::get_clan_chat),
        )
        .route(
            "/v1/clans/:id/members/:target_id/role",
            post(crate::handlers::clans::change_member_role),
        )
        .route(
            "/v1/clans/:id/members/:target_id/kick",
            post(crate::handlers::clans::kick_member),
        )
        .route("/v1/tournaments", get(get_tournaments))
        .route("/v1/tournaments/:id", get(get_tournament_details))
        .route(
            "/v1/tournaments/:id/register",
            post(register_for_tournament),
        )
        .route("/telegram/webhook", post(telegram_update_webhook))
        .layer(cors)
        .layer(Extension(app_ctx))
        .layer(TraceLayer::new_for_http());

    let port = std::env::var("PORT").unwrap_or_else(|_| "9221".to_string());
    let bind_addr = format!("0.0.0.0:{}", port);
    info!("Start server on {}!", bind_addr);
    let server = TcpListener::bind(&bind_addr).await.unwrap();
    axum::serve(server, router.into_make_service())
        .await
        .unwrap();
}
