use tokio::{sync::mpsc, time::sleep};
use url::quirks::username;
use std::{collections::{HashMap, VecDeque}, sync::{Mutex, Arc}, time::{Instant, Duration}};

use rust_decimal::prelude::ToPrimitive;
use crate::{utils::schemas::{Currency, League, PlayerId, Room, RoomId, QueueKey, QueueCommand, RoomManagerCommand, RoomKind, WSEvent, RoomMeta, PlayerPosition, GameState, Suit, RoomActorCommand, PlayerMeta, Team, GameSnapshot, PlayerInfo, Card}, core::{context::get_global_context, pool::PlayerSession}};
use tracing::{info, debug, warn, error};
use uuid::Uuid;
use bimap::BiMap;

use super::pool::PlayerStatus;

fn try_match(
    queues: &mut HashMap<QueueKey, VecDeque<PlayerId>>,
    room_tx: &mpsc::UnboundedSender<RoomManagerCommand>,
) {
    for (key, queue) in queues.iter_mut() {
        while queue.len() >= 4 {
            let players: Vec<PlayerId> =
                (0..4).map(|_| queue.pop_front().unwrap()).collect();

            info!("Matched 4 players for queue key {:?}: {:?}", key, players);

            if let Err(e) = room_tx.send(RoomManagerCommand::CreateRoom {
                key: key.clone(),
                players,
                password_hash: None,
                kind: RoomKind::Queue
            }) {
                error!("Failed to send RoomManagerCommand::CreateRoom: {:?}", e);
            }
        }
    }
}

pub fn start_room_manager() -> mpsc::UnboundedSender<RoomManagerCommand>{
    info!("Start room manager");
    let (tx, mut rx) = mpsc::unbounded_channel();
    let manager_tx = tx.clone();

    tokio::spawn(async move {
        sleep(Duration::from_secs(2)).await; // NOTE for app_ctx init
        let app_ctx = get_global_context();
        let mut rooms: HashMap<RoomId, Room> = HashMap::new();
        let mut room_subscribers: Vec<PlayerId> = Vec::new();

        while let Some(cmd) = rx.recv().await {
            debug!("Processing RoomManagerCommand: {:?}", cmd);
            match cmd {
                RoomManagerCommand::CreateRoom { key, players, password_hash, kind } => {
                    let room_id = Uuid::new_v4().to_string();
                    let players_meta: Vec<PlayerMeta> = players
                        .iter()
                        .filter_map(|id| app_ctx.connection_pool().get(id))
                        .map(|session| session.player_meta.clone())
                        .collect();

                    if players_meta.len() != players.len() {
                        warn!("CreateRoom aborted: only {} players found out of {}. Some disconnected.", players_meta.len(), players.len());
                        for id in players {
                            app_ctx.connection_pool().send_to(
                                &id,
                                WSEvent::Error {
                                    detail: "Один из игроков покинул очередь до создания комнаты.".to_string(),
                                }
                            ).await;
                        }
                        continue;
                    }

                    let stake_value = key.stake.to_i32().unwrap_or(0);
                    let room_meta = RoomMeta{
                        id: room_id.clone(),
                        name: room_id.clone(),
                        key,
                        players: players_meta.clone(),
                        kind
                    };
                    let room = rooms.entry(room_id.clone())
                         .or_insert(
                             Room{
                                 actor: None,
                                 meta: room_meta.clone(),
                                 password_hash,
                                 created_at: Instant::now()
                             }
                       );
                    app_ctx.connection_pool().broadcast(
                        room_subscribers.clone(),
                        WSEvent::RoomCreated { room: room_meta }
                    ).await;
                    if players.len().eq(&4){
                        let room_actor = start_room_actor(
                            room_id,
                            players_meta,
                            manager_tx.clone(),
                            stake_value
                        );
                        room.actor = Some(room_actor);
                    }
                }
                RoomManagerCommand::CreateBotRoom { key, player, difficulty } => {
                    let room_id = Uuid::new_v4().to_string();
                    let stake_value = key.stake.to_i32().unwrap_or(0);

                    let real_player_meta = match app_ctx.connection_pool().get(&player) {
                        Some(session) => session.player_meta.clone(),
                        None => { continue; }
                    };

                    let mut players_meta = vec![real_player_meta];
                    for i in 1..=3 {
                        players_meta.push(PlayerMeta {
                            id: -(i as i64),
                            username: Some(format!("Bot {}", i)),
                            rating: 0,
                            photo_url: None,
                            is_bot: true,
                            bot_difficulty: Some(difficulty.clone()),
                            xp: 0,
                        });
                    }

                    let room_meta = RoomMeta{
                        id: room_id.clone(),
                        name: "Игра с ботами".to_string(),
                        key,
                        players: players_meta.clone(),
                        kind: RoomKind::BotMatch
                    };

                    let room = rooms.entry(room_id.clone())
                         .or_insert(Room{
                             actor: None,
                             meta: room_meta.clone(),
                             password_hash: None,
                             created_at: Instant::now()
                         });

                    app_ctx.connection_pool().broadcast(
                        room_subscribers.clone(),
                        WSEvent::RoomCreated { room: room_meta }
                    ).await;

                    let room_actor = start_room_actor(
                        room_id,
                        players_meta,
                        manager_tx.clone(),
                        stake_value
                    );
                    room.actor = Some(room_actor);
                }
                RoomManagerCommand::LeaveAllRoom { player } => {
                    let mut empty_room_ids: Vec<RoomId> = Vec::new();

                    for (room_id, room) in rooms.iter_mut() {
                        let was_in_room = room.meta.players.iter().any(|p| p.id == player);

                        if !was_in_room {
                            continue;
                        }

                        room.meta.players.retain(|p| p.id != player);

                        if room.meta.players.is_empty() {
                            empty_room_ids.push(room_id.clone());
                        } else {
                            app_ctx.connection_pool().broadcast(
                                room_subscribers.clone(),
                                WSEvent::RoomUpdated {
                                    room: room.meta.clone(),
                                },
                            ).await;
                        }
                    }

                    for room_id in empty_room_ids {
                        rooms.remove(&room_id);

                        app_ctx.connection_pool().broadcast(
                            room_subscribers.clone(),
                            WSEvent::RoomRemoved { room_id },
                        ).await;
                    }
                }
                RoomManagerCommand::JoinRoom { player, room_id, password } => {
                    if let Some(room) = rooms.get_mut(&room_id) {
                        if room.meta.players.len() < 4 {
                            if room.meta.players.iter().any(|p| p.id == player){
                                continue;
                            } else {
                                if let Some(room_pwd) = &room.password_hash {
                                    if password != Some(room_pwd.clone()) {
                                        app_ctx.connection_pool().send_to(
                                            &player,
                                            WSEvent::Error {
                                                detail: "Неверный пароль".to_string()
                                            }
                                        ).await;
                                        continue;
                                    }
                                }

                                let stake_val = rust_decimal::prelude::ToPrimitive::to_i32(&room.meta.key.stake).unwrap_or(0);
                                if stake_val > 0 {
                                    let check_coins = sqlx::query!("SELECT free_coins FROM users WHERE telegram_id = $1", player)
                                        .fetch_one(&app_ctx.db_pool)
                                        .await;
                                    
                                    if let Ok(row) = check_coins {
                                        if row.free_coins < stake_val {
                                            app_ctx.connection_pool().send_to(
                                                &player,
                                                WSEvent::Error {
                                                    detail: "Недостаточно орехов для этой ставки".to_string()
                                                }
                                            ).await;
                                            continue;
                                        }
                                    } else {
                                        continue;
                                    }
                                }

                                if let Some(session) = app_ctx.connection_pool().get(&player) {
                                    room.meta.players.push(session.player_meta.clone());
                                } else {
                                    warn!("JoinRoom failed: player {} not in pool", player);
                                    continue;
                                }
                            }

                            app_ctx.connection_pool().broadcast(
                                room_subscribers.clone(),
                                WSEvent::RoomUpdated {
                                    room: room.meta.clone(),
                                },
                            ).await;

                            if room.meta.players.len() == 4 {
                                let room_actor = start_room_actor(
                                    room_id.clone(),
                                    room.meta.players.clone(),
                                    manager_tx.clone(),
                                    room.meta.key.stake.to_i32().unwrap_or(0)
                                );
                                room.actor = Some(room_actor)
                            }
                        }
                    }
                }
                RoomManagerCommand::LeaveRoom { player, room_id } => {
                    if let Some(room) = rooms.get_mut(&room_id) {
                        room.meta.players.retain(|p| p.id != player);

                        if room.meta.players.is_empty() {
                            rooms.remove(&room_id);

                            app_ctx.connection_pool().broadcast(
                                room_subscribers.clone(),
                                WSEvent::RoomRemoved { room_id },
                            ).await;
                        } else {
                            app_ctx.connection_pool().broadcast(
                                room_subscribers.clone(),
                                WSEvent::RoomUpdated {
                                    room: room.meta.clone(),
                                },
                            ).await;
                        }
                    }
                }
                RoomManagerCommand::SurrenderRoom { player, room_id } => {
                    if let Some(room) = rooms.get(&room_id) {
                        if let Some(actor) = &room.actor {
                            let _ = actor.send(RoomActorCommand::PlayerSurrendered { player });
                        }
                    }
                }
                RoomManagerCommand::SubscribeRooms{ player } => {
                    if !room_subscribers.contains(&player) {
                        room_subscribers.push(player.clone());
                    }
                   let snapshot: Vec<RoomMeta> = rooms
                       .values()
                       .map(|room| room.meta.clone())
                       .collect();

                   app_ctx.connection_pool().send_to(&player, WSEvent::RoomsSnapshot { items: snapshot }).await
               }
               RoomManagerCommand::UnsubscribeRooms { player } => {
                   room_subscribers.retain(|p| p != &player);
               }
               RoomManagerCommand::FinishRoom { room_id } => {
                    let sessions: Vec<Arc<PlayerSession>> = rooms
                        .get(&room_id)
                        .map(|room| {
                            room.meta.players
                                .iter()
                                .filter_map(|p| app_ctx.connection_pool().get(&p.id))
                                .collect()
                        })
                        .unwrap_or_default();

                    for session in sessions {
                        session.mark_back_to_connected().await;
                    }

                    if rooms.remove(&room_id).is_some() {
                        app_ctx.connection_pool().broadcast(
                            room_subscribers.clone(),
                            WSEvent::RoomRemoved { room_id },
                        ).await;
                    }
               }

                RoomManagerCommand::PlayCard { player, room_id, card } => {
                    let Some(room) = rooms.get(&room_id) else {
                        app_ctx.connection_pool().send_to(
                            &player,
                            WSEvent::Error {
                                detail: "Комната не найдена".to_string(),
                            },
                        ).await;
                        continue;
                    };

                    let Some(actor) = room.actor.clone() else {
                        app_ctx.connection_pool().send_to(
                            &player,
                            WSEvent::Error {
                                detail: "Игра в комнате ещё не началась".to_string(),
                            },
                        ).await;
                        continue;
                    };

                    let _ = actor.send(RoomActorCommand::PlayCard { player, card });
                }

                RoomManagerCommand::PlayerReady { player, room_id } => {
                    let Some(room) = rooms.get(&room_id) else {
                        app_ctx.connection_pool().send_to(
                            &player,
                            WSEvent::Error {
                                detail: "Комната не найдена".to_string(),
                            },
                        ).await;
                        continue;
                    };

                    if let Some(actor) = room.actor.clone() {
                        let _ = actor.send(RoomActorCommand::PlayerReady { player });
                    }
                }

                RoomManagerCommand::PlayerDisconnected { player, room_id } => {
                    if let Some(room) = rooms.get(&room_id) {
                        if let Some(actor) = &room.actor {
                            let _ = actor.send(
                                RoomActorCommand::PlayerDisconnected { player }
                            );
                        }
                    }
                }
                RoomManagerCommand::PlayerTemporaryDisconnect { player, room_id } => {
                    if let Some(room) = rooms.get(&room_id) {
                        if let Some(actor) = &room.actor {
                            let _ = actor.send(
                                RoomActorCommand::PlayerTemporaryDisconnect { player  }
                            );
                        }
                    }
                }
                RoomManagerCommand::PlayerReconnect { player, room_id } => {
                    if let Some(room) = rooms.get(&room_id) {
                        if let Some(actor) = &room.actor {
                            let _ = actor.send(
                                RoomActorCommand::PlayerReconnect { player }
                            );
                        }
                    }
                }
                RoomManagerCommand::SpectateRoom { player, room_id } => {
                    if let Some(room) = rooms.get(&room_id) {
                        if room.meta.players.iter().any(|p| p.id == player) {
                            app_ctx.connection_pool().send_to(&player, WSEvent::Error { detail: "Вы уже находитесь в этой игре".to_string() }).await;
                            continue;
                        }
                        if let Some(actor) = &room.actor {
                            let _ = actor.send(RoomActorCommand::AddSpectator { player });
                        } else {
                            app_ctx.connection_pool().send_to(&player, WSEvent::Error { detail: "Игра еще не началась".to_string() }).await;
                        }
                    } else {
                        app_ctx.connection_pool().send_to(&player, WSEvent::Error { detail: "Комната не найдена".to_string() }).await;
                    }
                }
                RoomManagerCommand::UnspectateRoom { player, room_id } => {
                    if let Some(room) = rooms.get(&room_id) {
                        if let Some(actor) = &room.actor {
                            let _ = actor.send(RoomActorCommand::RemoveSpectator { player });
                        }
                    }
                }
                RoomManagerCommand::SponsorPlayer { player, room_id, target_id } => {
                    if let Some(room) = rooms.get(&room_id) {
                        if let Some(actor) = &room.actor {
                            let _ = actor.send(RoomActorCommand::SponsorPlayer { player, target_id });
                        }
                    }
                }

                RoomManagerCommand::Taunt { player, room_id, taunt_id } => {
                    if let Some(room) = rooms.get(&room_id) {
                        if let Some(actor) = &room.actor {
                            let _ = actor.send(RoomActorCommand::Taunt { player, taunt_id });
                        }
                    }
                }
           }

        debug!("Processed cmd. Total rooms: {}, Subscribers: {}", rooms.len(), room_subscribers.len());
        }
    });
    tx
}

async fn process_game_rewards(
    pool: &sqlx::PgPool,
    players: &Vec<PlayerMeta>,
    winner_team: Option<Team>,
    leaver: Option<i64>,
    stake: i32,
    room_id: String,
    scores: Option<std::collections::HashMap<Team, u16>>,
    replay_events: Option<Vec<crate::utils::schemas::GameReplayEvent>>,
) {
    if players.len() != 4 { return; }

    let is_bot_match = players.iter().any(|p| p.is_bot);

    let team_kaskyr = vec![players[0].id, players[2].id];
    let team_uzi = vec![players[1].id, players[3].id];
    
    let db_tx_result = pool.begin().await;
    if db_tx_result.is_err() {
        error!("Failed to begin transaction for game rewards");
        return;
    }
    let mut db_tx = db_tx_result.unwrap();

    let is_ranked = !is_bot_match;
    let mode_str = if is_bot_match { "Bot Match" } else { "Ranked 2v2" };

    let end_reason = if leaver.is_some() { "abandoned" } else { "normal" };
    let winner_str: Option<&str> = match winner_team {
        Some(Team::Kaskyr) => Some("Kaskyr"),
        Some(Team::Uzi) => Some("Uzi"),
        None => None,
    };

    let replay_json = replay_events.map(|events| serde_json::to_value(events).unwrap_or(serde_json::Value::Null));

    let match_id_row = sqlx::query(
        r#"
        INSERT INTO matches (room_id, mode, is_ranked, stake, status, end_reason, winner_team, replay_events, finished_at)
        VALUES ($1, $2, $3, $4, 'finished', $5, $6, $7, NOW())
        RETURNING id
        "#
    )
    .bind(&room_id)
    .bind(mode_str)
    .bind(is_ranked)
    .bind(stake as i64)
    .bind(end_reason)
    .bind(winner_str)
    .bind(replay_json)
    .fetch_one(&mut *db_tx).await;

    let match_id: i64 = match match_id_row {
        Ok(r) => {
            use sqlx::Row;
            r.try_get("id").unwrap_or(0)
        },
        Err(e) => {
            error!("Failed to insert match: {:?}", e);
            return;
        }
    };

    let score_str = match scores {
        Some(s) => format!("{}:{}", s.get(&Team::Kaskyr).unwrap_or(&0), s.get(&Team::Uzi).unwrap_or(&0)),
        None => "—".to_string()
    };

    let mode_str = if is_bot_match { "Bot Match" } else { "Ranked 2v2" };

    if let Some(leaver_id) = leaver {
        let penalty_rating = -30;
        let penalty_nuts = -stake;
        let compensation_rating = 10;
        let compensation_nuts = stake / 3;

        for (i, player) in players.iter().enumerate() {
            if player.is_bot {
                continue;
            }

            let is_leaver = player.id == leaver_id;
            let rating_delta = if is_bot_match { 0 } else if is_leaver { penalty_rating } else { compensation_rating };
            let nuts_delta = if is_bot_match { 0 } else if is_leaver { penalty_nuts } else { compensation_nuts };
            
            update_player_rewards(&mut db_tx, player.id, rating_delta, nuts_delta, !is_leaver, is_leaver, is_bot_match).await;

            let team_str = if team_kaskyr.contains(&player.id) { "Kaskyr" } else { "Uzi" };
            let result_str = if is_leaver { "abandoned" } else { "win" };

            let _ = sqlx::query!(
                "INSERT INTO match_players (match_id, telegram_id, team, seat, result) VALUES ($1, $2, $3, $4, $5)",
                match_id, player.id, team_str, i as i32, result_str
            ).execute(&mut *db_tx).await;

            let _ = sqlx::query(
                "INSERT INTO match_history (match_id, telegram_id, room_id, mode, result, score, rating_delta) VALUES ($1, $2, $3, $4, $5, $6, $7)"
            )
            .bind(match_id)
            .bind(player.id)
            .bind(&room_id)
            .bind(mode_str)
            .bind(result_str)
            .bind(&score_str)
            .bind(rating_delta)
            .execute(&mut *db_tx).await;
        }
    } else if let Some(winner) = winner_team {
        let win_rating = 25;
        let win_nuts = stake;
        let lose_rating = -25;
        let lose_nuts = -stake;

        for (i, player) in players.iter().enumerate() {
            if player.is_bot {
                continue;
            }

            let is_winner = (winner == Team::Kaskyr && team_kaskyr.contains(&player.id)) 
                         || (winner == Team::Uzi && team_uzi.contains(&player.id));
            
            let rating_delta = if is_bot_match { 0 } else if is_winner { win_rating } else { lose_rating };
            let nuts_delta = if is_bot_match { 0 } else if is_winner { win_nuts } else { lose_nuts };
            let result_str = if is_winner { "win" } else { "lose" };

            update_player_rewards(&mut db_tx, player.id, rating_delta, nuts_delta, is_winner, false, is_bot_match).await;

            let team_str = if team_kaskyr.contains(&player.id) { "Kaskyr" } else { "Uzi" };

            let _ = sqlx::query!(
                "INSERT INTO match_players (match_id, telegram_id, team, seat, result) VALUES ($1, $2, $3, $4, $5)",
                match_id, player.id, team_str, i as i32, result_str
            ).execute(&mut *db_tx).await;

            let _ = sqlx::query(
                "INSERT INTO match_history (match_id, telegram_id, room_id, mode, result, score, rating_delta) VALUES ($1, $2, $3, $4, $5, $6, $7)"
            )
            .bind(match_id)
            .bind(player.id)
            .bind(&room_id)
            .bind(mode_str)
            .bind(result_str)
            .bind(&score_str)
            .bind(rating_delta)
            .execute(&mut *db_tx).await;
        }
    }

    let _ = db_tx.commit().await;
}

async fn update_player_rewards(
    db_tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    player_id: i64,
    rating_delta: i32,
    nuts_delta: i32,
    is_winner: bool,
    is_leaver: bool,
    is_bot_match: bool,
) {
    let user_info = sqlx::query!("SELECT xp_booster_ends_at, nuts_booster_ends_at FROM users WHERE telegram_id = $1", player_id)
        .fetch_optional(&mut **db_tx).await.unwrap_or(None);

    let has_xp_booster = user_info.as_ref().map_or(false, |u| u.xp_booster_ends_at.map_or(false, |ts| ts > chrono::Utc::now()));
    let has_nuts_booster = user_info.as_ref().map_or(false, |u| u.nuts_booster_ends_at.map_or(false, |ts| ts > chrono::Utc::now()));

    let mut final_nuts_delta = nuts_delta;
    if final_nuts_delta > 0 && has_nuts_booster {
        final_nuts_delta *= 2;
    }

    let base_xp = if is_bot_match {
        if is_winner { 20 } else { 10 }
    } else {
        if is_winner { 50 } else if is_leaver { 0 } else { 15 }
    };

    let mut final_xp = base_xp;
    if final_xp > 0 && has_xp_booster {
        final_xp *= 2;
    }

    let _ = sqlx::query!(
        "UPDATE users SET rating = GREATEST(0, rating + $1), free_coins = GREATEST(0, free_coins + $2), xp = xp + $3 WHERE telegram_id = $4",
        rating_delta, final_nuts_delta, final_xp, player_id
    ).execute(&mut **db_tx).await;

    let quest_type = if is_bot_match {
        if is_winner { vec!["play_bot", "win_bot"] } else { vec!["play_bot"] }
    } else if is_leaver {
        vec![]
    } else {
        if is_winner { vec!["play_ranked", "win_ranked"] } else { vec!["play_ranked"] }
    };

    if !quest_type.is_empty() {
        let _ = sqlx::query(
            "UPDATE user_quest_progress 
             SET current_amount = current_amount + 1 
             WHERE telegram_id = $1 
             AND is_completed = FALSE 
             AND quest_id IN (SELECT id FROM event_quests WHERE quest_type = ANY($2) AND event_id IN (SELECT id FROM events WHERE is_active = TRUE AND start_time <= NOW() AND end_time >= NOW()))"
        ).bind(player_id).bind(&quest_type).execute(&mut **db_tx).await;

        let _ = sqlx::query(
            "UPDATE user_quest_progress 
             SET is_completed = TRUE 
             WHERE telegram_id = $1 
             AND is_completed = FALSE 
             AND current_amount >= (SELECT target_amount FROM event_quests WHERE id = user_quest_progress.quest_id)"
        ).bind(player_id).execute(&mut **db_tx).await;
    }
}

fn start_room_actor(
    room_id: RoomId,
    players: Vec<PlayerMeta>,
    room_manager_tx: mpsc::UnboundedSender<RoomManagerCommand>,
    stake: i32,
) -> mpsc::UnboundedSender<RoomActorCommand> {
    fn build_snapshot(
        room_id: &RoomId,
        state: &GameState,
        players: &Vec<PlayerMeta>,
        player_positions: &BiMap<PlayerId, PlayerPosition>,
    ) -> GameSnapshot {

        let players_info = players.iter().map(|meta| {
            let pos = *player_positions.get_by_left(&meta.id).unwrap();
            PlayerInfo {
                meta: meta.clone(),
                position: pos,
                team: pos.team(),
            }
        }).collect();

        GameSnapshot {
            room_id: room_id.clone(),
            players: players_info,
            trump: state.trump,
            player_trump_map: state.player_trump_map.clone(),
            club_jack_owner: state.club_jack_owner,
            eyes: state.team_eye.clone(),
            scores: state.team_scores.clone(),
            current_turn: state.current_turn,
            current_trick: state.current_trick.clone(),
            last_trick: state.last_trick.clone()
        }
    }

    let (tx, mut rx) = mpsc::unbounded_channel();
    let player_ids: Vec<PlayerId> = players.iter().map(|meta| meta.id).collect();

    let tx_actor = tx.clone();
    tokio::spawn(async move {
        // let mut subs: Vec<mpsc::UnboundedSender<WSEvent>> = Vec::new();
        let app_ctx = get_global_context();
        let mut player_positions: BiMap<PlayerId, PlayerPosition> = BiMap::new();
        let mut state = GameState::new();
        let mut disconnected: HashMap<PlayerId, Instant> = HashMap::new();
        let mut spectators: std::collections::HashSet<PlayerId> = std::collections::HashSet::new();

        let is_bot_match = players.iter().any(|p| p.is_bot);
        if !is_bot_match {
            let mut ready_players = std::collections::HashSet::new();
            
            // Broadcast ReadyCheckStarted
            let expires_at = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs() + 20;
            app_ctx.connection_pool().broadcast(
                player_ids.clone(),
                WSEvent::ReadyCheckStarted { expires_at, room_id: room_id.clone(), players: players.clone() }
            ).await;
            
            let tx_ready = tx_actor.clone();
            tokio::spawn(async move {
                tokio::time::sleep(std::time::Duration::from_secs(20)).await;
                let _ = tx_ready.send(RoomActorCommand::ReadyTimeout);
            });
            
            let mut ready_aborted = false;
            while let Some(cmd) = rx.recv().await {
                match cmd {
                    RoomActorCommand::PlayerReady { player } => {
                        ready_players.insert(player);
                        app_ctx.connection_pool().broadcast(
                            player_ids.clone(),
                            WSEvent::ReadyCheckUpdate { ready_players: ready_players.iter().cloned().collect() }
                        ).await;
                        if ready_players.len() == 4 {
                            break;
                        }
                    }
                    RoomActorCommand::ReadyTimeout => {
                        app_ctx.connection_pool().broadcast(
                            player_ids.clone(),
                            WSEvent::Error { detail: "Не все игроки подтвердили готовность. Комната распущена.".to_string() }
                        ).await;
                        app_ctx.connection_pool().broadcast(
                            player_ids.clone(),
                            WSEvent::GameClose { reason: "Отмена игры".to_string() }
                        ).await;
                        ready_aborted = true;
                        break;
                    }
                    RoomActorCommand::PlayerDisconnected { player } => {
                        app_ctx.connection_pool().broadcast(
                            player_ids.clone(),
                            WSEvent::Error { detail: "Игрок покинул комнату во время проверки. Комната распущена.".to_string() }
                        ).await;
                        app_ctx.connection_pool().broadcast(
                            player_ids.clone(),
                            WSEvent::GameClose { reason: "Отмена игры".to_string() }
                        ).await;
                        ready_aborted = true;
                        break;
                    }
                    _ => {}
                }
            }
            if ready_aborted {
                let _ = room_manager_tx.send(RoomManagerCommand::FinishRoom { room_id: room_id.clone() });
                return;
            }
        }

        let mut turn_counter: u64 = 0;
        let mut replay_events: Vec<crate::utils::schemas::GameReplayEvent> = Vec::new();

        replay_events.push(crate::utils::schemas::GameReplayEvent::RoundStart {
            hands: state.hands.iter().map(|(k, v)| (format!("{:?}", k), v.clone())).collect(),
            player_trumps: state.player_trump_map.iter().map(|(k, v)| (format!("{:?}", k), v.clone())).collect(),
        });

        for (i, pos) in [PlayerPosition::North, PlayerPosition::East, PlayerPosition::South, PlayerPosition::West].iter().enumerate() {
            if let Some(player) = players.get(i) {
                if let Some(session) = app_ctx.connection_pool().get(&player.id) {
                    session.mark_as_in_game(room_id.clone(), *pos).await;
                } else {
                    if !player.is_bot {
                        warn!("Player {} dropped immediately after room start", player.id);
                    }
                }
                player_positions.insert(player.id, *pos);
                app_ctx.connection_pool().send_to(
                    &player.id,
                    WSEvent::YourHand{cards: state.hands.get(pos).unwrap().to_vec()}
                ).await;
            } else {
                warn!("Expected 4 players, found fewer. State might be inconsistent.");
            }
        }

        for idx in player_ids.iter(){
            let snapshot = build_snapshot(&room_id, &state, &players, &player_positions);
            app_ctx.connection_pool().send_to(
                &idx,
                WSEvent::GameSnapshot(snapshot)
            ).await;

        }


        let trigger_bot_turn = |current_turn: PlayerPosition, state: &GameState, players: &Vec<PlayerMeta>, player_positions: &BiMap<PlayerId, PlayerPosition>, tx: mpsc::UnboundedSender<RoomActorCommand>| {
            if let Some(bot_id) = player_positions.get_by_right(&current_turn) {
                if let Some(meta) = players.iter().find(|p| p.id == *bot_id) {
                    if meta.is_bot && !state.paused {
                        let difficulty = meta.bot_difficulty.clone().unwrap_or(crate::utils::schemas::BotDifficulty::Medium);
                        let best_card = crate::core::bot::determine_bot_move(state, current_turn, difficulty);
                        let tx_clone = tx.clone();
                        let bot_id_val = *bot_id;
                        tokio::spawn(async move {
                            tokio::time::sleep(std::time::Duration::from_millis(1500)).await;
                            let _ = tx_clone.send(RoomActorCommand::PlayCard { player: bot_id_val, card: best_card });
                        });
                    }
                }
            }
        };

        let spawn_turn_timeout = |turn: u64, current_player_pos: PlayerPosition, player_positions: &BiMap<PlayerId, PlayerPosition>, tx: mpsc::UnboundedSender<RoomActorCommand>| {
            if let Some(player_id) = player_positions.get_by_right(&current_player_pos) {
                let pid = *player_id;
                tokio::spawn(async move {
                    tokio::time::sleep(std::time::Duration::from_secs(60)).await;
                    let _ = tx.send(RoomActorCommand::TurnTimeout { player: pid, turn });
                });
            }
        };

        turn_counter += 1;
        spawn_turn_timeout(turn_counter, state.current_turn, &player_positions, tx_actor.clone());
        trigger_bot_turn(state.current_turn, &state, &players, &player_positions, tx_actor.clone());

        while let Some(cmd) = rx.recv().await {
            debug!("Room {} processing ActorCommand: {:?}", room_id, cmd);
            match cmd {
                RoomActorCommand::PlayCard { player, card } => {
                    let Some(player_position) = player_positions.get_by_left(&player) else {
                        warn!("Room {} received PlayCard from player {} who is not in the room. Ignoring.", room_id, player);
                        continue;
                    };
                    
                    match state.play_card(*player_position, card){
                        Ok(_) => {
                            replay_events.push(crate::utils::schemas::GameReplayEvent::PlayCard {
                                position: *player_position,
                                card,
                            });
                            let mut all_targets = player_ids.clone();
                            all_targets.extend(spectators.iter());

                            app_ctx.connection_pool().broadcast(
                                all_targets.clone(),
                                WSEvent::CardPlayed{position: *player_position, card}
                            ).await;

                            if let Some(updated_hand) = state.hands.get(player_position) {
                                app_ctx.connection_pool().send_to(
                                    &player,
                                    WSEvent::YourHand {
                                        cards: updated_hand.clone(),
                                    }
                                ).await;
                            }
                            // если взятка завершенна
                            if let Some(winner) = state.resolve_trick() {
                                replay_events.push(crate::utils::schemas::GameReplayEvent::TrickWon {
                                    position: winner,
                                    team: winner.team(),
                                });

                                let mut all_targets = player_ids.clone();
                                all_targets.extend(spectators.iter());

                                app_ctx.connection_pool().broadcast(
                                    all_targets.clone(),
                                    WSEvent::TrickWon{position: winner, team: winner.team()}
                                ).await;
                                // если раунд закончен
                                if state.hands.values().all(|h| h.is_empty()) {
                                    let _ = state.update_eye_after_round();
                                    state.update_team_score_afrer_round();
                                    
                                    replay_events.push(crate::utils::schemas::GameReplayEvent::RoundEnd {
                                        scores: state.team_scores.iter().map(|(k, v)| (format!("{:?}", k), *v)).collect(),
                                        eyes: state.team_eye.iter().map(|(k, v)| (format!("{:?}", k), *v)).collect(),
                                    });

                                    let eye = state.team_eye.clone();
                                    let _ = state.update_hands(); //
                                    state.update_round_trump();
                                    state.update_round_attacking_team();
                                    
                                    replay_events.push(crate::utils::schemas::GameReplayEvent::RoundStart {
                                        hands: state.hands.iter().map(|(k, v)| (format!("{:?}", k), v.clone())).collect(),
                                        player_trumps: state.player_trump_map.iter().map(|(k, v)| (format!("{:?}", k), v.clone())).collect(),
                                    });


                                    for player in &players.clone() {
                                        if let Some(pos) = player_positions.get_by_left(&player.id) {
                                            if let Some(hand) = state.hands.get(pos) {
                                                let _ = app_ctx.connection_pool().send_to(
                                                    &player.id,
                                                    WSEvent::YourHand { cards: hand.clone() }
                                                ).await;
                                            }
                                        }
                                    }

                                    if eye.get(&Team::Kaskyr).copied().unwrap_or(0) >= 12 || eye.get(&Team::Uzi).copied().unwrap_or(0) >= 12 {
                                        let winner_team = if eye.get(&Team::Kaskyr).copied().unwrap_or(0) >= 12 {
                                            Team::Kaskyr
                                        } else {
                                            Team::Uzi
                                        };
                                        process_game_rewards(&app_ctx.db_pool, &players, Some(winner_team), None, stake, room_id.clone(), Some(state.team_eye.clone()), Some(replay_events.clone())).await;

                                        let mut all_targets = player_ids.clone();
                                        all_targets.extend(spectators.iter());

                                        app_ctx.connection_pool().broadcast(
                                            all_targets.clone(),
                                            WSEvent::GameOver {
                                                scores: state.team_eye.clone()
                                            }
                                        ).await;
                                        break;
                                    }
                                }
                            }
                            let snapshot = build_snapshot(&room_id, &state, &players, &player_positions);

                            let mut all_targets = player_ids.clone();
                            all_targets.extend(spectators.iter());

                            app_ctx.connection_pool().broadcast(
                                all_targets.clone(),
                                WSEvent::GameSnapshot(snapshot)
                            ).await;
                            turn_counter += 1;
                            spawn_turn_timeout(turn_counter, state.current_turn, &player_positions, tx_actor.clone());
                            trigger_bot_turn(state.current_turn, &state, &players, &player_positions, tx_actor.clone());
                        }
                        Err(e) => {
                            app_ctx.connection_pool().send_to(
                                &player.clone(),
                                WSEvent::Error { detail: e.to_string() }
                            ).await
                        }
                    }
                }
                RoomActorCommand::TurnTimeout { player, turn } => {
                    if turn == turn_counter {
                        warn!("Player {} failed to make a move within 60s", player);
                        process_game_rewards(&app_ctx.db_pool, &players, None, Some(player), stake, room_id.clone(), Some(state.team_eye.clone()), Some(replay_events.clone())).await;
                        
                        let mut all_targets = player_ids.clone();
                        all_targets.extend(spectators.iter());
                        app_ctx.connection_pool().broadcast(
                            all_targets.clone(),
                            WSEvent::GameClose { reason: "Вы вышли за лимит времени на ход".to_string() }
                        ).await;
                        
                        let _ = room_manager_tx.send(RoomManagerCommand::FinishRoom { room_id: room_id.clone() });
                        break;
                    }
                }
                RoomActorCommand::PlayerDisconnected { player } => {
                    process_game_rewards(&app_ctx.db_pool, &players, None, Some(player), stake, room_id.clone(), Some(state.team_eye.clone()), Some(replay_events.clone())).await;
                    
                    app_ctx.connection_pool().disconnect(&player).await;

                    let mut all_targets = player_ids.clone();
                    all_targets.extend(spectators.iter());

                    app_ctx.connection_pool().broadcast(
                        all_targets.clone(),
                        WSEvent::GameClose {
                            reason: format!("Player {} disconnected", player),
                        },
                    ).await;
                    break;
                }
                RoomActorCommand::PlayerTemporaryDisconnect { player } => {

                    disconnected.insert(player.clone(), Instant::now());
                    state.paused = true;

                    let Some(pos) = player_positions.get_by_left(&player) else {
                        warn!("TemporaryDisconnect from non-member player {} in room {}", player, room_id);
                        continue;
                    };

                    let mut all_targets = player_ids.clone();
                    all_targets.extend(spectators.iter());

                    app_ctx.connection_pool().broadcast(
                        all_targets.clone(),
                        WSEvent::PlayerDisconnected {
                            position: *pos
                        }
                    ).await;

                    // Запускаем таймер 30 секунд
                    let room_id_clone = room_id.clone();
                    let manager_tx_clone = room_manager_tx.clone();
                    let player_clone = player.clone();

                    tokio::spawn(async move {
                        tokio::time::sleep(Duration::from_secs(30)).await;

                        let app_ctx = get_global_context();

                        if let Some(session) = app_ctx.connection_pool().get(&player_clone) {
                            let status_now = session.status.read().await.clone();

                            if let PlayerStatus::InGame { disconnected_at: Some(ts), .. } = status_now {
                                if ts.elapsed() >= Duration::from_secs(30) {
                                    let _ = manager_tx_clone.send(
                                        RoomManagerCommand::PlayerDisconnected {
                                            player: player_clone,
                                            room_id: room_id_clone,
                                        }
                                    );
                                }
                            }
                        }
                    });
                }
                RoomActorCommand::PlayerReconnect { player } => {


                    disconnected.remove(&player);

                    if let Some(session) = app_ctx.connection_pool().get(&player) {
                        if let PlayerStatus::InGame { disconnected_at, position, .. } =
                            &mut *session.status.write().await
                        {
                            *disconnected_at = None;

                            // отправить snapshot
                            let pos = *position;
                            let snapshot = build_snapshot(&room_id, &state, &players, &player_positions);

                            let mut all_targets = player_ids.clone();
                            all_targets.extend(spectators.iter());

                            app_ctx.connection_pool().broadcast(
                                all_targets.clone(),
                                WSEvent::PlayerReconnected { position: pos }
                            ).await;

                            app_ctx.connection_pool().send_to(
                                &player,
                                WSEvent::GameSnapshot (snapshot)
                            ).await;

                            app_ctx.connection_pool().send_to(
                                &player,
                                WSEvent::YourHand {
                                    cards: state.hands.get(&pos).unwrap().clone()
                                }
                            ).await;
                        }
                    }

                    if disconnected.is_empty() {
                        state.paused = false;
                    }
                }
                RoomActorCommand::PlayerSurrendered { player } => {
                    process_game_rewards(&app_ctx.db_pool, &players, None, Some(player), stake, room_id.clone(), Some(state.team_eye.clone()), Some(replay_events.clone())).await;

                    let mut all_targets = player_ids.clone();
                    all_targets.extend(spectators.iter());

                    let _ = app_ctx.connection_pool().broadcast(
                        all_targets.clone(),
                        WSEvent::GameClose {
                            reason: format!("Игрок покинул игру/сдался"),
                        },
                    ).await;

                    let _ = room_manager_tx.send(RoomManagerCommand::FinishRoom { room_id: room_id.clone() });
                    break;
                }
                RoomActorCommand::AddSpectator { player } => {
                    spectators.insert(player);
                    if let Some(session) = app_ctx.connection_pool().get(&player) {
                        session.mark_as_spectating(room_id.clone()).await;
                        let snapshot = build_snapshot(&room_id, &state, &players, &player_positions);
                        let _ = session.send(WSEvent::GameSnapshot(snapshot)).await;
                    }

                    let mut all_targets = player_ids.clone();
                    all_targets.extend(spectators.iter());
                    let _ = app_ctx.connection_pool().broadcast(
                        all_targets,
                        WSEvent::SpectatorCountUpdated { count: spectators.len() }
                    ).await;
                }
                RoomActorCommand::RemoveSpectator { player } => {
                    spectators.remove(&player);
                    if let Some(session) = app_ctx.connection_pool().get(&player) {
                        let _ = session.mark_back_to_connected().await;
                    }

                    let mut all_targets = player_ids.clone();
                    all_targets.extend(spectators.iter());
                    let _ = app_ctx.connection_pool().broadcast(
                        all_targets,
                        WSEvent::SpectatorCountUpdated { count: spectators.len() }
                    ).await;
                }
                RoomActorCommand::SponsorPlayer { player, target_id } => {
                    let pool = &app_ctx.db_pool;
                    if let Ok(Some(sender)) = sqlx::query!("SELECT free_coins FROM users WHERE telegram_id = $1", player).fetch_optional(pool).await {
                        let coins = sender.free_coins;
                        if coins >= stake + 1 {
                            let _ = sqlx::query!("UPDATE users SET free_coins = free_coins - 1 WHERE telegram_id = $1", player).execute(pool).await;
                            let _ = sqlx::query!("UPDATE users SET free_coins = COALESCE(free_coins, 0) + 1 WHERE telegram_id = $1", target_id).execute(pool).await;
                            let mut all_targets = player_ids.clone();
                            all_targets.extend(spectators.iter());
                            let _ = app_ctx.connection_pool().broadcast(
                                all_targets,
                                WSEvent::SponsorAction {
                                    from_id: player,
                                    to_id: target_id,
                                }
                            ).await;
                        }
                    }
                }

                RoomActorCommand::Taunt { player, taunt_id } => {
                    if let Some(position) = player_positions.get_by_left(&player) {
                        let mut all_targets = player_ids.clone();
                        all_targets.extend(spectators.iter());
                        let _ = app_ctx.connection_pool().broadcast(
                            all_targets,
                            WSEvent::Taunt {
                                position: *position,
                                taunt_id,
                            }
                        ).await;
                    }
                }
                RoomActorCommand::PlayerReady { .. } | RoomActorCommand::ReadyTimeout => {}
            };
        }

        for spec in spectators {
            if let Some(session) = app_ctx.connection_pool().get(&spec) {
                let _ = session.mark_back_to_connected().await;
            }
        }

        let _ = room_manager_tx.send(
            RoomManagerCommand::FinishRoom { room_id }
        );
    });
    tx
}

pub fn start_queue_manager(
    room_tx: mpsc::UnboundedSender<RoomManagerCommand>,
) -> mpsc::UnboundedSender<QueueCommand> {
    info!("Start queue manager");
    let (tx, mut rx) = mpsc::unbounded_channel();

    tokio::spawn(async move {
        let mut queues: HashMap<QueueKey, VecDeque<PlayerId>> = HashMap::new();

        while let Some(cmd) = rx.recv().await {
            match cmd {
                QueueCommand::Enqueue { player, key } => {
                    queues.entry(key).or_default().push_back(player);
                    try_match(&mut queues, &room_tx);
                }

                QueueCommand::Dequeue { player, key } => {
                    if let Some(q) = queues.get_mut(&key) {
                        q.retain(|p| p != &player);
                        if q.is_empty() {
                            queues.remove(&key);
                        }
                    }
                }

                QueueCommand::Disconnect { player } => {
                    for q in queues.values_mut() {
                        q.retain(|p| p != &player);
                    }
                }
            }
        }
    });

    tx
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::context::{AppContext, set_global_context};
    use crate::utils::schemas::{QueueKey, Currency, League, PlayerId, RoomKind, RoomManagerCommand, QueueCommand};
    use std::collections::{HashMap, VecDeque};
    use std::sync::{Arc, Mutex};
    use tokio::sync::mpsc;
    use sqlx::PgPool;

    // Helper to setup mock global context once for all tests
    static INIT: std::sync::Once = std::sync::Once::new();

    pub fn setup_mock_context() {
        INIT.call_once(|| {
            std::env::set_var("SECRET_KEY", "mock_secret_key");
            std::env::set_var("BOT_TOKEN", "mock_bot_token");
            std::env::set_var("DATABASE_URL", "postgres://mock"); // in case
            // Lazy postgres pool that doesn't immediately connect
            let db_pool = PgPool::connect_lazy_with(sqlx::postgres::PgConnectOptions::new());
            let (room_tx, _) = mpsc::unbounded_channel();
            let (queue_tx, _) = mpsc::unbounded_channel();
            let app_ctx = Arc::new(AppContext::new(room_tx, queue_tx, db_pool));
            set_global_context(app_ctx);
        });
    }

    #[tokio::test]
    async fn test_try_match() {
        let (room_tx, mut room_rx) = mpsc::unbounded_channel();
        let mut queues = HashMap::new();
        
        let key = QueueKey {
            stake: rust_decimal::Decimal::new(100, 0),
            currency: Currency::Virtual,
            league: League::Bronze,
        };

        let mut queue = VecDeque::new();
        queue.push_back(1);
        queue.push_back(2);
        queue.push_back(3);
        queues.insert(key.clone(), queue);

        try_match(&mut queues, &room_tx);
        assert!(room_rx.try_recv().is_err());
        assert_eq!(queues.get(&key).unwrap().len(), 3);

        queues.get_mut(&key).unwrap().push_back(4);
        try_match(&mut queues, &room_tx);

        assert_eq!(queues.get(&key).unwrap().len(), 0);
        let cmd = room_rx.try_recv().unwrap();
        
        if let RoomManagerCommand::CreateRoom { players, kind, .. } = cmd {
            assert_eq!(players, vec![1, 2, 3, 4]);
            if let RoomKind::Queue = kind {
                // Ok
            } else {
                panic!("Expected RoomKind::Queue");
            }
        } else {
            panic!("Expected CreateRoom command");
        }
    }

    #[tokio::test]
    async fn test_queue_enqueue_dequeue() {
        setup_mock_context();
        let (room_tx, _) = mpsc::unbounded_channel();
        let queue_tx = start_queue_manager(room_tx);

        let key = QueueKey {
            stake: rust_decimal::Decimal::new(10, 0),
            currency: Currency::RealMoney,
            league: League::Silver,
        };

        let _ = queue_tx.send(QueueCommand::Enqueue { player: 10, key: key.clone() });
        let _ = queue_tx.send(QueueCommand::Dequeue { player: 10, key: key.clone() });
        
        tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;
        assert!(true);
    }

    #[tokio::test]
    async fn test_malicious_play_card_no_crash() {
        setup_mock_context();
        let (manager_tx, _manager_rx) = mpsc::unbounded_channel();
        
        let app_ctx = get_global_context();
        
        let mut mock_players = vec![];
        for id in 1..=4 {
            let meta = crate::utils::schemas::PlayerMeta { id, username: None, rating: 1000, photo_url: None };
            app_ctx.connection_pool().pool(meta.clone(), mpsc::unbounded_channel().0).await;
            mock_players.push(meta);
        }

        let room_id = "test_room".to_string();
        let actor_tx = start_room_actor(room_id.clone(), mock_players, manager_tx, 100);

        let attacker_id = 999;
        let card = Card { suit: crate::utils::schemas::Suit::Spades, rank: crate::utils::schemas::Rank::Ace };
        
        let res = actor_tx.send(RoomActorCommand::PlayCard { player: attacker_id, card });
        assert!(res.is_ok());

        tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;

        let is_alive = !actor_tx.is_closed();
        assert!(is_alive, "Actor crashed due to panicking unwrap!");
    }
}
