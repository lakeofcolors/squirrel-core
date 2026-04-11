use std::env;
use std::sync::Arc;

use axum::{
    extract::Extension,
    http::StatusCode,
    Json,
};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use sqlx::Row;
use tracing::{error, info};
use uuid::Uuid;

use crate::core::context::AppContext;
use crate::utils::jwt::AuthUser;

/* =========================
   STORE PRODUCTS
========================= */

#[derive(Debug, Serialize)]
pub struct StoreNutsPackDto {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub nuts_amount: i64,
    pub bonus_nuts_amount: i64,
    pub is_featured: bool,
    pub price_xtr: i64,
}

#[derive(Debug, Serialize)]
pub struct StoreCosmeticDto {
    pub id: String,           // deck_pink
    pub item_type: String,    // deck | background
    pub item_key: String,     // pink / fire
    pub title: String,
    pub price_nuts: i64,
    pub rarity: String,
    pub owned: bool,
    pub equipped: bool,
}

#[derive(Debug, Serialize)]
pub struct StoreResponse {
    pub nuts_packs: Vec<StoreNutsPackDto>,
    pub decks: Vec<StoreCosmeticDto>,
    pub backgrounds: Vec<StoreCosmeticDto>,
    pub taunts: Vec<StoreCosmeticDto>,
    pub boosters: Vec<StoreCosmeticDto>,
    pub balance_nuts: i64,
}

#[derive(Debug, Clone)]
struct StoreProduct {
    id: &'static str,
    title: &'static str,
    description: &'static str,
    amount_xtr: i64,
    nuts_amount: i64,
}

fn get_store_product(product_id: &str) -> Option<StoreProduct> {
    match product_id {
        "nuts_250" => Some(StoreProduct {
            id: "nuts_250",
            title: "250 орехов",
            description: "Пакет орехов для покупки колод, фонов и косметики",
            amount_xtr: 1,
            nuts_amount: 250,
        }),
        "nuts_700" => Some(StoreProduct {
            id: "nuts_700",
            title: "700 орехов",
            description: "Средний пакет орехов с выгодой для активной игры",
            amount_xtr: 700,
            nuts_amount: 700,
        }),
        "nuts_1500" => Some(StoreProduct {
            id: "nuts_1500",
            title: "1500 орехов",
            description: "Популярный пакет орехов для постоянных игроков",
            amount_xtr: 1500,
            nuts_amount: 1500,
        }),
        "nuts_4000" => Some(StoreProduct {
            id: "nuts_4000",
            title: "4000 орехов",
            description: "Большой пакет орехов с максимальной выгодой",
            amount_xtr: 4000,
            nuts_amount: 4000,
        }),
        _ => None,
    }
}

/* =========================
   REQUEST / RESPONSE DTO
========================= */

#[derive(Debug, Deserialize)]
pub struct CreateInvoiceRequest {
    pub product_id: String,
}

#[derive(Debug, Serialize)]
pub struct CreateInvoiceResponse {
    pub order_id: String,
    pub invoice_url: String,
}

#[derive(Debug, Deserialize)]
pub struct BuyItemForNutsRequest {
    pub item_type: String, // "deck" | "background"
    pub item_id: String,
}

#[derive(Debug, Serialize)]
pub struct BuyItemForNutsResponse {
    pub success: bool,
    pub balance_nuts: i64,
}

#[derive(Debug, Serialize)]
pub struct StartRewardedResponse {
    pub reward_session_id: String,
    pub reward_amount: i64,
    pub custom_data: String,
}

/* =========================
   TELEGRAM API DTO
========================= */

#[derive(Debug, Serialize)]
struct CreateInvoiceLinkRequest<'a> {
    title: &'a str,
    description: &'a str,
    payload: &'a str,
    currency: &'a str,
    prices: Vec<LabeledPrice<'a>>,
}

#[derive(Debug, Serialize)]
struct LabeledPrice<'a> {
    label: &'a str,
    amount: i64,
}

#[derive(Debug, Deserialize)]
struct TelegramApiResponse<T> {
    ok: bool,
    result: Option<T>,
    description: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct TelegramUpdate {
    pub update_id: i64,
    pub pre_checkout_query: Option<PreCheckoutQuery>,
    pub message: Option<TelegramMessage>,
}

#[derive(Debug, Deserialize)]
pub struct PreCheckoutQuery {
    pub id: String,
    pub from: TelegramUser,
    pub currency: String,
    pub total_amount: i64,
    pub invoice_payload: String,
}

#[derive(Debug, Deserialize)]
pub struct TelegramUser {
    pub id: i64,
}

#[derive(Debug, Deserialize)]
pub struct TelegramMessage {
    pub successful_payment: Option<SuccessfulPayment>,
}

#[derive(Debug, Deserialize)]
pub struct SuccessfulPayment {
    pub currency: String,
    pub total_amount: i64,
    pub invoice_payload: String,
    pub telegram_payment_charge_id: String,
    pub provider_payment_charge_id: Option<String>,
}

#[derive(Debug, Serialize)]
struct AnswerPreCheckoutQueryRequest<'a> {
    pre_checkout_query_id: &'a str,
    ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    error_message: Option<&'a str>,
}

/* =========================
   HELPERS
========================= */

fn telegram_bot_token() -> Result<String, (StatusCode, String)> {
    env::var("BOT_TOKEN")
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "TELEGRAM_BOT_TOKEN not set".to_string()))
}

fn telegram_api_base() -> Result<String, (StatusCode, String)> {
    let token = telegram_bot_token()?;
    Ok(format!("https://api.telegram.org/bot{}", token))
}

fn parse_invoice_payload(payload: &str) -> Result<(String, i64, String, i64), String> {
    // format:
    // order:{order_id}:user:{user_id}:product:{product_id}:nuts:{nuts_amount}
    let parts: Vec<&str> = payload.split(':').collect();

    if parts.len() != 8 {
        return Err("Invalid payload format".to_string());
    }

    if parts[0] != "order" || parts[2] != "user" || parts[4] != "product" || parts[6] != "nuts" {
        return Err("Invalid payload keys".to_string());
    }

    let order_id = parts[1].to_string();
    let user_id: i64 = parts[3]
        .parse()
        .map_err(|_| "Invalid user_id in payload".to_string())?;
    let product_id = parts[5].to_string();
    let nuts_amount: i64 = parts[7]
        .parse()
        .map_err(|_| "Invalid nuts_amount in payload".to_string())?;

    Ok((order_id, user_id, product_id, nuts_amount))
}

pub async fn get_store(
    auth_user: AuthUser,
    Extension(app_ctx): Extension<Arc<AppContext>>,
) -> Result<Json<StoreResponse>, (StatusCode, String)> {
    let telegram_id = auth_user.telegram_id;

    // =========================
    // USER BALANCE
    // =========================
    let user_row = sqlx::query(
        r#"
        SELECT free_coins::BIGINT AS free_coins
        FROM users
        WHERE telegram_id = $1
        "#,
    )
    .bind(telegram_id)
    .fetch_one(&app_ctx.db_pool)
    .await
    .map_err(|_| (StatusCode::NOT_FOUND, "User not found".to_string()))?;

    let balance_nuts: i64 = user_row.try_get("free_coins").map_err(|e| {
        error!("Failed to read free_coins: {:?}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to read user balance".to_string(),
        )
    })?;

    // =========================
    // NUTS PACKS
    // =========================
    let packs = sqlx::query(
        r#"
        SELECT id, title, description, nuts_amount, is_featured, bonus_nuts_amount, xtr_amount
        FROM store_nuts_packs
        WHERE is_active = TRUE
        ORDER BY sort_order
        "#,
    )
    .fetch_all(&app_ctx.db_pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "packs error".to_string()))?;

    let nuts_packs = packs
        .into_iter()
        .map(|r| StoreNutsPackDto {
            id: r.try_get("id").unwrap(),
            title: r.try_get("title").unwrap(),
            description: r.try_get("description").ok(),
            nuts_amount: r.try_get("nuts_amount").unwrap(),
            is_featured: r.try_get("is_featured").unwrap(),
            bonus_nuts_amount: r.try_get("bonus_nuts_amount").unwrap(),
            price_xtr: r.try_get("xtr_amount").unwrap(),
        })
        .collect::<Vec<_>>();

    // =========================
    // COSMETICS
    // =========================
    let cosmetics = sqlx::query(
        r#"
        SELECT
            c.*,
            (ui.id IS NOT NULL) as owned,
            CASE
                WHEN c.item_type = 'deck' THEN COALESCE(uei.equipped_deck_id = c.item_key, FALSE)
                WHEN c.item_type = 'background' THEN COALESCE(uei.equipped_background_id = c.item_key, FALSE)
                ELSE FALSE
            END as equipped
        FROM store_cosmetics c
        LEFT JOIN user_inventory ui
            ON ui.telegram_id = $1
            AND ui.item_type = c.item_type
            AND ui.item_id = c.item_key
        LEFT JOIN user_equipped_items uei
            ON uei.telegram_id = $1
        WHERE c.is_active = TRUE
        ORDER BY c.sort_order
        "#,
    )
    .bind(telegram_id)
    .fetch_all(&app_ctx.db_pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "cosmetics error".to_string()))?;
    let mut decks = Vec::new();
    let mut backgrounds = Vec::new();
    let mut taunts = Vec::new();
    let mut boosters = Vec::new();

    for row in cosmetics {
        let dto = StoreCosmeticDto {
            id: row.try_get("id").unwrap(),
            item_type: row.try_get("item_type").unwrap(),
            item_key: row.try_get("item_key").unwrap(),
            title: row.try_get("title").unwrap(),
            price_nuts: row.try_get("price_nuts").unwrap(),
            rarity: row.try_get("rarity").unwrap(),
            owned: row.try_get("owned").unwrap_or(false),
            equipped: row.try_get("equipped").unwrap_or(false),
        };

        if dto.item_type == "deck" {
            decks.push(dto);
        } else if dto.item_type == "background" {
            backgrounds.push(dto);
        } else if dto.item_type == "taunt" {
            taunts.push(dto);
        } else if dto.item_type == "booster" {
            boosters.push(dto);
        }
    }

    Ok(Json(StoreResponse {
        nuts_packs,
        decks,
        backgrounds,
        taunts,
        boosters,
        balance_nuts,
    }))
}

#[derive(Debug, Deserialize)]
pub struct EquipItemRequest {
    pub item_type: String, // deck | background
    pub item_id: String,
}

pub async fn equip_item(
    auth_user: AuthUser,
    Extension(app_ctx): Extension<Arc<AppContext>>,
    Json(req): Json<EquipItemRequest>,
) -> Result<StatusCode, (StatusCode, String)> {
    let telegram_id = auth_user.telegram_id;

    // проверка что есть в инвентаре
    let exists = sqlx::query(
        r#"
        SELECT id FROM user_inventory
        WHERE telegram_id = $1 AND item_type = $2 AND item_id = $3
        "#,
    )
    .bind(telegram_id)
    .bind(&req.item_type)
    .bind(&req.item_id)
    .fetch_optional(&app_ctx.db_pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "check error".to_string()))?;

    if exists.is_none() {
        return Err((StatusCode::BAD_REQUEST, "Item not owned".to_string()));
    }

    // upsert equipped
    match req.item_type.as_str() {
        "deck" => {
            sqlx::query(
                r#"
                INSERT INTO user_equipped_items (telegram_id, equipped_deck_id)
                VALUES ($1, $2)
                ON CONFLICT (telegram_id)
                DO UPDATE SET equipped_deck_id = $2, updated_at = NOW()
                "#,
            )
            .bind(telegram_id)
            .bind(&req.item_id)
            .execute(&app_ctx.db_pool)
            .await
            .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "equip error".to_string()))?;
        }
        "background" => {
            sqlx::query(
                r#"
                INSERT INTO user_equipped_items (telegram_id, equipped_background_id)
                VALUES ($1, $2)
                ON CONFLICT (telegram_id)
                DO UPDATE SET equipped_background_id = $2, updated_at = NOW()
                "#,
            )
            .bind(telegram_id)
            .bind(&req.item_id)
            .execute(&app_ctx.db_pool)
            .await
            .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "equip error".to_string()))?;
        }
        _ => return Err((StatusCode::BAD_REQUEST, "Invalid type".to_string())),
    }

    Ok(StatusCode::OK)
}

async fn answer_pre_checkout_query(
    query_id: &str,
    ok: bool,
    error_message: Option<&str>,
) -> Result<(), StatusCode> {
    let url = format!(
        "{}/answerPreCheckoutQuery",
        telegram_api_base().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    );

    let body = AnswerPreCheckoutQueryRequest {
        pre_checkout_query_id: query_id,
        ok,
        error_message,
    };

    let client = Client::new();
    let resp = client
        .post(url)
        .json(&body)
        .send()
        .await
        .map_err(|_| StatusCode::BAD_GATEWAY)?;

    let tg: TelegramApiResponse<bool> = resp.json().await.map_err(|_| StatusCode::BAD_GATEWAY)?;
    if !tg.ok {
        return Err(StatusCode::BAD_GATEWAY);
    }

    Ok(())
}


pub async fn create_invoice(
    auth_user: AuthUser,
    Extension(app_ctx): Extension<Arc<AppContext>>,
    Json(req): Json<CreateInvoiceRequest>,
) -> Result<Json<CreateInvoiceResponse>, (StatusCode, String)> {
    let product = get_store_product(&req.product_id)
        .ok_or((StatusCode::BAD_REQUEST, "Unknown product_id".to_string()))?;

    let telegram_id = auth_user.telegram_id;
    let order_id = Uuid::new_v4().to_string();

    let payload = format!(
        "order:{}:user:{}:product:{}:nuts:{}",
        order_id, telegram_id, product.id, product.nuts_amount
    );

    // Создаём pending order в БД
    sqlx::query(
        r#"
        INSERT INTO store_orders (
            id,
            telegram_id,
            product_id,
            nuts_amount,
            xtr_amount,
            status,
            created_at
        )
        VALUES ($1, $2, $3, $4, $5, 'pending', NOW())
        "#,
    )
    .bind(&order_id)
    .bind(telegram_id)
    .bind(product.id)
    .bind(product.nuts_amount)
    .bind(product.amount_xtr)
    .execute(&app_ctx.db_pool)
    .await
    .map_err(|e| {
        error!("Failed to insert store order: {:?}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to create order".to_string(),
        )
    })?;

    let body = CreateInvoiceLinkRequest {
        title: product.title,
        description: product.description,
        payload: &payload,
        currency: "XTR",
        prices: vec![LabeledPrice {
            label: product.title,
            amount: product.amount_xtr,
        }],
    };

    let url = format!(
        "{}/createInvoiceLink",
        telegram_api_base()?
    );

    let client = Client::new();
    let resp = client.post(url).json(&body).send().await.map_err(|e| {
        error!("createInvoiceLink request failed: {}", e);
        (
            StatusCode::BAD_GATEWAY,
            "Telegram API request failed".to_string(),
        )
    })?;

    let tg: TelegramApiResponse<String> = resp.json().await.map_err(|e| {
        error!("Failed to parse Telegram response: {}", e);
        (
            StatusCode::BAD_GATEWAY,
            "Invalid Telegram API response".to_string(),
        )
    })?;

    if !tg.ok {
        let desc = tg
            .description
            .unwrap_or_else(|| "Unknown Telegram error".to_string());

        error!("createInvoiceLink failed: {}", desc);
        return Err((StatusCode::BAD_GATEWAY, desc));
    }

    let invoice_url = tg
        .result
        .ok_or((StatusCode::BAD_GATEWAY, "Missing invoice_url".to_string()))?;

    info!(
        "Created invoice order_id={}, telegram_id={}, product_id={}",
        order_id, telegram_id, product.id
    );

    Ok(Json(CreateInvoiceResponse {
        order_id,
        invoice_url,
    }))
}

/* =========================
   BUY ITEM FOR NUTS
========================= */

pub async fn buy_item_for_nuts(
    auth_user: AuthUser,
    Extension(app_ctx): Extension<Arc<AppContext>>,
    Json(req): Json<BuyItemForNutsRequest>,
) -> Result<Json<BuyItemForNutsResponse>, (StatusCode, String)> {
    let telegram_id = auth_user.telegram_id;

    if req.item_type != "deck" && req.item_type != "background" && req.item_type != "taunt" {
        return Err((StatusCode::BAD_REQUEST, "Invalid item_type".to_string()));
    }

    let mut tx = app_ctx.db_pool.begin().await.map_err(|e| {
        error!("Failed to begin transaction: {:?}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to begin transaction".to_string(),
        )
    })?;

    let cosmetic_row = sqlx::query(
        r#"
        SELECT id, item_type, item_key, price_nuts, is_active
        FROM store_cosmetics
        WHERE item_type = $1 AND item_key = $2
        "#,
    )
    .bind(&req.item_type)
    .bind(&req.item_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| {
        error!("Failed to fetch cosmetic item: {:?}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to fetch store item".to_string(),
        )
    })?;

    let Some(cosmetic_row) = cosmetic_row else {
        return Err((StatusCode::BAD_REQUEST, "Unknown item".to_string()));
    };

    let is_active: bool = cosmetic_row.try_get("is_active").map_err(|e| {
        error!("Failed to read is_active: {:?}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to read item state".to_string(),
        )
    })?;

    if !is_active {
        return Err((StatusCode::BAD_REQUEST, "Item is not active".to_string()));
    }

    let price_nuts: i64 = cosmetic_row.try_get("price_nuts").map_err(|e| {
        error!("Failed to read price_nuts: {:?}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to read item price".to_string(),
        )
    })?;

    let user_row = sqlx::query(
        r#"
        SELECT free_coins::BIGINT AS nuts
        FROM users
        WHERE telegram_id = $1
        FOR UPDATE
        "#,
    )
    .bind(telegram_id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| {
        error!("Failed to fetch user nuts: {:?}", e);
        (StatusCode::NOT_FOUND, "User not found".to_string())
    })?;
    let current_nuts: i64 = user_row.try_get("nuts").map_err(|e| {
        error!("Failed to read nuts: {:?}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to read balance".to_string(),
        )
    })?;

    let existing = sqlx::query(
        r#"
        SELECT id
        FROM user_inventory
        WHERE telegram_id = $1 AND item_type = $2 AND item_id = $3
        "#,
    )
    .bind(telegram_id)
    .bind(&req.item_type)
    .bind(&req.item_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| {
        error!("Failed to check inventory: {:?}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to check inventory".to_string(),
        )
    })?;

    if existing.is_some() {
        return Err((StatusCode::BAD_REQUEST, "Item already owned".to_string()));
    }

    if current_nuts < price_nuts {
        return Err((StatusCode::BAD_REQUEST, "Not enough nuts".to_string()));
    }

    let new_balance = current_nuts - price_nuts;

    sqlx::query(
        r#"
        UPDATE users
        SET free_coins = $1
        WHERE telegram_id = $2
        "#,
    )
    .bind(new_balance)
    .bind(telegram_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| {
        error!("Failed to update user nuts: {:?}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to update balance".to_string(),
        )
    })?;

    sqlx::query(
        r#"
        INSERT INTO user_inventory (
            telegram_id,
            item_type,
            item_id,
            created_at
        )
        VALUES ($1, $2, $3, NOW())
        "#,
    )
    .bind(telegram_id)
    .bind(&req.item_type)
    .bind(&req.item_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| {
        error!("Failed to insert inventory item: {:?}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to save inventory item".to_string(),
        )
    })?;

    sqlx::query(
        r#"
        INSERT INTO wallet_transactions (
            telegram_id,
            amount,
            currency,
            tx_type,
            metadata,
            created_at
        )
        VALUES ($1, $2, 'nuts', 'spend', $3, NOW())
        "#,
    )
    .bind(telegram_id)
    .bind(-price_nuts)
    .bind(format!("buy:{}:{}", req.item_type, req.item_id))
    .execute(&mut *tx)
    .await
    .map_err(|e| {
        error!("Failed to insert wallet transaction: {:?}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to save transaction".to_string(),
        )
    })?;

    tx.commit().await.map_err(|e| {
        error!("Failed to commit transaction: {:?}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to commit transaction".to_string(),
        )
    })?;

    Ok(Json(BuyItemForNutsResponse {
        success: true,
        balance_nuts: new_balance,
    }))
}

/* =========================
   REWARDED MOCK START
========================= */

pub async fn start_rewarded_session(
    auth_user: AuthUser,
) -> Result<Json<StartRewardedResponse>, (StatusCode, String)> {
    let reward_session_id = Uuid::new_v4().to_string();
    let reward_amount = 50_i64;
    let custom_data = format!("reward:{}:user:{}", reward_session_id, auth_user.telegram_id);

    Ok(Json(StartRewardedResponse {
        reward_session_id,
        reward_amount,
        custom_data,
    }))
}

/* =========================
   TELEGRAM WEBHOOK
========================= */

pub async fn telegram_update_webhook(
    Extension(app_ctx): Extension<Arc<AppContext>>,
    Json(update): Json<TelegramUpdate>,
) -> Result<StatusCode, StatusCode> {
    if let Some(query) = update.pre_checkout_query {
        handle_pre_checkout(&app_ctx, query).await?;
    }

    if let Some(message) = update.message {
        if let Some(payment) = message.successful_payment {
            handle_successful_payment(&app_ctx, payment).await?;
        }
    }

    Ok(StatusCode::OK)
}

async fn handle_pre_checkout(
    app_ctx: &Arc<AppContext>,
    query: PreCheckoutQuery,
) -> Result<(), StatusCode> {
    let (order_id, user_id, product_id, nuts_amount) =
        parse_invoice_payload(&query.invoice_payload).map_err(|_| StatusCode::BAD_REQUEST)?;

    if query.currency != "XTR" {
        answer_pre_checkout_query(&query.id, false, Some("Invalid currency")).await?;
        return Ok(());
    }

    let row = sqlx::query(
        r#"
        SELECT id, xtr_amount, status
        FROM store_orders
        WHERE id = $1 AND telegram_id = $2 AND product_id = $3 AND nuts_amount = $4
        "#,
    )
    .bind(&order_id)
    .bind(user_id)
    .bind(&product_id)
    .bind(nuts_amount)
    .fetch_optional(&app_ctx.db_pool)
    .await
    .map_err(|e| {
        error!("Failed to fetch order on pre-checkout: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let Some(row) = row else {
        answer_pre_checkout_query(&query.id, false, Some("Order not found")).await?;
        return Ok(());
    };

    let xtr_amount: i64 = row.try_get("xtr_amount").map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let status: String = row.try_get("status").map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if status != "pending" {
        answer_pre_checkout_query(&query.id, false, Some("Order already processed")).await?;
        return Ok(());
    }

    if query.total_amount != xtr_amount {
        answer_pre_checkout_query(&query.id, false, Some("Invalid amount")).await?;
        return Ok(());
    }

    answer_pre_checkout_query(&query.id, true, None).await?;
    Ok(())
}

async fn handle_successful_payment(
    app_ctx: &Arc<AppContext>,
    payment: SuccessfulPayment,
) -> Result<(), StatusCode> {
    if payment.currency != "XTR" {
        return Err(StatusCode::BAD_REQUEST);
    }

    let (order_id, telegram_id, product_id, nuts_amount) =
        parse_invoice_payload(&payment.invoice_payload).map_err(|_| StatusCode::BAD_REQUEST)?;

    let mut tx = app_ctx.db_pool.begin().await.map_err(|e| {
        error!("Failed to begin tx for successful payment: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let order_row = sqlx::query(
        r#"
        SELECT id, status, xtr_amount
        FROM store_orders
        WHERE id = $1
        FOR UPDATE
        "#,
    )
    .bind(&order_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| {
        error!("Failed to fetch order for successful payment: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let Some(order_row) = order_row else {
        return Err(StatusCode::NOT_FOUND);
    };

    let status: String = order_row.try_get("status").map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let xtr_amount: i64 = order_row.try_get("xtr_amount").map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // идемпотентность
    if status == "paid" {
        tx.commit().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        return Ok(());
    }

    if payment.total_amount != xtr_amount {
        return Err(StatusCode::BAD_REQUEST);
    }

    sqlx::query(
        r#"
        UPDATE users
        SET free_coins = COALESCE(free_coins, 0) + $1
        WHERE telegram_id = $2
        "#,
    )
    .bind(nuts_amount)
    .bind(telegram_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| {
        error!("Failed to increment nuts: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    sqlx::query(
        r#"
        INSERT INTO wallet_transactions (
            telegram_id,
            amount,
            currency,
            tx_type,
            metadata,
            created_at
        )
        VALUES ($1, $2, 'nuts', 'topup', $3, NOW())
        "#,
    )
    .bind(telegram_id)
    .bind(nuts_amount)
    .bind(format!(
        "telegram_payment:{}:{}:{}",
        payment.telegram_payment_charge_id, order_id, product_id
    ))
    .execute(&mut *tx)
    .await
    .map_err(|e| {
        error!("Failed to insert wallet transaction: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    sqlx::query(
        r#"
        UPDATE store_orders
        SET
            status = 'paid',
            telegram_payment_charge_id = $2,
            provider_payment_charge_id = $3,
            paid_at = NOW()
        WHERE id = $1
        "#,
    )
    .bind(&order_id)
    .bind(&payment.telegram_payment_charge_id)
    .bind(&payment.provider_payment_charge_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| {
        error!("Failed to update order status: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    tx.commit().await.map_err(|e| {
        error!("Failed to commit successful payment tx: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    info!(
        "Successful payment processed: order_id={}, telegram_id={}, product_id={}, nuts={}",
        order_id, telegram_id, product_id, nuts_amount
    );

    Ok(())
}
