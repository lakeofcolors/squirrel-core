use axum::{
    extract::{Json, State},
    http::StatusCode,
    response::IntoResponse,
};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::sync::Arc;
use tracing::{error, info};

use crate::utils::telegram::verify_telegram_auth;
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
    pub username: String,
    pub rating: u64,
}

#[derive(Serialize)]
pub struct TokenResponse {
    pub access_token: String,
    pub refresh_token: String,
}

pub async fn telegram_login(
    State(pool): State<Arc<PgPool>>,
    Json(payload): Json<TelegramAuthRequest>,
) -> impl IntoResponse {
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
            let telegram_id = init_data.user.id.to_string();
            let username = init_data
                .user
                .username
                .clone()
                .unwrap_or(init_data.user.first_name.clone());

            let user = sqlx::query!(
                "INSERT INTO users (telegram_id, username)
                VALUES ($1, $2)
                ON CONFLICT (telegram_id) DO UPDATE SET username = EXCLUDED.username
                RETURNING username",
                telegram_id,
                username
            )
            .fetch_one(&*pool)
            .await;

            let final_username = match user {
                Ok(record) => record.username.unwrap_or_else(|| "anon".to_string()),
                Err(err) => {
                    error!("DB error: {:?}", err);
                    panic!("DB error: {:?}", err);
                }
            };
            match generate_token(&final_username, Some(3600)) {
                Ok(token) => (StatusCode::OK, token).into_response(),
                Err(err) => {
                    error!("JWT generation failed: {:?}", err);
                    (StatusCode::INTERNAL_SERVER_ERROR, "Token error").into_response()
                }
            }
        }
        Err(err) => {
            error!("Telegram signature verification failed: {:?}", err);
            (StatusCode::UNAUTHORIZED, "Bad Telegram signature").into_response()
        }
    }
}

pub async fn me(Json(payload): Json<MeRequest>) -> impl IntoResponse {
    match validate_token(&payload.token) {
        Ok(claims) => {
            let response = MeResponse {
                username: claims.sub,
                rating: 99,
            };
            (StatusCode::OK, Json(response)).into_response()
        }
        Err(err) => {
            error!("Invalid token: {:?}", err);
            (StatusCode::UNAUTHORIZED, "Incorrect token").into_response()
        }
    }
}
