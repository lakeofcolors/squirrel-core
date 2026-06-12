use axum::{extract::{Extension, Path}, http::StatusCode, Json};
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
pub struct AchievementDto {
    pub key: String,
    pub title: String,
    pub description: String,
    pub icon_url: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UserInfoDto {
    pub id: i64,
    pub username: String,
    pub photo_url: Option<String>,
    pub rating: i32,
    pub xp: i32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileResponseDto {
    pub user: UserInfoDto,
    pub stats: ProfileStatsDto,
    pub history: Vec<MatchHistoryDto>,
    pub rewards: Vec<RewardDto>,
    pub achievements: Vec<AchievementDto>,
    pub clan: Option<crate::handlers::clans::ClanDto>,
}

pub async fn get_profile(
    auth_user: AuthUser,
    Extension(app_ctx): Extension<Arc<AppContext>>,
) -> Result<Json<ProfileResponseDto>, (StatusCode, String)> {
    let telegram_id = auth_user.telegram_id;
    let pool = &app_ctx.db_pool;

    let user_row = sqlx::query!("SELECT username, photo_url, rating, xp FROM users WHERE telegram_id = $1", telegram_id)
        .fetch_optional(pool)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Failed to fetch user".to_string()))?;

    let user_data = match user_row {
        Some(u) => u,
        None => return Err((StatusCode::NOT_FOUND, "User not found".to_string())),
    };

    let user_info = UserInfoDto {
        id: telegram_id,
        username: user_data.username.unwrap_or_default(),
        photo_url: user_data.photo_url,
        rating: user_data.rating,
        xp: user_data.xp,
    };

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

    // 4. Achievements
    let ach_rows = sqlx::query(
        r#"
        SELECT a.key, a.title, a.description, a.icon_url
        FROM user_achievements ua
        JOIN achievements a ON a.key = ua.achievement_key
        WHERE ua.telegram_id = $1
        ORDER BY ua.unlocked_at DESC
        "#
    )
    .bind(telegram_id)
    .fetch_all(pool)
    .await
    .unwrap_or(vec![]);

    let mut achievements = vec![];
    for row in ach_rows {
        achievements.push(AchievementDto {
            key: row.try_get("key").unwrap_or_default(),
            title: row.try_get("title").unwrap_or_default(),
            description: row.try_get("description").unwrap_or_default(),
            icon_url: row.try_get("icon_url").unwrap_or_default(),
        });
    }

    // 5. Clan
    let clan_row = sqlx::query(
        r#"
        SELECT c.id, c.name, c.tag, c.owner_id, c.rating, c.trophies,
               (SELECT COUNT(*) FROM clan_members WHERE clan_id = c.id) as members_count
        FROM clan_members cm
        JOIN clans c ON c.id = cm.clan_id
        WHERE cm.telegram_id = $1
        "#
    )
    .bind(telegram_id)
    .fetch_optional(pool)
    .await
    .unwrap_or(None);

    let clan = if let Some(row) = clan_row {
        Some(crate::handlers::clans::ClanDto {
            id: row.try_get("id").unwrap_or(0),
            name: row.try_get("name").unwrap_or_default(),
            tag: row.try_get("tag").unwrap_or_default(),
            owner_id: row.try_get("owner_id").unwrap_or(0),
            rating: row.try_get("rating").unwrap_or(0),
            trophies: row.try_get("trophies").unwrap_or(0),
            members_count: row.try_get("members_count").unwrap_or(0),
        })
    } else {
        None
    };

    Ok(Json(ProfileResponseDto {
        user: user_info,
        stats,
        history,
        rewards,
        achievements,
        clan,
    }))
}

pub async fn get_public_profile(
    Path(target_id): Path<i64>,
    Extension(app_ctx): Extension<Arc<AppContext>>,
) -> Result<Json<ProfileResponseDto>, (StatusCode, String)> {
    let pool = &app_ctx.db_pool;

    // Fetch user details
    let user_row = sqlx::query!("SELECT username, photo_url, rating, xp FROM users WHERE telegram_id = $1", target_id)
        .fetch_optional(pool)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Failed to check user".to_string()))?;

    let user_data = match user_row {
        Some(u) => u,
        None => return Err((StatusCode::NOT_FOUND, "User not found".to_string())),
    };

    let user_info = UserInfoDto {
        id: target_id,
        username: user_data.username.unwrap_or_default(),
        photo_url: user_data.photo_url,
        rating: user_data.rating,
        xp: user_data.xp,
    };

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
    .bind(target_id)
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
    .bind(target_id)
    .fetch_one(pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Failed to get rank".to_string()))?;

    let rank_place: i64 = rank_row.try_get("rnk").unwrap_or(0);

    let stats = ProfileStatsDto {
        matches,
        wins,
        winrate,
        best_streak: 0, 
        rank_place,
        favorite_mode: "Ranked 2v2".into(),
        season_progress: 50,
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
    .bind(target_id)
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
    .bind(target_id)
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

    // 4. Achievements
    let ach_rows = sqlx::query(
        r#"
        SELECT a.key, a.title, a.description, a.icon_url
        FROM user_achievements ua
        JOIN achievements a ON a.key = ua.achievement_key
        WHERE ua.telegram_id = $1
        ORDER BY ua.unlocked_at DESC
        "#
    )
    .bind(target_id)
    .fetch_all(pool)
    .await
    .unwrap_or(vec![]);

    let mut achievements = vec![];
    for row in ach_rows {
        achievements.push(AchievementDto {
            key: row.try_get("key").unwrap_or_default(),
            title: row.try_get("title").unwrap_or_default(),
            description: row.try_get("description").unwrap_or_default(),
            icon_url: row.try_get("icon_url").unwrap_or_default(),
        });
    }

    // 5. Clan
    let clan_row = sqlx::query(
        r#"
        SELECT c.id, c.name, c.tag, c.owner_id, c.rating, c.trophies,
               (SELECT COUNT(*) FROM clan_members WHERE clan_id = c.id) as members_count
        FROM clan_members cm
        JOIN clans c ON c.id = cm.clan_id
        WHERE cm.telegram_id = $1
        "#
    )
    .bind(target_id)
    .fetch_optional(pool)
    .await
    .unwrap_or(None);

    let clan = if let Some(row) = clan_row {
        Some(crate::handlers::clans::ClanDto {
            id: row.try_get("id").unwrap_or(0),
            name: row.try_get("name").unwrap_or_default(),
            tag: row.try_get("tag").unwrap_or_default(),
            owner_id: row.try_get("owner_id").unwrap_or(0),
            rating: row.try_get("rating").unwrap_or(0),
            trophies: row.try_get("trophies").unwrap_or(0),
            members_count: row.try_get("members_count").unwrap_or(0),
        })
    } else {
        None
    };

    Ok(Json(ProfileResponseDto {
        user: user_info,
        stats,
        history,
        rewards,
        achievements,
        clan,
    }))
}
