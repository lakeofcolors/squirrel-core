use axum::{
    extract::{Json, State},
    http::{StatusCode, HeaderMap},
    response::IntoResponse, Extension,
};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::sync::Arc;
use tracing::{error, info};

use crate::{utils::telegram::verify_telegram_auth, core::context::AppContext};
use crate::utils::jwt::{generate_token, validate_token};

#[derive(Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Deserialize)]
pub struct TelegramAuthRequest {
    pub init_data: String,
}

#[derive(Deserialize)]
pub struct MeRequest {
    pub token: String,
}

#[derive(Serialize)]
pub struct MeResponse {
    pub id: u64,
    pub username: String,
    pub photo_url: Option<String>,
    pub rating: u64,
}

#[derive(Serialize)]
pub struct TokenResponse {
    pub access_token: String,
    pub refresh_token: String,
}

pub async fn telegram_login(
    Extension(app_ctx): Extension<Arc<AppContext>>,
    Json(payload): Json<TelegramAuthRequest>,
) -> impl IntoResponse {
    let pool = &app_ctx.db_pool;
    let bot_token = match std::env::var("BOT_TOKEN") {
        Ok(t) => t,
        Err(_) => {
            error!("BOT_TOKEN is not set in environment");
            return (StatusCode::INTERNAL_SERVER_ERROR, "Server config error").into_response();
        }
    };

    info!("payload: {:?}", &payload.init_data);

    match verify_telegram_auth(&payload.init_data, &bot_token) {
        Ok(init_data) => {
            let telegram_id: i64 = init_data.user.id.try_into().unwrap();
            let username = init_data
                .user
                .username
                .clone()
                .unwrap_or(init_data.user.first_name.clone());
            let photo_url = init_data.user.photo_url.clone();
            let _ = sqlx::query!(
                "INSERT INTO users (telegram_id, username, photo_url)
                VALUES ($1, $2, $3)
                ON CONFLICT (telegram_id) DO UPDATE SET username = EXCLUDED.username, photo_url = EXCLUDED.photo_url
                RETURNING username",
                telegram_id,
                username,
                photo_url,
            )
            .fetch_one(&*pool)
            .await;

            match (
                generate_token(telegram_id, Some(3600)),       // 1 hour
                generate_token(telegram_id, Some(7 * 24 * 3600)) // 7 days
            ) {
                (Ok(access_token), Ok(refresh_token)) => {
                    let response = TokenResponse {
                        access_token,
                        refresh_token,
                    };
                    (StatusCode::OK, Json(response)).into_response()
                }
                _ => (StatusCode::INTERNAL_SERVER_ERROR, "JWT generation failed").into_response(),
            }
        }
        Err(err) => {
            error!("Telegram signature verification failed: {:?}", err);
            (StatusCode::UNAUTHORIZED, "Bad Telegram signature").into_response()
        }
    }
}

pub async fn me(
    Extension(app_ctx): Extension<Arc<AppContext>>,
    headers: HeaderMap
) -> impl IntoResponse {
    let pool = &app_ctx.db_pool;
    let auth_header = match headers.get("authorization") {
        Some(value) => value,
        None => return (StatusCode::UNAUTHORIZED, "Missing auth header").into_response(),
    };

    let auth_str = match auth_header.to_str() {
        Ok(v) => v,
        Err(_) => return (StatusCode::UNAUTHORIZED, "Invalid auth header").into_response(),
    };

    let token = match auth_str.strip_prefix("Bearer ") {
        Some(t) => t,
        None => return (StatusCode::UNAUTHORIZED, "Invalid auth scheme").into_response(),
    };

    let claims = match validate_token(token) {
        Ok(c) => c,
        Err(err) => {
            error!("Invalid token: {:?}", err);
            return (StatusCode::UNAUTHORIZED, "Incorrect token").into_response()
        }
    };

    let telegram_id: i64 = claims.sub;

    let user = sqlx::query!(
        "SELECT username, rating, photo_url FROM users WHERE telegram_id = $1",
        telegram_id
    )
    .fetch_one(&*pool)
    .await;

    match user {
        Ok(record) => {
            let response = MeResponse {
                id: telegram_id.try_into().unwrap(),
                username: record.username.unwrap_or_else(|| "anon".into()),
                photo_url: record.photo_url,
                rating: record.rating as u64,
            };
            (StatusCode::OK, Json(response)).into_response()
        }
        Err(err) => {
            error!("DB error: {:?}", err);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Database error"
            ).into_response()
        }
    }
}
