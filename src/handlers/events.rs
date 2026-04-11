use axum::{
    extract::{Extension, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use sqlx::PgPool;

use crate::{
    core::context::AppContext,
    utils::jwt::AuthUser,
};

#[derive(Serialize)]
pub struct QuestDto {
    pub id: i32,
    pub quest_type: String,
    pub title: String,
    pub target_amount: i32,
    pub reward_type: String,
    pub reward_amount: i32,
    pub current_amount: i32,
    pub is_completed: bool,
    pub is_claimed: bool,
}

#[derive(Serialize)]
pub struct EventDto {
    pub id: i32,
    pub event_key: String,
    pub title: String,
    pub description: String,
    pub currency_icon: String,
    pub currency_balance: i32,
    pub start_time: String,
    pub end_time: String,
    pub quests: Vec<QuestDto>,
}

pub async fn get_active_event(
    auth_user: AuthUser,
    Extension(app_ctx): Extension<Arc<AppContext>>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let pool = &app_ctx.db_pool;
    let user_id = auth_user.telegram_id;

    // Fetch active event
    let event = sqlx::query!(
        "SELECT id, key as event_key, title, description, currency_icon, start_time, end_time 
         FROM events 
         WHERE is_active = TRUE AND start_time <= NOW() AND end_time >= NOW() 
         ORDER BY id DESC LIMIT 1"
    ).fetch_optional(pool).await.map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "DB Error".into()))?;

    let event = match event {
        Some(e) => e,
        None => return Ok((StatusCode::OK, Json(serde_json::json!({ "event": null })))),
    };

    // Currency balance
    let currency_row = sqlx::query!(
        "SELECT amount FROM user_event_currency WHERE telegram_id = $1 AND event_id = $2",
        user_id, event.id
    ).fetch_optional(pool).await.map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "DB Error".into()))?;
    
    let currency_balance = currency_row.map(|r| r.amount).unwrap_or(0);

    // Fetch quests 
    // And initialize user_quest_progress if missing
    let quests = sqlx::query!(
        "SELECT q.id, q.quest_type, q.title, q.target_amount, q.reward_type, q.reward_amount, 
                COALESCE(uqp.current_amount, 0) as current_amount, 
                COALESCE(uqp.is_completed, FALSE) as is_completed, 
                COALESCE(uqp.is_claimed, FALSE) as is_claimed
         FROM event_quests q
         LEFT JOIN user_quest_progress uqp ON q.id = uqp.quest_id AND uqp.telegram_id = $1
         WHERE q.event_id = $2
         ORDER BY q.sort_order ASC, q.id ASC",
         user_id, event.id
    ).fetch_all(pool).await.map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "DB Error".into()))?;

    // Create user_quest_progress if it doesn't exist
    for q in &quests {
        let _ = sqlx::query!(
            "INSERT INTO user_quest_progress (telegram_id, quest_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
            user_id, q.id
        ).execute(pool).await;
    }

    let mut quest_dtos = Vec::new();
    for q in quests {
        quest_dtos.push(QuestDto {
            id: q.id,
            quest_type: q.quest_type,
            title: q.title,
            target_amount: q.target_amount,
            reward_type: q.reward_type,
            reward_amount: q.reward_amount,
            current_amount: q.current_amount.unwrap_or(0),
            is_completed: q.is_completed.unwrap_or(false),
            is_claimed: q.is_claimed.unwrap_or(false),
        });
    }

    let res = EventDto {
        id: event.id,
        event_key: event.event_key,
        title: event.title,
        description: event.description,
        currency_icon: event.currency_icon,
        currency_balance,
        start_time: event.start_time.to_rfc3339(),
        end_time: event.end_time.to_rfc3339(),
        quests: quest_dtos,
    };

    Ok((StatusCode::OK, Json(serde_json::json!({ "event": res }))))
}

#[derive(Deserialize)]
pub struct ClaimQuestPayload {
    pub quest_id: i32,
}

pub async fn claim_quest(
    auth_user: AuthUser,
    Extension(app_ctx): Extension<Arc<AppContext>>,
    Json(payload): Json<ClaimQuestPayload>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let pool = &app_ctx.db_pool;
    let user_id = auth_user.telegram_id;
    let quest_id = payload.quest_id;

    let mut tx = pool.begin().await.map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "DB Error".into()))?;

    let quest_check = sqlx::query!(
        "SELECT eq.reward_type, eq.reward_amount, eq.event_id, uqp.is_completed, uqp.is_claimed 
         FROM event_quests eq
         JOIN user_quest_progress uqp ON eq.id = uqp.quest_id
         WHERE eq.id = $1 AND uqp.telegram_id = $2 FOR UPDATE",
         quest_id, user_id
    ).fetch_optional(&mut *tx).await.map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "DB Error".into()))?;

    let quest = match quest_check {
        Some(q) => q,
        None => return Err((StatusCode::BAD_REQUEST, "Quest not found".into())),
    };

    if !quest.is_completed {
        return Err((StatusCode::BAD_REQUEST, "Quest not completed".into()));
    }
    if quest.is_claimed {
        return Err((StatusCode::BAD_REQUEST, "Quest already claimed".into()));
    }

    // Mark claimed
    let _ = sqlx::query!(
        "UPDATE user_quest_progress SET is_claimed = TRUE WHERE telegram_id = $1 AND quest_id = $2",
        user_id, quest_id
    ).execute(&mut *tx).await;

    // Grant reward
    match quest.reward_type.as_str() {
        "event_currency" => {
            let _ = sqlx::query!(
                "INSERT INTO user_event_currency (telegram_id, event_id, amount) VALUES ($1, $2, $3) 
                 ON CONFLICT (telegram_id, event_id) DO UPDATE SET amount = user_event_currency.amount + $3",
                 user_id, quest.event_id, quest.reward_amount
            ).execute(&mut *tx).await;
        },
        "nuts" => {
             let _ = sqlx::query!(
                "UPDATE users SET free_coins = free_coins + $1 WHERE telegram_id = $2",
                 quest.reward_amount, user_id
            ).execute(&mut *tx).await;
        },
        "xp" => {
             let _ = sqlx::query!(
                "UPDATE users SET xp = xp + $1 WHERE telegram_id = $2",
                 quest.reward_amount, user_id
            ).execute(&mut *tx).await;
        },
        "chest" => {
            let chest_type = "common"; // In real implementation, dynamic based on quest
            let _ = sqlx::query!(
                "INSERT INTO user_chests (telegram_id, chest_type, amount) VALUES ($1, $2, $3) 
                 ON CONFLICT (telegram_id, chest_type) DO UPDATE SET amount = user_chests.amount + $3",
                 user_id, chest_type, quest.reward_amount
            ).execute(&mut *tx).await;
        },
        _ => {}
    }

    tx.commit().await.map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "DB Error".into()))?;

    Ok((StatusCode::OK, Json(serde_json::json!({ "success": true }))))
}
