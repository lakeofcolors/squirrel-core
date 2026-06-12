use axum::{
    extract::Extension,
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::Deserialize;
use std::sync::Arc;

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
        "SELECT amount FROM user_boosters WHERE telegram_id = $1 AND booster_id = $2 FOR UPDATE",
        user_id, item_key
    ).fetch_optional(&mut *tx).await.map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "DB Error".into()))?;

    let amount = inv.map(|r| r.amount).unwrap_or(0);
    if amount <= 0 {
        return Err((StatusCode::BAD_REQUEST, "Вы не владеете этим предметом".into()));
    }

    // Apply booster
    if item_key == "xp_1h" || item_key == "nuts_1h" {
        // Decrease booster amount
        let _ = sqlx::query!(
            "UPDATE user_boosters SET amount = amount - 1 WHERE telegram_id = $1 AND booster_id = $2", 
            user_id, item_key
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
