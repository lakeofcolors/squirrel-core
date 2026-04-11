use axum::{extract::Extension, http::StatusCode, Json, response::IntoResponse};
use serde::Serialize;
use std::sync::Arc;
use sqlx::PgPool;

use crate::{core::context::AppContext, utils::jwt::AuthUser};

#[derive(Serialize)]
pub struct DailyRewardResponse {
    pub day: i32,
    pub reward_type: String, // 'nuts' or 'chest'
    pub amount: Option<i32>,
    pub chest_type: Option<String>,
}

#[axum::debug_handler]
pub async fn claim_daily_reward(
    auth_user: AuthUser,
    Extension(app_ctx): Extension<Arc<AppContext>>,
) -> impl IntoResponse {
    let user_id = auth_user.telegram_id;

    let mut tx = match app_ctx.db_pool.begin().await {
        Ok(t) => t,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "DB Error").into_response(),
    };

    let user_row = sqlx::query!(
        "SELECT last_daily_claim, daily_streak FROM users WHERE telegram_id = $1 FOR UPDATE",
        user_id
    )
    .fetch_optional(&mut *tx)
    .await;

    let user_row = match user_row {
        Ok(Some(row)) => row,
        _ => return (StatusCode::NOT_FOUND, "User not found").into_response(),
    };

    let now = chrono::Utc::now();
    let mut current_streak = user_row.daily_streak;

    if let Some(last_claim) = user_row.last_daily_claim {
        let hours_passed = (now - last_claim).num_hours();
        if hours_passed < 20 {
            // Can't claim yet
            return (StatusCode::BAD_REQUEST, "Too early").into_response();
        } else if hours_passed > 48 {
            // Streak broken
            current_streak = 0;
        }
    }

    // Give reward for `current_streak + 1`
    let day = (current_streak % 7) + 1;
    
    let mut reward_type = "nuts".to_string();
    let mut amount = None;
    let mut chest_type = None;

    match day {
        1 => amount = Some(50),
        2 => amount = Some(150),
        3 => { reward_type = "chest".to_string(); chest_type = Some("common".to_string()); },
        4 => amount = Some(300),
        5 => amount = Some(500),
        6 => { reward_type = "chest".to_string(); chest_type = Some("rare".to_string()); },
        7 => { reward_type = "chest".to_string(); chest_type = Some("epic".to_string()); },
        _ => amount = Some(50),
    }

    if reward_type == "nuts" {
        let nuts_earned = amount.unwrap();
        let _ = sqlx::query!(
            "UPDATE users SET free_coins = free_coins + $1 WHERE telegram_id = $2",
            nuts_earned as i32, user_id
        )
        .execute(&mut *tx)
        .await;
    } else {
        let chest = chest_type.clone().unwrap();
        let _ = sqlx::query!(
            "INSERT INTO user_chests (telegram_id, chest_type, amount) VALUES ($1, $2, 1) ON CONFLICT (telegram_id, chest_type) DO UPDATE SET amount = user_chests.amount + 1",
            user_id, chest
        )
        .execute(&mut *tx)
        .await;
    }

    let _ = sqlx::query!(
        "UPDATE users SET last_daily_claim = $1, daily_streak = $2 WHERE telegram_id = $3",
        now, current_streak + 1, user_id
    )
    .execute(&mut *tx)
    .await;

    if let Err(e) = tx.commit().await {
        return (StatusCode::INTERNAL_SERVER_ERROR, "Commit Err").into_response();
    }

    (StatusCode::OK, Json(DailyRewardResponse {
        day,
        reward_type,
        amount,
        chest_type,
    })).into_response()
}

pub async fn get_daily_status(
    auth_user: AuthUser,
    Extension(app_ctx): Extension<Arc<AppContext>>,
) -> impl IntoResponse {
    let user_id = auth_user.telegram_id;

    let user_row = sqlx::query!(
        "SELECT last_daily_claim, daily_streak FROM users WHERE telegram_id = $1",
        user_id
    )
    .fetch_optional(&app_ctx.db_pool)
    .await;

    if let Ok(Some(row)) = user_row {
        let now = chrono::Utc::now();
        let mut can_claim = false;
        let mut hours_until = 0;
        let mut current_streak = row.daily_streak;

        if let Some(last_claim) = row.last_daily_claim {
            let diff = now - last_claim;
            let hours_passed = diff.num_hours();
            if hours_passed >= 20 {
                can_claim = true;
                if hours_passed > 48 {
                    current_streak = 0; // broken
                }
            } else {
                hours_until = 20 - hours_passed;
            }
        } else {
            can_claim = true;
        }

        let day = (current_streak % 7) + 1;

        return (StatusCode::OK, Json(serde_json::json!({
            "can_claim": can_claim,
            "hours_until": hours_until,
            "next_day": day,
            "current_streak": row.daily_streak,
        }))).into_response();
    }

    (StatusCode::NOT_FOUND, "User not found").into_response()
}
