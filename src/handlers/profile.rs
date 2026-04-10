use axum::{extract::Extension, http::StatusCode, Json};
use serde::Serialize;
use std::sync::Arc;
use crate::{core::context::AppContext, utils::jwt::AuthUser};
use sqlx::Row;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileStatsDto {
    pub matches: i64,
    pub wins: i64,
    pub winrate: String,
    pub best_streak: i64, // Hard to calculate in SQL easily, so we can mock or do a simple estimate
    pub rank_place: i64,
    pub favorite_mode: String,
    pub season_progress: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MatchHistoryDto {
    pub id: i64,
    pub result: String,
    pub mode: String,
    pub score: String,
    pub rating_delta: String,
    pub time: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RewardDto {
    pub id: i64,
    pub title: String,
    pub icon: String,
    pub rarity: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileResponseDto {
    pub stats: ProfileStatsDto,
    pub history: Vec<MatchHistoryDto>,
    pub rewards: Vec<RewardDto>,
}

pub async fn get_profile(
    auth_user: AuthUser,
    Extension(app_ctx): Extension<Arc<AppContext>>,
) -> Result<Json<ProfileResponseDto>, (StatusCode, String)> {
    let telegram_id = auth_user.telegram_id;
    let pool = &app_ctx.db_pool;

    // 1. Stats
    let stats_row = sqlx::query(
        r#"
        SELECT
            COUNT(id) as total_matches,
            COALESCE(SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END), 0) as total_wins
        FROM match_history
        WHERE telegram_id = $1
        "#
    )
    .bind(telegram_id)
    .fetch_one(pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Failed to get stats".to_string()))?;

    let matches: i64 = stats_row.try_get("total_matches").unwrap_or(0);
    let wins: i64 = stats_row.try_get("total_wins").unwrap_or(0);
    
    let winrate = if matches > 0 {
        format!("{}%", (wins as f64 / matches as f64 * 100.0).round() as i64)
    } else {
        "0%".to_string()
    };

    // calculate rank
    let rank_row = sqlx::query(
        r#"
        WITH ranked AS (
            SELECT telegram_id, rating, RANK() OVER(ORDER BY rating DESC) as rnk
            FROM users
        )
        SELECT rnk FROM ranked WHERE telegram_id = $1
        "#
    )
    .bind(telegram_id)
    .fetch_one(pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Failed to get rank".to_string()))?;

    let rank_place: i64 = rank_row.try_get("rnk").unwrap_or(0);

    let stats = ProfileStatsDto {
        matches,
        wins,
        winrate,
        best_streak: 0, // placeholder
        rank_place,
        favorite_mode: "Ranked 2v2".into(), // placeholder
        season_progress: 50, // placeholder
    };

    // 2. History
    let history_rows = sqlx::query(
        r#"
        SELECT 
            match_id as id, result, mode, score, rating_delta, to_char(created_at, 'DD.MM.YYYY') as created_at_str
        FROM match_history
        WHERE telegram_id = $1
        ORDER BY created_at DESC
        LIMIT 10
        "#
    )
    .bind(telegram_id)
    .fetch_all(pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Failed to get history".to_string()))?;

    let mut history = vec![];
    for row in history_rows {
        let delta: i32 = row.try_get("rating_delta").unwrap_or(0);
        let delta_str = if delta > 0 { format!("+{}", delta) } else { delta.to_string() };
        
        let time: String = row.try_get("created_at_str").unwrap_or_else(|_| "—".into());

        history.push(MatchHistoryDto {
            id: row.try_get("id").unwrap_or(0),
            result: row.try_get("result").unwrap_or_else(|_| "unknown".into()),
            mode: row.try_get("mode").unwrap_or_else(|_| "Casual".into()),
            score: row.try_get("score").unwrap_or_else(|_| "—".into()),
            rating_delta: delta_str,
            time,
        });
    }

    // 3. Rewards
    let rewards_rows = sqlx::query(
        r#"
        SELECT id, title, icon, rarity
        FROM user_rewards
        WHERE telegram_id = $1
        ORDER BY unlocked_at DESC
        "#
    )
    .bind(telegram_id)
    .fetch_all(pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Failed to get rewards".to_string()))?;

    let mut rewards = vec![];
    for row in rewards_rows {
        rewards.push(RewardDto {
            id: row.try_get("id").unwrap_or(0),
            title: row.try_get("title").unwrap_or_else(|_| "".into()),
            icon: row.try_get("icon").unwrap_or_else(|_| "".into()),
            rarity: row.try_get("rarity").unwrap_or_else(|_| "Common".into()),
        });
    }

    Ok(Json(ProfileResponseDto {
        stats,
        history,
        rewards,
    }))
}
