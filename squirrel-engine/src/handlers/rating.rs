use axum::{
    extract::{Extension, Query},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tracing::error;

use crate::{core::context::AppContext, utils::jwt::AuthUser};

#[derive(Deserialize)]
pub struct RatingQuery {
    pub league: Option<String>,
}

#[derive(Serialize, Clone)]
pub struct LeaderboardUser {
    pub rank: i64,
    pub telegram_id: String,
    pub username: String,
    pub photo_url: Option<String>,
    pub rating: i32,
    pub league: String,
    pub is_me: bool,
}

#[derive(Serialize)]
pub struct LeaderboardResponse {
    pub top_players: Vec<LeaderboardUser>,
    pub my_player: Option<LeaderboardUser>,
    pub around_me: Vec<LeaderboardUser>,
}

pub fn calculate_league(rating: i32) -> String {
    if rating <= 500 {
        "Bronze".to_string()
    } else if rating <= 1000 {
        "Silver".to_string()
    } else if rating <= 2000 {
        "Gold".to_string()
    } else {
        "Diamond".to_string()
    }
}

pub async fn get_leaderboard(
    Extension(app_ctx): Extension<Arc<AppContext>>,
    auth_user: AuthUser,
    Query(query): Query<RatingQuery>,
) -> impl IntoResponse {
    let pool = &app_ctx.db_pool;
    let telegram_id_user: i64 = auth_user.telegram_id;
    let league_filter = query.league.unwrap_or_else(|| "All".to_string());

    let records = match sqlx::query!(
        r#"
        WITH RankedUsers AS (
            SELECT telegram_id, username, photo_url, rating,
                   ROW_NUMBER() OVER (ORDER BY rating DESC) as rank
            FROM users
            WHERE ($1 = 'All'
               OR ($1 = 'Bronze'  AND rating <= 500)
               OR ($1 = 'Silver'  AND rating > 500 AND rating <= 1000)
               OR ($1 = 'Gold'    AND rating > 1000 AND rating <= 2000)
               OR ($1 = 'Diamond' AND rating > 2000))
        ),
        MyRank AS (
            SELECT rank FROM RankedUsers WHERE telegram_id = $2
        )
        SELECT telegram_id, username, photo_url, rating, rank
        FROM RankedUsers
        WHERE rank <= 50
           OR (rank >= COALESCE((SELECT rank FROM MyRank), 0) - 2 
           AND rank <= COALESCE((SELECT rank FROM MyRank), 0) + 2)
           OR telegram_id = $2
        ORDER BY rank ASC;
        "#,
        league_filter,
        telegram_id_user
    )
    .fetch_all(pool)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            error!("Database error calculating leaderboard: {:?}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, "Database error").into_response();
        }
    };

    let mut top_players = Vec::new();
    let mut around_me = Vec::new();
    let mut my_player = None;

    for r in records {
        let mut username = r.username.unwrap_or_else(|| "anon".to_string());
        if username.trim().is_empty() {
            username = "anon".to_string();
        }

        let rank = r.rank.unwrap_or(0);
        let is_me = r.telegram_id == telegram_id_user;
        let is_top = rank <= 50;
        let is_around_my_rank = my_player.as_ref().map_or(
            // if we haven't seen my_player yet, we can't perfectly filter `around_me` yet,
            // but we can trust the SQL output that if it's not top_players, it must be around_me or myself
            !is_top,
            |_| !is_top,
        );

        let user = LeaderboardUser {
            rank,
            telegram_id: r.telegram_id.to_string(),
            username,
            photo_url: r.photo_url,
            rating: r.rating,
            league: calculate_league(r.rating),
            is_me,
        };

        if user.is_me {
            my_player = Some(user.clone());
        }

        if is_top {
            top_players.push(user.clone());
        } else if is_around_my_rank && !user.is_me {
            around_me.push(user.clone());
        }
    }

    let response = LeaderboardResponse {
        top_players,
        my_player,
        around_me,
    };

    (StatusCode::OK, Json(response)).into_response()
}
