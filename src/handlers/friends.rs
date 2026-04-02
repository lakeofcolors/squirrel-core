use axum::{extract::Extension, http::StatusCode, Json};
use serde::Serialize;
use std::sync::Arc;
use crate::{core::context::AppContext, utils::jwt::AuthUser, core::pool::PlayerStatus};
use sqlx::Row;

#[derive(Serialize)]
pub struct FriendDto {
    pub id: i64,
    pub name: String,
    pub league: String,
    pub online: bool,
    pub status: String,
    pub avatar: String,
}

pub async fn get_friends(
    auth_user: AuthUser,
    Extension(app_ctx): Extension<Arc<AppContext>>,
) -> Result<Json<Vec<FriendDto>>, (StatusCode, String)> {
    let friends_rows = sqlx::query(
        r#"
        SELECT
            u.telegram_id,
            u.username,
            u.photo_url,
            u.rating
        FROM user_friends uf
        JOIN users u ON u.telegram_id = uf.friend_telegram_id
        WHERE uf.user_telegram_id = $1
        "#
    )
    .bind(auth_user.telegram_id)
    .fetch_all(&app_ctx.db_pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch friends: {:?}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, "Failed to fetch friends".to_string())
    })?;

    let mut friends = Vec::new();

    for row in friends_rows {
        let name: Option<String> = row.try_get("username").unwrap_or(None);
        let photo_url: Option<String> = row.try_get("photo_url").unwrap_or(None);
        let name_str = name.unwrap_or_else(|| "anon".to_string());
        let avatar = photo_url.unwrap_or_else(|| format!("https://api.dicebear.com/7.x/thumbs/svg?seed={}", name_str));
        let rating: i32 = row.try_get("rating").unwrap_or(0);

        let league = if rating < 500 {
            "Bronze"
        } else if rating < 1500 {
            "Silver"
        } else if rating < 3000 {
            "Gold"
        } else {
            "Diamond"
        };

        let friend_id: i64 = row.try_get("telegram_id").unwrap();

        let mut online = false;
        let mut status_str = "Офлайн".to_string();

        if let Some(session) = app_ctx.connection_pool().get(&friend_id) {
            let status = session.status.read().await;
            match *status {
                PlayerStatus::Connected => {
                    online = true;
                    status_str = "В лобби".to_string();
                }
                PlayerStatus::InQueue => {
                    online = true;
                    status_str = "В поиске игры".to_string();
                }
                PlayerStatus::InGame { .. } => {
                    online = true;
                    status_str = "Играет матч".to_string();
                }
                PlayerStatus::Disconnected => {
                    online = false;
                    status_str = "Недавно был(а)".to_string();
                }
            }
        }

        friends.push(FriendDto {
            id: friend_id,
            name: name_str,
            league: league.to_string(),
            online, 
            status: status_str,
            avatar,
        });
    }

    Ok(Json(friends))
}

use serde::Deserialize;
use axum::extract::Path;

#[derive(Deserialize)]
pub struct ConsumeInviteRequest {
    pub inviter_id: i64,
}

#[derive(Deserialize)]
pub struct SendFriendRequest {
    pub target_id: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FriendRequestDto {
    pub id: i64,
    pub from_telegram_id: i64,
    pub username: String,
    pub photo_url: Option<String>,
    pub rating: i32,
    pub created_at: String,
}

pub async fn consume_invite(
    auth_user: AuthUser,
    Extension(app_ctx): Extension<Arc<AppContext>>,
    Json(payload): Json<ConsumeInviteRequest>,
) -> Result<impl axum::response::IntoResponse, (StatusCode, String)> {
    let pool = &app_ctx.db_pool;
    let inviter_id = payload.inviter_id;
    let my_id = auth_user.telegram_id;

    if inviter_id == my_id {
        return Err((StatusCode::BAD_REQUEST, "Cannot add yourself".into()));
    }

    let mut tx = pool.begin().await.map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "DB error".into()))?;

    let _ = sqlx::query!(
        "INSERT INTO user_friends (user_telegram_id, friend_telegram_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        my_id, inviter_id
    ).execute(&mut *tx).await;

    let _ = sqlx::query!(
        "INSERT INTO user_friends (user_telegram_id, friend_telegram_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        inviter_id, my_id
    ).execute(&mut *tx).await;

    tx.commit().await.map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "DB error".into()))?;

    Ok((StatusCode::OK, Json(serde_json::json!({"success": true}))))
}

pub async fn send_request(
    auth_user: AuthUser,
    Extension(app_ctx): Extension<Arc<AppContext>>,
    Json(payload): Json<SendFriendRequest>,
) -> Result<impl axum::response::IntoResponse, (StatusCode, String)> {
    let pool = &app_ctx.db_pool;
    let target_id = payload.target_id;
    let my_id = auth_user.telegram_id;

    if target_id == my_id {
        return Err((StatusCode::BAD_REQUEST, "Cannot add yourself".into()));
    }

    let is_already_friend = sqlx::query!(
        "SELECT 1 as x FROM user_friends WHERE user_telegram_id = $1 AND friend_telegram_id = $2",
        my_id, target_id
    ).fetch_optional(pool).await.unwrap_or(None);

    if is_already_friend.is_some() {
        return Err((StatusCode::BAD_REQUEST, "Already friends".into()));
    }

    let _ = sqlx::query!(
        "INSERT INTO friend_requests (from_telegram_id, to_telegram_id, status) VALUES ($1, $2, 'pending')
         ON CONFLICT (from_telegram_id, to_telegram_id) DO UPDATE SET status = 'pending', created_at = NOW()",
        my_id, target_id
    ).execute(pool).await.map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "DB Error".into()))?;

    Ok((StatusCode::CREATED, Json(serde_json::json!({"success": true}))))
}

pub async fn get_requests(
    auth_user: AuthUser,
    Extension(app_ctx): Extension<Arc<AppContext>>,
) -> Result<Json<Vec<FriendRequestDto>>, (StatusCode, String)> {
    let requests_rows = sqlx::query(
        r#"
        SELECT fr.id, fr.from_telegram_id, u.username, u.photo_url, u.rating, to_char(fr.created_at, 'DD.MM.YYYY') as date_str
        FROM friend_requests fr
        JOIN users u ON u.telegram_id = fr.from_telegram_id
        WHERE fr.to_telegram_id = $1 AND fr.status = 'pending'
        ORDER BY fr.created_at DESC
        "#,
    )
    .bind(auth_user.telegram_id)
    .fetch_all(&app_ctx.db_pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "DB Error".to_string()))?;

    let mut result = vec![];
    for row in requests_rows {
        result.push(FriendRequestDto {
            id: row.try_get("id").unwrap(),
            from_telegram_id: row.try_get("from_telegram_id").unwrap(),
            username: row.try_get::<Option<String>, _>("username").unwrap_or_default().unwrap_or_else(|| "anon".into()),
            photo_url: row.try_get("photo_url").unwrap_or(None),
            rating: row.try_get("rating").unwrap_or(0),
            created_at: row.try_get("date_str").unwrap_or_default(),
        });
    }

    Ok(Json(result))
}

pub async fn accept_request(
    auth_user: AuthUser,
    Extension(app_ctx): Extension<Arc<AppContext>>,
    Path(request_id): Path<i64>,
) -> Result<impl axum::response::IntoResponse, (StatusCode, String)> {
    let pool = &app_ctx.db_pool;
    let my_id = auth_user.telegram_id;

    let req_row = sqlx::query!(
        "SELECT from_telegram_id, to_telegram_id FROM friend_requests WHERE id = $1 AND status = 'pending'",
        request_id
    ).fetch_optional(pool).await.map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "DB error".to_string()))?;

    let req = match req_row {
        Some(r) => r,
        None => return Err((StatusCode::NOT_FOUND, "Request not found".into())),
    };

    if req.to_telegram_id != my_id {
        return Err((StatusCode::FORBIDDEN, "Not your request".into()));
    }

    let mut tx = pool.begin().await.map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "DB error".into()))?;

    let _ = sqlx::query!(
        "UPDATE friend_requests SET status = 'accepted', responded_at = NOW() WHERE id = $1",
        request_id
    ).execute(&mut *tx).await;

    let _ = sqlx::query!(
        "INSERT INTO user_friends (user_telegram_id, friend_telegram_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        req.to_telegram_id, req.from_telegram_id
    ).execute(&mut *tx).await;

    let _ = sqlx::query!(
        "INSERT INTO user_friends (user_telegram_id, friend_telegram_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        req.from_telegram_id, req.to_telegram_id
    ).execute(&mut *tx).await;

    tx.commit().await.map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "DB error".into()))?;

    Ok((StatusCode::OK, Json(serde_json::json!({"success": true}))))
}

pub async fn decline_request(
    auth_user: AuthUser,
    Extension(app_ctx): Extension<Arc<AppContext>>,
    Path(request_id): Path<i64>,
) -> Result<impl axum::response::IntoResponse, (StatusCode, String)> {
    let pool = &app_ctx.db_pool;
    let my_id = auth_user.telegram_id;
    
    // We update without selecting to verify if it's ours implicitly via WHERE
    let row = sqlx::query!(
        "UPDATE friend_requests SET status = 'declined', responded_at = NOW() WHERE id = $1 AND to_telegram_id = $2 RETURNING id",
        request_id, my_id
    ).fetch_optional(pool).await.map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "DB error".to_string()))?;

    if row.is_none() {
        return Err((StatusCode::NOT_FOUND, "Request not found or not yours".into()));
    }

    Ok((StatusCode::OK, Json(serde_json::json!({"success": true}))))
}
