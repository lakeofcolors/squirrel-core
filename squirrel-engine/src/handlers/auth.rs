use axum::{extract::Json, http::StatusCode, response::IntoResponse, Extension};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tracing::{error, info};

use crate::utils::jwt::{generate_token, validate_token};
use crate::{
    core::context::AppContext,
    utils::{jwt::AuthUser, telegram::verify_telegram_auth},
};

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
    pub xp: i32,
    pub nuts: u64,
    pub tournament_coins: u64,
    pub equipped_deck: String,
    pub equipped_background: String,
}

#[derive(Serialize)]
pub struct TokenResponse {
    pub access_token: String,
    pub refresh_token: String,
}

#[derive(Deserialize)]
pub struct RefreshRequest {
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

            let _ = sqlx::query!(
                r#"
                INSERT INTO user_inventory (telegram_id, item_type, item_id)
                VALUES
                    ($1, 'deck', 'classic'),
                    ($1, 'background', 'neon')
                ON CONFLICT (telegram_id, item_type, item_id) DO NOTHING
                "#,
                telegram_id
            )
            .execute(&*pool)
            .await;

            let _ = sqlx::query!(
                r#"
                INSERT INTO user_equipped_items (telegram_id, equipped_deck_id, equipped_background_id)
                VALUES
                ($1, 'classic', 'neon')
                ON CONFLICT (telegram_id) DO NOTHING
                "#,
                telegram_id
            )
            .execute(&*pool)
            .await;

            match (
                generate_token(telegram_id, Some(7200)),          // 2 hour
                generate_token(telegram_id, Some(7 * 24 * 3600)), // 7 days
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

pub async fn refresh_token(Json(payload): Json<RefreshRequest>) -> impl IntoResponse {
    match validate_token(&payload.refresh_token) {
        Ok(claims) => {
            let telegram_id = claims.sub;

            match (
                generate_token(telegram_id, Some(7200)),
                generate_token(telegram_id, Some(7 * 24 * 3600)),
            ) {
                (Ok(access_token), Ok(refresh_token)) => {
                    let response = TokenResponse {
                        access_token,
                        refresh_token,
                    };
                    (StatusCode::OK, Json(response)).into_response()
                }
                _ => {
                    error!("JWT generation failed during token refresh");
                    (StatusCode::INTERNAL_SERVER_ERROR, "JWT generation failed").into_response()
                }
            }
        }
        Err(err) => {
            error!("Refresh token validation failed: {:?}", err);
            (StatusCode::UNAUTHORIZED, "Invalid or expired refresh token").into_response()
        }
    }
}

pub async fn me(
    Extension(app_ctx): Extension<Arc<AppContext>>,
    auth_user: AuthUser,
) -> impl IntoResponse {
    let pool = &app_ctx.db_pool;
    let telegram_id: i64 = auth_user.telegram_id;

    let user = sqlx::query!(
        "SELECT username, rating, photo_url, free_coins, xp, tournament_coins, uei.equipped_deck_id as equipped_deck, uei.equipped_background_id as equipped_background  FROM users u
         LEFT JOIN user_equipped_items uei
         ON uei.telegram_id = u.telegram_id
         WHERE u.telegram_id = $1",
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
                xp: record.xp,
                nuts: record.free_coins as u64,
                tournament_coins: record.tournament_coins as u64,
                equipped_deck: record.equipped_deck.unwrap_or_else(|| "classic".into()),
                equipped_background: record.equipped_background.unwrap_or_else(|| "neon".into()),
            };
            (StatusCode::OK, Json(response)).into_response()
        }
        Err(err) => {
            error!("DB error: {:?}", err);
            (StatusCode::INTERNAL_SERVER_ERROR, "Database error").into_response()
        }
    }
}
