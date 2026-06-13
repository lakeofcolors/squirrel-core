use axum::{extract::Extension, http::StatusCode, response::IntoResponse, Json};
use rand::Rng;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::{core::context::AppContext, utils::jwt::AuthUser};

#[derive(Deserialize)]
pub struct OpenChestRequest {
    pub chest_type: String, // 'common', 'rare', 'epic', 'legendary'
}

#[derive(Deserialize)]
pub struct BuyChestRequest {
    pub chest_type: String, // 'common', 'rare', 'epic'
}

#[derive(Serialize)]
pub struct OpenChestResponse {
    pub reward_type: String, // 'nuts' or 'cosmetic'
    pub amount: Option<i32>,
    pub item_id: Option<String>,
    pub is_duplicate: Option<bool>,
}

#[axum::debug_handler]
pub async fn open_chest(
    auth_user: AuthUser,
    Extension(app_ctx): Extension<Arc<AppContext>>,
    Json(payload): Json<OpenChestRequest>,
) -> impl IntoResponse {
    let user_id = auth_user.telegram_id;
    let chest_type = payload.chest_type;

    let mut tx = match app_ctx.db_pool.begin().await {
        Ok(t) => t,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Database error").into_response(),
    };

    // check chest amount
    let chest_row = sqlx::query!(
        "SELECT amount FROM user_chests WHERE telegram_id = $1 AND chest_type = $2 FOR UPDATE",
        user_id,
        chest_type
    )
    .fetch_optional(&mut *tx)
    .await;

    let mut has_chest = false;
    if let Ok(Some(row)) = chest_row {
        if row.amount > 0 {
            has_chest = true;
        }
    }

    if !has_chest {
        return (StatusCode::BAD_REQUEST, "No chests of this type").into_response();
    }

    // deduct chest
    let _ = sqlx::query!(
        "UPDATE user_chests SET amount = amount - 1, updated_at = NOW() WHERE telegram_id = $1 AND chest_type = $2",
        user_id, chest_type
    )
    .execute(&mut *tx)
    .await;

    // generate reward
    let roll: f64 = {
        let mut rng = rand::thread_rng();
        rng.gen()
    };

    let mut reward_type = "nuts".to_string();
    let mut amount = None;
    let mut item_id = None;
    let mut is_duplicate = None;

    let (nuts_chance, rare_drop_chance) = match chest_type.as_str() {
        "common" => (0.7, 0.05),
        "rare" => (0.5, 0.2),
        "epic" => (0.3, 0.5),
        "legendary" => (0.1, 0.8),
        _ => (0.8, 0.05),
    };

    if roll < nuts_chance {
        // give nuts
        let nuts_earned = {
            let mut rng = rand::thread_rng();
            match chest_type.as_str() {
                "common" => rng.gen_range(50..150),
                "rare" => rng.gen_range(150..400),
                "epic" => rng.gen_range(400..1000),
                "legendary" => rng.gen_range(1000..3000),
                _ => 100,
            }
        };
        reward_type = "nuts".to_string();
        amount = Some(nuts_earned);

        let _ = sqlx::query!(
            "UPDATE users SET free_coins = free_coins + $1 WHERE telegram_id = $2",
            nuts_earned,
            user_id
        )
        .execute(&mut *tx)
        .await;
    } else {
        // give cosmetic
        // select a random cosmetic
        let target_rarities: Vec<String> = if roll < (nuts_chance + rare_drop_chance) {
            match chest_type.as_str() {
                "common" => vec!["common".to_string(), "rare".to_string()],
                "rare" => vec!["rare".to_string(), "epic".to_string()],
                "epic" => vec!["epic".to_string(), "legendary".to_string()],
                "legendary" => vec!["legendary".to_string(), "mythic".to_string()],
                _ => vec!["common".to_string()],
            }
        } else {
            match chest_type.as_str() {
                "common" => vec!["common".to_string()],
                "rare" => vec!["common".to_string(), "rare".to_string()],
                "epic" => vec!["rare".to_string(), "epic".to_string()],
                "legendary" => vec!["epic".to_string(), "legendary".to_string()],
                _ => vec!["common".to_string()],
            }
        };

        let cosmetics = sqlx::query!(
            "SELECT id, item_type, item_key, rarity, price_nuts FROM store_cosmetics WHERE rarity = ANY($1) AND is_active = TRUE",
            &target_rarities
        )
        .fetch_all(&mut *tx)
        .await
        .unwrap_or_default();

        if cosmetics.is_empty() {
            // fallback to nuts
            let fallback_nuts = 200;
            reward_type = "nuts".to_string();
            amount = Some(fallback_nuts);
            let _ = sqlx::query!(
                "UPDATE users SET free_coins = free_coins + $1 WHERE telegram_id = $2",
                fallback_nuts,
                user_id
            )
            .execute(&mut *tx)
            .await;
        } else {
            let idx = {
                let mut rng = rand::thread_rng();
                rng.gen_range(0..cosmetics.len())
            };
            let selected_item = &cosmetics[idx];

            let already_owned = sqlx::query!(
                 "SELECT id FROM user_inventory WHERE telegram_id = $1 AND item_type = $2 AND item_id = $3",
                 user_id, selected_item.item_type, selected_item.item_key
             )
             .fetch_optional(&mut *tx)
             .await
             .unwrap_or(None)
             .is_some();

            if already_owned {
                is_duplicate = Some(true);
                let comp = (selected_item.price_nuts / 3) as i32 + 50;
                reward_type = "nuts".to_string();
                amount = Some(comp);
                let _ = sqlx::query!(
                    "UPDATE users SET free_coins = free_coins + $1 WHERE telegram_id = $2",
                    comp,
                    user_id
                )
                .execute(&mut *tx)
                .await;
                item_id = Some(selected_item.id.clone());
            } else {
                is_duplicate = Some(false);
                reward_type = "cosmetic".to_string();
                item_id = Some(selected_item.id.clone());

                let _ = sqlx::query!(
                     "INSERT INTO user_inventory (telegram_id, item_type, item_id) VALUES ($1, $2, $3)",
                     user_id, selected_item.item_type, selected_item.item_key
                 )
                 .execute(&mut *tx)
                 .await;
            }
        }
    }

    if let Err(_) = tx.commit().await {
        return (StatusCode::INTERNAL_SERVER_ERROR, "Failed to commit").into_response();
    }

    (
        StatusCode::OK,
        Json(OpenChestResponse {
            reward_type,
            amount,
            item_id,
            is_duplicate,
        }),
    )
        .into_response()
}

#[derive(Serialize)]
pub struct GetChestsResponse {
    pub common: i32,
    pub rare: i32,
    pub epic: i32,
    pub legendary: i32,
}

pub async fn get_chests(
    auth_user: AuthUser,
    Extension(app_ctx): Extension<Arc<AppContext>>,
) -> impl IntoResponse {
    let user_id = auth_user.telegram_id;

    let chests = sqlx::query!(
        "SELECT chest_type, amount FROM user_chests WHERE telegram_id = $1",
        user_id
    )
    .fetch_all(&app_ctx.db_pool)
    .await;

    let mut res = GetChestsResponse {
        common: 0,
        rare: 0,
        epic: 0,
        legendary: 0,
    };

    if let Ok(rows) = chests {
        for row in rows {
            match row.chest_type.as_str() {
                "common" => res.common = row.amount,
                "rare" => res.rare = row.amount,
                "epic" => res.epic = row.amount,
                "legendary" => res.legendary = row.amount,
                _ => {}
            }
        }
    }

    (StatusCode::OK, Json(res)).into_response()
}

pub async fn buy_chest(
    auth_user: AuthUser,
    Extension(app_ctx): Extension<Arc<AppContext>>,
    Json(payload): Json<BuyChestRequest>,
) -> impl IntoResponse {
    let user_id = auth_user.telegram_id;
    let chest_type = payload.chest_type;

    let price = match chest_type.as_str() {
        "common" => 500,
        "rare" => 1000,
        "epic" => 1500,
        _ => return (StatusCode::BAD_REQUEST, "Invalid chest type").into_response(),
    };

    let mut tx = match app_ctx.db_pool.begin().await {
        Ok(t) => t,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "DB Error").into_response(),
    };

    let user_balance = sqlx::query!(
        "SELECT free_coins FROM users WHERE telegram_id = $1 FOR UPDATE",
        user_id
    )
    .fetch_optional(&mut *tx)
    .await;

    let balance = match user_balance {
        Ok(Some(row)) => row.free_coins,
        _ => return (StatusCode::NOT_FOUND, "User not found").into_response(),
    };

    if balance < price {
        return (StatusCode::BAD_REQUEST, "Not enough nuts").into_response();
    }

    let _ = sqlx::query!(
        "UPDATE users SET free_coins = free_coins - $1 WHERE telegram_id = $2",
        price,
        user_id
    )
    .execute(&mut *tx)
    .await;

    let _ = sqlx::query!(
        "INSERT INTO user_chests (telegram_id, chest_type, amount) VALUES ($1, $2, 1) ON CONFLICT (telegram_id, chest_type) DO UPDATE SET amount = user_chests.amount + 1",
        user_id, chest_type
    )
    .execute(&mut *tx)
    .await;

    let _ = tx.commit().await;

    (StatusCode::OK, Json(serde_json::json!({"success": true}))).into_response()
}
