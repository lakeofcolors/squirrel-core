use axum::{extract::Extension, http::StatusCode, Json};
use rand::{distributions::WeightedIndex, prelude::Distribution, rngs::OsRng};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use std::sync::Arc;
use chrono::Utc;

use crate::{
    core::context::AppContext,
    utils::jwt::AuthUser,
};

#[derive(Serialize)]
pub struct SpinRewardDto {
    pub id: i32,
    pub name: String,
    pub reward_type: String,
    pub item_id: Option<String>,
    pub amount: i32,
    pub hex_color: String,
    pub icon_emoji: String,
}

#[derive(Serialize)]
pub struct SpinInfoResponse {
    pub items: Vec<SpinRewardDto>,
    pub next_free_spin_in_seconds: i64,
}

pub async fn get_spin_info(
    auth_user: AuthUser,
    Extension(app_ctx): Extension<Arc<AppContext>>,
) -> Result<Json<SpinInfoResponse>, (StatusCode, String)> {
    let pool = &app_ctx.db_pool;

    // Auto-fix the database if the old 'secret_avatar' is still there (since user already created tables)
    let _ = sqlx::query("UPDATE lucky_spin_rewards SET name = 'Стол: Неоновый', item_id = 'neon_table', icon_emoji = '✨' WHERE item_id = 'secret_avatar'")
        .execute(pool)
        .await;

    let items_rows = sqlx::query(
        "SELECT id, name, reward_type, item_id, amount, weight, hex_color, icon_emoji FROM lucky_spin_rewards ORDER BY id ASC"
    )
    .fetch_all(pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Failed to fetch rewards".to_string()))?;

    let mut items = Vec::new();
    for row in items_rows {
        items.push(SpinRewardDto {
            id: row.get("id"),
            name: row.get("name"),
            reward_type: row.get("reward_type"),
            item_id: row.get("item_id"),
            amount: row.get("amount"),
            hex_color: row.get("hex_color"),
            icon_emoji: row.get("icon_emoji"),
        });
    }

    let spin_row = sqlx::query(
        "SELECT last_free_spin_at FROM user_lucky_spins WHERE telegram_id = $1"
    )
    .bind(auth_user.telegram_id)
    .fetch_optional(pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "DB Error".to_string()))?;

    let mut next_free_spin_in_seconds = 0;
    if let Some(r) = spin_row {
        let last_spin: Option<chrono::DateTime<Utc>> = r.get("last_free_spin_at");
        if let Some(last) = last_spin {
            let elapsed = Utc::now().signed_duration_since(last).num_seconds();
            if elapsed < 86400 {
                next_free_spin_in_seconds = 86400 - elapsed;
            }
        }
    }

    Ok(Json(SpinInfoResponse {
        items,
        next_free_spin_in_seconds,
    }))
}

#[derive(Deserialize)]
pub struct DrawRequest {
    pub use_free: bool,
}

#[derive(Serialize)]
pub struct DrawResponse {
    pub reward_id: i32,
    pub is_free: bool,
}

pub async fn draw_spin(
    auth_user: AuthUser,
    Extension(app_ctx): Extension<Arc<AppContext>>,
    Json(payload): Json<DrawRequest>,
) -> Result<Json<DrawResponse>, (StatusCode, String)> {
    let pool = &app_ctx.db_pool;
    
    // Check spin availability
    let mut tx = pool.begin().await.map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "DB tx start error".to_string()))?;

    let spin_row = sqlx::query(
        "SELECT last_free_spin_at FROM user_lucky_spins WHERE telegram_id = $1 FOR UPDATE"
    )
    .bind(auth_user.telegram_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "DB Error".to_string()))?;

    let mut can_spin_free = true;
    if let Some(r) = &spin_row {
        let last_spin: Option<chrono::DateTime<Utc>> = r.get("last_free_spin_at");
        if let Some(last) = last_spin {
            let elapsed = Utc::now().signed_duration_since(last).num_seconds();
            if elapsed < 86400 {
                can_spin_free = false;
            }
        }
    }

    if payload.use_free {
        if !can_spin_free {
            return Err((StatusCode::BAD_REQUEST, "Free spin not yet available".to_string()));
        }
    } else {
        // deduct 500 nuts
        let user_row = sqlx::query("SELECT free_coins FROM users WHERE telegram_id = $1")
            .bind(auth_user.telegram_id)
            .fetch_one(&mut *tx)
            .await
            .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "User not found".to_string()))?;
        
        let nuts: i32 = user_row.get("free_coins");
        if nuts < 500 {
            return Err((StatusCode::BAD_REQUEST, "Not enough nuts".to_string()));
        }

        sqlx::query("UPDATE users SET free_coins = free_coins - 500 WHERE telegram_id = $1")
            .bind(auth_user.telegram_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to deduct nuts: {}", e)))?;
    }

    // Select reward
    let rewards = sqlx::query(
        "SELECT id, reward_type, item_id, amount, weight FROM lucky_spin_rewards ORDER BY id ASC"
    )
    .fetch_all(&mut *tx)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Failed to fetch rewards".to_string()))?;

    let weights: Vec<i32> = rewards.iter().map(|r| r.get("weight")).collect();
    let dist = WeightedIndex::new(&weights).map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Weight calculation error".to_string()))?;
    let mut rng = OsRng;
    let selected_idx = dist.sample(&mut rng);
    let selected_reward = &rewards[selected_idx];

    let reward_id: i32 = selected_reward.get("id");
    let r_type: String = selected_reward.get("reward_type");
    let amount: i32 = selected_reward.get("amount");
    let item_id: Option<String> = selected_reward.get("item_id");

    // Give reward
    if r_type == "nuts" {
        sqlx::query("UPDATE users SET free_coins = free_coins + $1 WHERE telegram_id = $2")
            .bind(amount)
            .bind(auth_user.telegram_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to grant nuts: {}", e)))?;
    } else if r_type == "cosmetic" {
        if let Some(i_id) = item_id {
            if i_id.contains("chest") {
                let chest_type = if i_id.contains("rare") { "rare" } else if i_id.contains("epic") { "epic" } else if i_id.contains("legendary") { "legendary" } else { "common" };
                sqlx::query(
                    "INSERT INTO user_chests (telegram_id, chest_type, amount, updated_at) VALUES ($1, $2, $3, NOW()) ON CONFLICT (telegram_id, chest_type) DO UPDATE SET amount = user_chests.amount + $3, updated_at = NOW()"
                )
                .bind(auth_user.telegram_id)
                .bind(chest_type)
                .bind(amount)
                .execute(&mut *tx)
                .await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to grant chest: {}", e)))?;
            } else {
                let i_type = if i_id.contains("deck") {
                    "deck"
                } else if i_id.contains("table") || i_id.contains("background") {
                    "background"
                } else {
                    "taunt" // fallback to taunt for anything else (e.g. avatars) to pass constraint
                };

                for _ in 0..amount {
                    sqlx::query(
                        "INSERT INTO user_inventory (telegram_id, item_type, item_id, created_at) VALUES ($1, $2, $3, NOW()) ON CONFLICT DO NOTHING"
                    )
                    .bind(auth_user.telegram_id)
                    .bind(i_type)
                    .bind(&i_id)
                    .execute(&mut *tx)
                    .await
                    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to grant cosmetic: {}", e)))?;
                }
            }
        }
    }

    // Update spin timestamp if used free
    if payload.use_free {
        sqlx::query(
            "INSERT INTO user_lucky_spins (telegram_id, last_free_spin_at) VALUES ($1, $2) ON CONFLICT (telegram_id) DO UPDATE SET last_free_spin_at = EXCLUDED.last_free_spin_at"
        )
        .bind(auth_user.telegram_id)
        .bind(Utc::now())
        .execute(&mut *tx)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Failed to record spin".to_string()))?;
    }

    tx.commit().await.map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Failed to commit".to_string()))?;

    Ok(Json(DrawResponse {
        reward_id,
        is_free: payload.use_free,
    }))
}
