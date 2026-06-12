use crate::{
    core::context::AppContext,
    utils::crypto::{decrypt_message, encrypt_message},
    utils::jwt::AuthUser,
};
use axum::{
    extract::{Extension, Path},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use std::sync::Arc;

#[derive(Deserialize)]
pub struct CreateClanRequest {
    pub name: String,
    pub tag: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClanDto {
    pub id: i32,
    pub name: String,
    pub tag: String,
    pub owner_id: i64,
    pub rating: i32,
    pub trophies: i32,
    pub members_count: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClanMemberDto {
    pub telegram_id: i64,
    pub username: String,
    pub avatar: String,
    pub role: String,
    pub rating: i32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClanDetailsDto {
    pub clan: ClanDto,
    pub members: Vec<ClanMemberDto>,
}

pub async fn create_clan(
    auth_user: AuthUser,
    Extension(app_ctx): Extension<Arc<AppContext>>,
    Json(req): Json<CreateClanRequest>,
) -> Result<Json<ClanDto>, (StatusCode, String)> {
    let telegram_id = auth_user.telegram_id;
    let pool = &app_ctx.db_pool;

    let tag_upper = req.tag.to_uppercase();
    if req.name.trim().is_empty() || tag_upper.trim().is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            "Name and tag cannot be empty".to_string(),
        ));
    }
    if tag_upper.len() > 5 {
        return Err((
            StatusCode::BAD_REQUEST,
            "Tag cannot be longer than 5 characters".to_string(),
        ));
    }

    let mut tx = pool
        .begin()
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "DB Error".to_string()))?;

    // Check if user is already in a clan
    let existing_membership = sqlx::query!(
        "SELECT clan_id FROM clan_members WHERE telegram_id = $1",
        telegram_id
    )
    .fetch_optional(&mut *tx)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "DB Error".to_string()))?;

    if existing_membership.is_some() {
        return Err((
            StatusCode::BAD_REQUEST,
            "You are already in a clan".to_string(),
        ));
    }

    // Check nuts balance (Cost: 10,000)
    let user_row = sqlx::query!(
        "SELECT free_coins FROM users WHERE telegram_id = $1",
        telegram_id
    )
    .fetch_one(&mut *tx)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "User not found".to_string(),
        )
    })?;

    if user_row.free_coins < 10000 {
        return Err((
            StatusCode::BAD_REQUEST,
            "Not enough nuts (10,000 required)".to_string(),
        ));
    }

    // Deduct nuts
    sqlx::query!(
        "UPDATE users SET free_coins = free_coins - 10000 WHERE telegram_id = $1",
        telegram_id
    )
    .execute(&mut *tx)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to deduct nuts".to_string(),
        )
    })?;

    // Create clan
    let clan_row = sqlx::query(
        "INSERT INTO clans (name, tag, owner_id) VALUES ($1, $2, $3) RETURNING id, name, tag, owner_id, rating, trophies"
    )
    .bind(&req.name)
    .bind(&tag_upper)
    .bind(telegram_id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|_| (StatusCode::BAD_REQUEST, "Clan name or tag already exists".to_string()))?;

    let clan_id: i32 = clan_row.try_get("id").unwrap();

    // Add user as leader
    sqlx::query!(
        "INSERT INTO clan_members (clan_id, telegram_id, role) VALUES ($1, $2, 'leader')",
        clan_id,
        telegram_id
    )
    .execute(&mut *tx)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to add clan member".to_string(),
        )
    })?;

    tx.commit().await.map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to commit".to_string(),
        )
    })?;

    let clan = ClanDto {
        id: clan_id,
        name: clan_row.try_get("name").unwrap_or_default(),
        tag: clan_row.try_get("tag").unwrap_or_default(),
        owner_id: telegram_id,
        rating: 0,
        trophies: 0,
        members_count: 1,
    };

    Ok(Json(clan))
}

pub async fn get_clans(
    Extension(app_ctx): Extension<Arc<AppContext>>,
) -> Result<Json<Vec<ClanDto>>, (StatusCode, String)> {
    let pool = &app_ctx.db_pool;

    let rows = sqlx::query(
        r#"
        SELECT c.id, c.name, c.tag, c.owner_id, c.rating, c.trophies,
               (SELECT COUNT(*) FROM clan_members WHERE clan_id = c.id) as members_count
        FROM clans c
        ORDER BY c.rating DESC, c.trophies DESC
        LIMIT 50
        "#,
    )
    .fetch_all(pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "DB Error".to_string()))?;

    let mut clans = vec![];
    for row in rows {
        clans.push(ClanDto {
            id: row.try_get("id").unwrap_or(0),
            name: row.try_get("name").unwrap_or_default(),
            tag: row.try_get("tag").unwrap_or_default(),
            owner_id: row.try_get("owner_id").unwrap_or(0),
            rating: row.try_get("rating").unwrap_or(0),
            trophies: row.try_get("trophies").unwrap_or(0),
            members_count: row.try_get("members_count").unwrap_or(0),
        });
    }

    Ok(Json(clans))
}

pub async fn get_clan_details(
    Path(clan_id): Path<i32>,
    Extension(app_ctx): Extension<Arc<AppContext>>,
) -> Result<Json<ClanDetailsDto>, (StatusCode, String)> {
    let pool = &app_ctx.db_pool;

    let clan_row = sqlx::query(
        r#"
        SELECT c.id, c.name, c.tag, c.owner_id, c.rating, c.trophies,
               (SELECT COUNT(*) FROM clan_members WHERE clan_id = c.id) as members_count
        FROM clans c
        WHERE c.id = $1
        "#,
    )
    .bind(clan_id)
    .fetch_optional(pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "DB Error".to_string()))?;

    if let Some(row) = clan_row {
        let clan = ClanDto {
            id: row.try_get("id").unwrap_or(0),
            name: row.try_get("name").unwrap_or_default(),
            tag: row.try_get("tag").unwrap_or_default(),
            owner_id: row.try_get("owner_id").unwrap_or(0),
            rating: row.try_get("rating").unwrap_or(0),
            trophies: row.try_get("trophies").unwrap_or(0),
            members_count: row.try_get("members_count").unwrap_or(0),
        };

        let member_rows = sqlx::query(
            r#"
            SELECT u.telegram_id, u.username, COALESCE(u.photo_url, '') as avatar, u.rating, cm.role
            FROM clan_members cm
            JOIN users u ON u.telegram_id = cm.telegram_id
            WHERE cm.clan_id = $1
            ORDER BY u.rating DESC
            "#,
        )
        .bind(clan_id)
        .fetch_all(pool)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "DB Error".to_string()))?;

        let mut members = vec![];
        for m_row in member_rows {
            members.push(ClanMemberDto {
                telegram_id: m_row.try_get("telegram_id").unwrap_or(0),
                username: m_row
                    .try_get("username")
                    .unwrap_or_else(|_| "Squirrel".into()),
                avatar: m_row.try_get("avatar").unwrap_or_default(),
                role: m_row.try_get("role").unwrap_or_else(|_| "member".into()),
                rating: m_row.try_get("rating").unwrap_or(0),
            });
        }

        Ok(Json(ClanDetailsDto { clan, members }))
    } else {
        Err((StatusCode::NOT_FOUND, "Clan not found".to_string()))
    }
}

pub async fn join_clan(
    Path(clan_id): Path<i32>,
    auth_user: AuthUser,
    Extension(app_ctx): Extension<Arc<AppContext>>,
) -> Result<Json<()>, (StatusCode, String)> {
    let telegram_id = auth_user.telegram_id;
    let pool = &app_ctx.db_pool;

    let existing_membership = sqlx::query!(
        "SELECT clan_id FROM clan_members WHERE telegram_id = $1",
        telegram_id
    )
    .fetch_optional(pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "DB Error".to_string()))?;

    if existing_membership.is_some() {
        return Err((
            StatusCode::BAD_REQUEST,
            "You are already in a clan".to_string(),
        ));
    }

    let clan_exists = sqlx::query!("SELECT id FROM clans WHERE id = $1", clan_id)
        .fetch_optional(pool)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "DB Error".to_string()))?;

    if clan_exists.is_none() {
        return Err((StatusCode::NOT_FOUND, "Clan not found".to_string()));
    }

    sqlx::query!(
        "INSERT INTO clan_members (clan_id, telegram_id, role) VALUES ($1, $2, 'member')",
        clan_id,
        telegram_id
    )
    .execute(pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to join clan".to_string(),
        )
    })?;

    Ok(Json(()))
}

pub async fn leave_clan(
    auth_user: AuthUser,
    Extension(app_ctx): Extension<Arc<AppContext>>,
) -> Result<Json<()>, (StatusCode, String)> {
    let telegram_id = auth_user.telegram_id;
    let pool = &app_ctx.db_pool;

    let existing_membership = sqlx::query!(
        "SELECT clan_id, role FROM clan_members WHERE telegram_id = $1",
        telegram_id
    )
    .fetch_optional(pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "DB Error".to_string()))?;

    if let Some(membership) = existing_membership {
        if membership.role == "leader" {
            // Need logic to pass leadership or dissolve clan. Let's simplify: dissolve if leader leaves.
            // Or just block leader from leaving unless they are the last member.
            let count = sqlx::query!(
                "SELECT COUNT(*) as c FROM clan_members WHERE clan_id = $1",
                membership.clan_id
            )
            .fetch_one(pool)
            .await
            .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "DB Error".to_string()))?;

            if count.c.unwrap_or(0) > 1 {
                return Err((
                    StatusCode::BAD_REQUEST,
                    "Leader must transfer ownership before leaving".to_string(),
                ));
            } else {
                // Delete clan
                sqlx::query!("DELETE FROM clans WHERE id = $1", membership.clan_id)
                    .execute(pool)
                    .await
                    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "DB Error".to_string()))?;
                return Ok(Json(()));
            }
        }

        sqlx::query!(
            "DELETE FROM clan_members WHERE telegram_id = $1",
            telegram_id
        )
        .execute(pool)
        .await
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to leave clan".to_string(),
            )
        })?;

        Ok(Json(()))
    } else {
        Err((StatusCode::BAD_REQUEST, "You are not in a clan".to_string()))
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TournamentDto {
    pub id: i32,
    pub title: String,
    pub start_time: chrono::DateTime<chrono::Utc>,
    pub end_time: chrono::DateTime<chrono::Utc>,
    pub status: String,
}

pub async fn get_tournaments(
    Extension(app_ctx): Extension<Arc<AppContext>>,
) -> Result<Json<Vec<TournamentDto>>, (StatusCode, String)> {
    let pool = &app_ctx.db_pool;

    let rows = sqlx::query!(
        r#"
        SELECT id, title, start_time, end_time, status
        FROM tournaments
        ORDER BY start_time DESC
        "#
    )
    .fetch_all(pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "DB Error".to_string()))?;

    let mut tournaments = vec![];
    for row in rows {
        tournaments.push(TournamentDto {
            id: row.id,
            title: row.title,
            start_time: row.start_time,
            end_time: row.end_time,
            status: row.status,
        });
    }

    Ok(Json(tournaments))
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TournamentSquadMemberDto {
    pub telegram_id: i64,
    pub is_substitute: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TournamentRegistrationDto {
    pub clan_id: i32,
    pub registered_at: chrono::DateTime<chrono::Utc>,
    pub squad: Vec<TournamentSquadMemberDto>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TournamentMatchDto {
    pub id: i32,
    pub round: i32,
    pub match_index: i32,
    pub clan1_id: Option<i32>,
    pub clan2_id: Option<i32>,
    pub winner_id: Option<i32>,
    pub room_id: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TournamentDetailDto {
    pub id: i32,
    pub title: String,
    pub start_time: chrono::DateTime<chrono::Utc>,
    pub end_time: chrono::DateTime<chrono::Utc>,
    pub status: String,
    pub my_clan_registration: Option<TournamentRegistrationDto>,
    pub matches: Vec<TournamentMatchDto>,
}

pub async fn get_tournament_details(
    auth_user: AuthUser,
    Path(tournament_id): Path<i32>,
    Extension(app_ctx): Extension<Arc<AppContext>>,
) -> Result<Json<TournamentDetailDto>, (StatusCode, String)> {
    let pool = &app_ctx.db_pool;

    let t = sqlx::query!(
        "SELECT id, title, start_time, end_time, status FROM tournaments WHERE id = $1",
        tournament_id
    )
    .fetch_optional(pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "DB Error".to_string()))?;

    let t = match t {
        Some(t) => t,
        None => return Err((StatusCode::NOT_FOUND, "Tournament not found".to_string())),
    };

    // Find my clan
    let my_clan = sqlx::query!(
        "SELECT clan_id FROM clan_members WHERE telegram_id = $1",
        auth_user.telegram_id
    )
    .fetch_optional(pool)
    .await
    .unwrap_or(None);

    let mut my_clan_registration = None;

    if let Some(c) = my_clan {
        let reg = sqlx::query!("SELECT id, registered_at FROM tournament_registrations WHERE tournament_id = $1 AND clan_id = $2", tournament_id, c.clan_id)
            .fetch_optional(pool).await.unwrap_or(None);

        if let Some(r) = reg {
            let squad_rows = sqlx::query!("SELECT telegram_id, is_substitute FROM tournament_squads WHERE registration_id = $1", r.id)
                .fetch_all(pool).await.unwrap_or_default();

            let squad = squad_rows
                .into_iter()
                .map(|sr| TournamentSquadMemberDto {
                    telegram_id: sr.telegram_id.unwrap_or(0),
                    is_substitute: sr.is_substitute,
                })
                .collect();

            my_clan_registration = Some(TournamentRegistrationDto {
                clan_id: c.clan_id,
                registered_at: r.registered_at,
                squad,
            });
        }
    }

    let matches_rows = sqlx::query!("SELECT id, round, match_index, clan1_id, clan2_id, winner_id, room_id FROM tournament_matches WHERE tournament_id = $1 ORDER BY round ASC, match_index ASC", tournament_id)
        .fetch_all(pool).await.unwrap_or_default();

    let matches = matches_rows
        .into_iter()
        .map(|m| TournamentMatchDto {
            id: m.id,
            round: m.round,
            match_index: m.match_index,
            clan1_id: m.clan1_id,
            clan2_id: m.clan2_id,
            winner_id: m.winner_id,
            room_id: m.room_id,
        })
        .collect();

    Ok(Json(TournamentDetailDto {
        id: t.id,
        title: t.title,
        start_time: t.start_time,
        end_time: t.end_time,
        status: t.status,
        my_clan_registration,
        matches,
    }))
}

#[derive(Deserialize)]
pub struct RegisterTournamentRequest {
    pub main_squad: Vec<i64>,
    pub substitutes: Vec<i64>,
}

pub async fn register_for_tournament(
    auth_user: AuthUser,
    Path(tournament_id): Path<i32>,
    Extension(app_ctx): Extension<Arc<AppContext>>,
    Json(payload): Json<RegisterTournamentRequest>,
) -> Result<impl axum::response::IntoResponse, (StatusCode, String)> {
    let pool = &app_ctx.db_pool;

    if payload.main_squad.len() != 2 {
        return Err((
            StatusCode::BAD_REQUEST,
            "В основном составе должно быть ровно 2 игрока".to_string(),
        ));
    }
    if payload.substitutes.len() > 4 {
        return Err((
            StatusCode::BAD_REQUEST,
            "Запасных игроков может быть не больше 4".to_string(),
        ));
    }

    let my_id = auth_user.telegram_id;

    let t = sqlx::query!(
        "SELECT status FROM tournaments WHERE id = $1",
        tournament_id
    )
    .fetch_optional(pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "DB error".into()))?;

    if let Some(t) = t {
        if t.status != "upcoming" {
            return Err((
                StatusCode::BAD_REQUEST,
                "Регистрация возможна только на будущие турниры".into(),
            ));
        }
    } else {
        return Err((StatusCode::NOT_FOUND, "Турнир не найден".into()));
    }

    // Am I clan leader?
    let my_membership = sqlx::query!(
        "SELECT clan_id, role FROM clan_members WHERE telegram_id = $1",
        my_id
    )
    .fetch_optional(pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "DB error".into()))?;

    let clan_id = match my_membership {
        Some(m) if m.role == "leader" => m.clan_id,
        Some(_) => {
            return Err((
                StatusCode::FORBIDDEN,
                "Только лидер клана может зарегистрировать состав".into(),
            ))
        }
        None => return Err((StatusCode::FORBIDDEN, "Вы не состоите в клане".into())),
    };

    // Are all players in the clan?
    let mut all_players = payload.main_squad.clone();
    all_players.extend(&payload.substitutes);

    let in_clan_count = sqlx::query!(
        "SELECT COUNT(*) FROM clan_members WHERE clan_id = $1 AND telegram_id = ANY($2)",
        clan_id,
        &all_players
    )
    .fetch_one(pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "DB error".into()))?
    .count
    .unwrap_or(0);

    if in_clan_count as usize != all_players.len() {
        return Err((
            StatusCode::BAD_REQUEST,
            "Все заявленные игроки должны состоять в вашем клане".into(),
        ));
    }

    let mut tx = pool
        .begin()
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "DB error".into()))?;

    let reg_id = sqlx::query!("INSERT INTO tournament_registrations (tournament_id, clan_id) VALUES ($1, $2) RETURNING id", tournament_id, clan_id)
        .fetch_one(&mut *tx).await.map_err(|_| (StatusCode::BAD_REQUEST, "Ваш клан уже зарегистрирован на этот турнир".into()))?.id;

    for player_id in payload.main_squad {
        sqlx::query!("INSERT INTO tournament_squads (registration_id, telegram_id, is_substitute) VALUES ($1, $2, false)", reg_id, player_id)
            .execute(&mut *tx).await.map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "DB error".into()))?;
    }
    for player_id in payload.substitutes {
        sqlx::query!("INSERT INTO tournament_squads (registration_id, telegram_id, is_substitute) VALUES ($1, $2, true)", reg_id, player_id)
            .execute(&mut *tx).await.map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "DB error".into()))?;
    }

    tx.commit()
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "DB error".into()))?;

    Ok((StatusCode::OK, Json(serde_json::json!({"success": true}))))
}

// ==========================================
// CHAT & MODERATION
// ==========================================

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClanMessageDto {
    pub id: i32,
    pub sender_id: i64,
    pub sender_name: String,
    pub message: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Deserialize)]
pub struct SendClanMessageRequest {
    pub message: String,
}

pub async fn get_clan_chat(
    auth_user: AuthUser,
    Path(clan_id): Path<i32>,
    Extension(app_ctx): Extension<Arc<AppContext>>,
) -> Result<Json<Vec<ClanMessageDto>>, (StatusCode, String)> {
    let pool = &app_ctx.db_pool;

    // Verify membership
    let membership = sqlx::query!(
        "SELECT role FROM clan_members WHERE clan_id = $1 AND telegram_id = $2",
        clan_id,
        auth_user.telegram_id
    )
    .fetch_optional(pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "DB error".into()))?;

    if membership.is_none() {
        return Err((StatusCode::FORBIDDEN, "You are not in this clan".into()));
    }

    let rows = sqlx::query!(
        r#"
        SELECT cm.id, cm.sender_id, cm.message, cm.created_at, u.username
        FROM clan_messages cm
        JOIN users u ON u.telegram_id = cm.sender_id
        WHERE cm.clan_id = $1
        ORDER BY cm.created_at DESC
        LIMIT 50
        "#,
        clan_id
    )
    .fetch_all(pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "DB error".into()))?;

    let secret = std::env::var("SECRET_KEY").unwrap_or_else(|_| "default_secret".into());
    let mut messages = vec![];

    for row in rows {
        let decrypted = decrypt_message(&row.message, &secret)
            .unwrap_or_else(|_| "[Ошибка расшифровки]".into());
        messages.push(ClanMessageDto {
            id: row.id,
            sender_id: row.sender_id.unwrap_or(0),
            sender_name: row.username.unwrap_or_else(|| "Unknown".into()),
            message: decrypted,
            created_at: row.created_at,
        });
    }

    messages.reverse(); // Return in chronological order
    Ok(Json(messages))
}

pub async fn send_clan_message(
    auth_user: AuthUser,
    Path(clan_id): Path<i32>,
    Extension(app_ctx): Extension<Arc<AppContext>>,
    Json(payload): Json<SendClanMessageRequest>,
) -> Result<Json<()>, (StatusCode, String)> {
    let pool = &app_ctx.db_pool;

    if payload.message.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, "Message cannot be empty".into()));
    }
    if payload.message.len() > 255 {
        return Err((StatusCode::BAD_REQUEST, "Message too long".into()));
    }

    // Verify membership
    let membership = sqlx::query!(
        "SELECT role FROM clan_members WHERE clan_id = $1 AND telegram_id = $2",
        clan_id,
        auth_user.telegram_id
    )
    .fetch_optional(pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "DB error".into()))?;

    if membership.is_none() {
        return Err((StatusCode::FORBIDDEN, "You are not in this clan".into()));
    }

    let secret = std::env::var("SECRET_KEY").unwrap_or_else(|_| "default_secret".into());
    let encrypted = encrypt_message(&payload.message, &secret);

    sqlx::query!(
        "INSERT INTO clan_messages (clan_id, sender_id, message) VALUES ($1, $2, $3)",
        clan_id,
        auth_user.telegram_id,
        encrypted
    )
    .execute(pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to send message".into(),
        )
    })?;

    Ok(Json(()))
}

#[derive(Deserialize)]
pub struct ChangeRoleRequest {
    pub role: String, // 'officer' or 'member'
}

pub async fn change_member_role(
    auth_user: AuthUser,
    Path((clan_id, target_id)): Path<(i32, i64)>,
    Extension(app_ctx): Extension<Arc<AppContext>>,
    Json(payload): Json<ChangeRoleRequest>,
) -> Result<Json<()>, (StatusCode, String)> {
    let pool = &app_ctx.db_pool;

    if payload.role != "officer" && payload.role != "member" {
        return Err((StatusCode::BAD_REQUEST, "Invalid role".into()));
    }

    // Am I leader?
    let my_membership = sqlx::query!(
        "SELECT role FROM clan_members WHERE clan_id = $1 AND telegram_id = $2",
        clan_id,
        auth_user.telegram_id
    )
    .fetch_optional(pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "DB error".into()))?;

    match my_membership {
        Some(m) if m.role == "leader" => {}
        _ => {
            return Err((
                StatusCode::FORBIDDEN,
                "Только лидер может изменять роли".into(),
            ))
        }
    }

    // Is target in clan?
    let target_membership = sqlx::query!(
        "SELECT role FROM clan_members WHERE clan_id = $1 AND telegram_id = $2",
        clan_id,
        target_id
    )
    .fetch_optional(pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "DB error".into()))?;

    if let Some(tm) = target_membership {
        if tm.role == "leader" {
            return Err((
                StatusCode::BAD_REQUEST,
                "Нельзя изменить роль лидера".into(),
            ));
        }

        sqlx::query!(
            "UPDATE clan_members SET role = $1 WHERE clan_id = $2 AND telegram_id = $3",
            payload.role,
            clan_id,
            target_id
        )
        .execute(pool)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "DB error".into()))?;

        Ok(Json(()))
    } else {
        Err((StatusCode::NOT_FOUND, "Участник не найден в клане".into()))
    }
}

pub async fn kick_member(
    auth_user: AuthUser,
    Path((clan_id, target_id)): Path<(i32, i64)>,
    Extension(app_ctx): Extension<Arc<AppContext>>,
) -> Result<Json<()>, (StatusCode, String)> {
    let pool = &app_ctx.db_pool;

    // My role
    let my_membership = sqlx::query!(
        "SELECT role FROM clan_members WHERE clan_id = $1 AND telegram_id = $2",
        clan_id,
        auth_user.telegram_id
    )
    .fetch_optional(pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "DB error".into()))?;

    let my_role = match my_membership {
        Some(m) => m.role,
        None => return Err((StatusCode::FORBIDDEN, "Вы не состоите в клане".into())),
    };

    if my_role == "member" {
        return Err((
            StatusCode::FORBIDDEN,
            "У вас нет прав исключать участников".into(),
        ));
    }

    // Target role
    let target_membership = sqlx::query!(
        "SELECT role FROM clan_members WHERE clan_id = $1 AND telegram_id = $2",
        clan_id,
        target_id
    )
    .fetch_optional(pool)
    .await
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "DB error".into()))?;

    if let Some(tm) = target_membership {
        if tm.role == "leader" {
            return Err((StatusCode::BAD_REQUEST, "Нельзя исключить лидера".into()));
        }
        if my_role == "officer" && tm.role == "officer" {
            return Err((
                StatusCode::FORBIDDEN,
                "Офицер не может исключить другого офицера".into(),
            ));
        }

        sqlx::query!(
            "DELETE FROM clan_members WHERE clan_id = $1 AND telegram_id = $2",
            clan_id,
            target_id
        )
        .execute(pool)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "DB error".into()))?;

        Ok(Json(()))
    } else {
        Err((StatusCode::NOT_FOUND, "Участник не найден в клане".into()))
    }
}
