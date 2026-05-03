use std::sync::Arc;
use axum::{
    extract::Extension,
    http::StatusCode,
    Json,
    response::IntoResponse,
};
use rand::Rng;
use serde::{Deserialize, Serialize};
use tracing::{error, info};
use crate::core::context::AppContext;
use crate::utils::jwt::AuthUser;

#[derive(Debug, Deserialize)]
pub struct SpinSlotsRequest {
    pub bet_amount: i64,
}

#[derive(Debug, Serialize)]
pub struct SpinSlotsResponse {
    pub symbols: Vec<Vec<String>>,
    pub win_cells: Vec<(usize, usize)>,
    pub win_type: String, // "jackpot", "cosmetic", "x10", "x2", "loss"
    pub win_amount: i64,
    pub cosmetic_item: Option<CosmeticReward>,
    pub new_balance: i64,
}

#[derive(Debug, Serialize)]
pub struct CosmeticReward {
    pub item_type: String,
    pub item_id: String,
    pub title: String,
}

// 64% Loss -> mixed
// 20% x2 -> 🍒🍒🍒
// 10% x10 -> 💎💎💎
// 5% Cosmetic -> 🃏🃏🃏
// 1% Jackpot -> 💰💰💰
#[axum::debug_handler]
pub async fn spin_slots(
    auth_user: AuthUser,
    Extension(app_ctx): Extension<Arc<AppContext>>,
    Json(req): Json<SpinSlotsRequest>,
) -> impl IntoResponse {
    let telegram_id = auth_user.telegram_id;

    if req.bet_amount != 5 && req.bet_amount != 50 && req.bet_amount != 300 {
        return (StatusCode::BAD_REQUEST, "Invalid bet amount").into_response();
    }

    let mut tx = match app_ctx.db_pool.begin().await {
        Ok(t) => t,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Failed to begin transaction").into_response(),
    };

    // Check balance
    let user_row = match sqlx::query!(
        "SELECT free_coins::BIGINT as nuts FROM users WHERE telegram_id = $1 FOR UPDATE",
        telegram_id
    )
    .fetch_one(&mut *tx)
    .await {
        Ok(r) => r,
        Err(_) => return (StatusCode::NOT_FOUND, "User not found").into_response(),
    };

    let current_nuts = user_row.nuts.unwrap_or(0);

    if current_nuts < req.bet_amount {
        return (StatusCode::BAD_REQUEST, "Not enough nuts").into_response();
    }

    // Deduct bet
    if sqlx::query!(
        "UPDATE users SET free_coins = free_coins - $1 WHERE telegram_id = $2",
        req.bet_amount as i32,
        telegram_id
    )
    .execute(&mut *tx)
    .await.is_err() {
        return (StatusCode::INTERNAL_SERVER_ERROR, "Failed to deduct bet").into_response();
    }

    if sqlx::query!(
        "INSERT INTO wallet_transactions (telegram_id, amount, currency, tx_type, metadata, created_at) VALUES ($1, $2, 'nuts', 'spend', 'slots_bet', NOW())",
        telegram_id,
        -req.bet_amount
    )
    .execute(&mut *tx)
    .await.is_err() {
        return (StatusCode::INTERNAL_SERVER_ERROR, "Failed to save tx").into_response();
    }

    // RNG
    let (symbols_matrix, win_cells, mut win_type, mut win_amount) = {
        let mut rng = rand::thread_rng();

        let (rows, cols) = match req.bet_amount {
            5 => (3, 3),
            50 => (3, 5),
            300 => (5, 5),
            _ => (3, 3),
        };

        // name, weight, x3, x4, x5
        let symbol_configs = vec![
            ("🍒", 100, 0.4, 1.0, 2.0), 
            ("🍋", 80,  0.8, 2.0, 5.0),
            ("🔔", 50,  2.0, 5.0, 10.0),
            ("💎", 20,  5.0, 15.0, 50.0),
            ("🃏", 10,  10.0, 30.0, 100.0),
            ("💰", 5,   20.0, 100.0, 500.0), 
        ];

        let mut deck = Vec::new();
        for config in &symbol_configs {
            for _ in 0..config.1 {
                deck.push(config.0);
            }
        }

        let mut symbols_matrix = vec![vec!["".to_string(); cols]; rows];
        
        // True RNG generation
        for r in 0..rows {
            for c in 0..cols {
                symbols_matrix[r][c] = deck[rng.gen_range(0..deck.len())].to_string();
            }
        }

        let mut total_win_amount = 0;
        let mut win_type = "loss".to_string();
        let mut win_cells = Vec::new();

        // Evaluate Paylines (Horizontal, Vertical, Diagonals, V-Shapes)
        let mut lines = Vec::new();
        // Horizontals
        for r in 0..rows {
            let mut line = Vec::new();
            for c in 0..cols { line.push((r, c)); }
            lines.push(line);
        }

        // Verticals
        for c in 0..cols {
            let mut line = Vec::new();
            for r in 0..rows { line.push((r, c)); }
            lines.push(line);
        }
        
        // Diagonals / V-Shapes
        if rows == cols {
            let mut diag1 = Vec::new();
            let mut diag2 = Vec::new();
            for i in 0..rows {
                diag1.push((i, i));
                diag2.push((rows - 1 - i, i));
            }
            lines.push(diag1);
            lines.push(diag2);
        } else if rows == 3 && cols == 5 {
            // V-shape top-to-bottom-to-top
            lines.push(vec![(0,0), (1,1), (2,2), (1,3), (0,4)]);
            // inverted V
            lines.push(vec![(2,0), (1,1), (0,2), (1,3), (2,4)]);
        }

        for line in lines {
            if line.is_empty() { continue; }
            
            let mut current_sym = &symbols_matrix[line[0].0][line[0].1];
            let mut current_len = 1;
            let mut current_cells = vec![line[0]];

            for i in 1..line.len() {
                let sym = &symbols_matrix[line[i].0][line[i].1];
                if sym == current_sym {
                    current_len += 1;
                    current_cells.push(line[i]);
                } else {
                    if current_len >= 3 {
                        // We have a win on this sequence!
                        let config = symbol_configs.iter().find(|c| c.0 == current_sym.as_str()).unwrap();
                        let multiplier = if current_len == 3 { config.2 } else if current_len == 4 { config.3 } else { config.4 };
                        
                        total_win_amount += (req.bet_amount as f64 * multiplier) as i64;
                        win_cells.extend(current_cells.clone());

                        if current_sym == "💰" { win_type = "jackpot".to_string(); }
                        else if win_type != "jackpot" && current_sym == "🃏" { win_type = "cosmetic".to_string(); }
                        else if win_type == "loss" { win_type = "x2".to_string(); }
                        else if win_type == "x2" && total_win_amount > req.bet_amount * 5 { win_type = "x10".to_string(); }
                    }
                    current_sym = sym;
                    current_len = 1;
                    current_cells = vec![line[i]];
                }
            }

            // Check the last sequence in the line
            if current_len >= 3 {
                let config = symbol_configs.iter().find(|c| c.0 == current_sym.as_str()).unwrap();
                let multiplier = if current_len == 3 { config.2 } else if current_len == 4 { config.3 } else { config.4 };
                
                total_win_amount += (req.bet_amount as f64 * multiplier) as i64;
                win_cells.extend(current_cells);

                if current_sym == "💰" { win_type = "jackpot".to_string(); }
                else if win_type != "jackpot" && current_sym == "🃏" { win_type = "cosmetic".to_string(); }
                else if win_type == "loss" { win_type = "x2".to_string(); }
                else if win_type == "x2" && total_win_amount > req.bet_amount * 5 { win_type = "x10".to_string(); }
            }
        }

        win_cells.sort();
        win_cells.dedup();

        (symbols_matrix, win_cells, win_type, total_win_amount)
    };

    let mut cosmetic_reward = None;

    if win_type == "cosmetic" {
        
        // Find a cosmetic the user doesn't own
        let unowned = match sqlx::query!(
            r#"
            SELECT id, item_type, item_key, title
            FROM store_cosmetics
            WHERE is_active = true
              AND item_type IN ('deck', 'background', 'taunt')
              AND item_key NOT IN (
                  SELECT item_id FROM user_inventory WHERE telegram_id = $1
              )
            ORDER BY RANDOM()
            LIMIT 1
            "#,
            telegram_id
        )
        .fetch_optional(&mut *tx)
        .await {
            Ok(r) => r,
            Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Failed to fetch cosmetics").into_response(),
        };

        if let Some(item) = unowned {
            cosmetic_reward = Some(CosmeticReward {
                item_type: item.item_type.clone(),
                item_id: item.item_key.clone(),
                title: item.title,
            });
            
            if sqlx::query!(
                "INSERT INTO user_inventory (telegram_id, item_type, item_id, created_at) VALUES ($1, $2, $3, NOW())",
                telegram_id,
                item.item_type,
                item.item_key
            )
            .execute(&mut *tx)
            .await.is_err() {
                return (StatusCode::INTERNAL_SERVER_ERROR, "Failed to grant item").into_response();
            }
        } else {
            // User owns everything, fallback to 500 nuts
            win_amount = 500;
            win_type = "x10".to_string(); // treats as a 10x equivalent prize
        }
    }

    if win_amount > 0 {
        if sqlx::query!(
            "UPDATE users SET free_coins = free_coins + $1 WHERE telegram_id = $2",
            win_amount as i32,
            telegram_id
        )
        .execute(&mut *tx)
        .await.is_err() {
            return (StatusCode::INTERNAL_SERVER_ERROR, "Failed to add win").into_response();
        }

        if sqlx::query!(
            "INSERT INTO wallet_transactions (telegram_id, amount, currency, tx_type, metadata, created_at) VALUES ($1, $2, 'nuts', 'reward', 'slots_win', NOW())",
            telegram_id,
            win_amount
        )
        .execute(&mut *tx)
        .await.is_err() {
            return (StatusCode::INTERNAL_SERVER_ERROR, "Failed to save tx").into_response();
        }
    }

    let final_balance = current_nuts - req.bet_amount + win_amount;

    if tx.commit().await.is_err() {
        return (StatusCode::INTERNAL_SERVER_ERROR, "Failed to commit transaction").into_response();
    }
    
    info!("Player {} spun slots. Bet: {}, Result: {}, Won: {}", telegram_id, req.bet_amount, win_type, win_amount);

    (StatusCode::OK, Json(SpinSlotsResponse {
        symbols: symbols_matrix,
        win_cells,
        win_type,
        win_amount,
        cosmetic_item: cosmetic_reward,
        new_balance: final_balance,
    })).into_response()
}
