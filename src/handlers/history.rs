use axum::{extract::{Extension, Path}, http::StatusCode, Json};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use crate::{core::context::AppContext, utils::{schemas::GameReplayEvent, jwt::AuthUser}};
use sqlx::Row;

#[derive(Serialize)]
pub struct ReplayPlayer {
    pub telegram_id: i64,
    pub username: Option<String>,
    pub avatar: Option<String>,
    pub team: String,
}

#[derive(Serialize)]
pub struct ReplayResponse {
    pub match_id: i64,
    pub events: Vec<serde_json::Value>,
    pub players: Vec<ReplayPlayer>,
}

pub async fn get_match_replay(
    auth_user: AuthUser,
    Path(match_id): Path<i64>,
    Extension(app_ctx): Extension<Arc<AppContext>>,
) -> Result<Json<ReplayResponse>, (StatusCode, String)> {
    let pool = &app_ctx.db_pool;

    let row = sqlx::query(
        "SELECT replay_events FROM matches WHERE id = $1"
    )
    .bind(match_id)
    .fetch_optional(pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Failed to query match".to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Match not found".to_string()))?;

    let replay_events: sqlx::types::Json<Vec<serde_json::Value>> = row.try_get("replay_events").unwrap_or_else(|_| sqlx::types::Json(vec![]));

    let players_rows = sqlx::query(
        r#"
        SELECT mp.telegram_id, mp.team, u.username, u.photo_url 
        FROM match_players mp
        LEFT JOIN users u ON u.telegram_id = mp.telegram_id
        WHERE mp.match_id = $1
        "#
    )
    .bind(match_id)
    .fetch_all(pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Failed to fetch players".to_string()))?;

    let mut players = Vec::new();
    for r in players_rows {
        let telegram_id: i64 = r.try_get("telegram_id").unwrap_or(0);
        let db_username: Option<String> = r.try_get("username").unwrap_or(None);
        
        let final_username = db_username.or_else(|| {
            if telegram_id < 0 {
                Some(format!("Bot {}", telegram_id.abs()))
            } else {
                None
            }
        });

        players.push(ReplayPlayer {
            telegram_id,
            username: final_username,
            avatar: r.try_get("photo_url").unwrap_or(None),
            team: r.try_get("team").unwrap_or_else(|_| "Unknown".into()),
        });
    }

    Ok(Json(ReplayResponse {
        match_id,
        events: replay_events.0,
        players,
    }))
}
