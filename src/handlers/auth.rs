use axum::{extract::{Json, State}, response::IntoResponse, http::StatusCode};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::sync::Arc;

use crate::utils::jwt::{generate_token, validate_token};

#[derive(Deserialize)]
pub struct LoginRequest {
    username: String,
    password: String,
}

#[derive(Deserialize)]
pub struct MeRequest {
    token: String,
}

#[derive(Serialize)]
pub struct MeResponse{
    username: String,
    rating: u64,
}

#[derive(Serialize)]
pub struct TokenResponse {
    access_token: String,
    refresh_token: String,
}

pub async fn login(
    State(pool): State<Arc<PgPool>>,
    Json(payload): Json<LoginRequest>
) -> impl IntoResponse {
    match authenticate_user(&pool, &payload.username, &payload.password).await {
        Ok(true) => {
            match (
                generate_token(&payload.username, Some(3600)),       // 1 час
                generate_token(&payload.username, Some(7 * 24 * 3600)) // 7 дней
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
        Ok(false) => (StatusCode::UNAUTHORIZED, "Invalid credentials").into_response(),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Database error").into_response(),
    }
}

pub async fn me(
    Json(payload): Json<MeRequest>
) -> impl IntoResponse{
    match validate_token(&payload.token) {
        Ok(claims) => {
            let response = MeResponse{
                username: claims.sub,
                rating: 99,
            };
            (StatusCode::OK, Json(response)).into_response()
        },
        Err(_) => (StatusCode::METHOD_NOT_ALLOWED, "Incorect token").into_response()
    }
}

async fn authenticate_user(pool: &PgPool, username: &str, password: &str) -> Result<bool, sqlx::Error> {
    let user = sqlx::query!(
        "SELECT password FROM users WHERE username = $1",
        username
    )
    .fetch_optional(pool)
    .await?;

    if let Some(user) = user {
        return Ok(user.password == password);
    }

    Ok(false)
}
