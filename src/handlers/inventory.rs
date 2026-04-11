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

#[derive(Deserialize)]
pub struct UseItemRequest {
    pub item_key: String,
}

pub async fn use_item(
    auth_user: AuthUser,
    Extension(app_ctx): Extension<Arc<AppContext>>,
    Json(payload): Json<UseItemRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let pool = &app_ctx.db_pool;
    let user_id = auth_user.telegram_id;
    let item_key = payload.item_key;

    let mut tx = pool.begin().await.map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "DB Error".into()))?;

    // Check if user has booster
    let inv = sqlx::query!(
        "SELECT id FROM user_inventory WHERE telegram_id = $1 AND item_type = 'booster' AND item_id = $2 FOR UPDATE",
        user_id, item_key
    ).fetch_optional(&mut *tx).await.map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "DB Error".into()))?;

    if inv.is_none() {
        return Err((StatusCode::BAD_REQUEST, "Вы не владеете этим предметом".into()));
    }

    let item_id = inv.unwrap().id;

    // Apply booster
    if item_key == "xp_1h" || item_key == "nuts_1h" {
        // Delete item 1 count
        let _ = sqlx::query!(
            "DELETE FROM user_inventory WHERE id = $1", item_id
        ).execute(&mut *tx).await;

        if item_key == "xp_1h" {
            let _ = sqlx::query!(
                "UPDATE users 
                 SET xp_booster_ends_at = GREATEST(NOW(), COALESCE(xp_booster_ends_at, NOW())) + INTERVAL '1 hour'
                 WHERE telegram_id = $1", user_id
            ).execute(&mut *tx).await;
        } else {
            let _ = sqlx::query!(
                "UPDATE users 
                 SET nuts_booster_ends_at = GREATEST(NOW(), COALESCE(nuts_booster_ends_at, NOW())) + INTERVAL '1 hour'
                 WHERE telegram_id = $1", user_id
            ).execute(&mut *tx).await;
        }
    } else {
        return Err((StatusCode::BAD_REQUEST, "Предмет нельзя использовать".into()));
    }

    tx.commit().await.map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "DB Error".into()))?;

    Ok((StatusCode::OK, Json(serde_json::json!({ "success": true }))))
}
