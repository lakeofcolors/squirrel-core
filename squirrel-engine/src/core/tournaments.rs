use sqlx::PgPool;
use tokio::sync::mpsc;
use tokio::time::{sleep, Duration};
use tracing::{info, error};
use uuid::Uuid;
use rand::seq::SliceRandom;
use crate::utils::schemas::RoomManagerCommand;

pub fn start_tournament_manager(
    pool: PgPool,
    room_manager_tx: mpsc::UnboundedSender<RoomManagerCommand>,
) {
    tokio::spawn(async move {
        info!("Starting tournament manager background task");
        loop {
            // Process tournaments every 30 seconds
            if let Err(e) = check_and_start_tournaments(&pool, &room_manager_tx).await {
                error!("Error checking tournaments: {}", e);
            }
            if let Err(e) = advance_tournament_rounds(&pool, &room_manager_tx).await {
                error!("Error advancing tournament rounds: {}", e);
            }
            sleep(Duration::from_secs(30)).await;
        }
    });
}

async fn check_and_start_tournaments(
    pool: &PgPool,
    room_manager_tx: &mpsc::UnboundedSender<RoomManagerCommand>,
) -> Result<(), String> {
    // Find upcoming tournaments whose start time has arrived
    let tournaments = sqlx::query!(
        r#"
        SELECT id, start_time, title 
        FROM tournaments 
        WHERE status = 'upcoming' AND start_time <= NOW()
        "#
    )
    .fetch_all(pool)
    .await
    .map_err(|e| format!("DB Error: {}", e))?;

    for t in tournaments {
        info!("Starting tournament {} ({})", t.id, t.title);
        
        let mut tx = pool.begin().await.map_err(|e| format!("DB Error: {}", e))?;
        
        // Update status to active
        sqlx::query!("UPDATE tournaments SET status = 'active' WHERE id = $1", t.id)
            .execute(&mut *tx)
            .await
            .map_err(|e| format!("DB Error: {}", e))?;
            
        // Fetch registered clans
        let mut clans = sqlx::query!(
            "SELECT clan_id FROM tournament_registrations WHERE tournament_id = $1", 
            t.id
        )
        .fetch_all(&mut *tx)
        .await
        .map_err(|e| format!("DB Error: {}", e))?
        .into_iter()
        .map(|r| r.clan_id)
        .collect::<Vec<_>>();
        
        // If not enough clans, we might want to just cancel
        if clans.len() < 2 {
            info!("Tournament {} has less than 2 clans, cancelling.", t.id);
            sqlx::query!("UPDATE tournaments SET status = 'finished' WHERE id = $1", t.id)
                .execute(&mut *tx)
                .await
                .map_err(|e| format!("DB Error: {}", e))?;
            tx.commit().await.map_err(|e| format!("DB Error: {}", e))?;
            continue;
        }

        // Shuffle clans for random bracket
        {
            let mut rng = rand::thread_rng();
            clans.shuffle(&mut rng);
        }

        // Pair them up
        let num_clans = clans.len();
        
        let next_pow_2 = num_clans.next_power_of_two();
        let num_byes = next_pow_2 - num_clans;
        
        let mut match_pairs = Vec::new();
        let mut clan_idx = 0;
        
        // Assign byes
        for _ in 0..num_byes {
            match_pairs.push((clans[clan_idx], None));
            clan_idx += 1;
        }
        
        // Assign real matches
        while clan_idx < num_clans {
            match_pairs.push((clans[clan_idx], Some(clans[clan_idx + 1])));
            clan_idx += 2;
        }
        
        // Now create matches in DB
        for (idx, (clan1, clan2_opt)) in match_pairs.into_iter().enumerate() {
            if let Some(clan2) = clan2_opt {
                let room_id = Uuid::new_v4().to_string();
                // Normal match
                let inserted = sqlx::query!(
                    r#"
                    INSERT INTO tournament_matches (tournament_id, round, clan1_id, clan2_id, match_index, room_id)
                    VALUES ($1, $2, $3, $4, $5, $6)
                    RETURNING id
                    "#,
                    t.id, 1, clan1, clan2, idx as i32, room_id.clone()
                )
                .fetch_one(&mut *tx)
                .await
                .map_err(|e| format!("DB Error: {}", e))?;
                
                let match_id = inserted.id;
                
                // Fetch players for both clans to invite
                let players = sqlx::query!(
                    r#"
                    SELECT telegram_id 
                    FROM tournament_squads 
                    WHERE registration_id IN (
                        SELECT id FROM tournament_registrations 
                        WHERE tournament_id = $1 AND clan_id IN ($2, $3)
                    )
                    "#,
                    t.id, clan1, clan2
                )
                .fetch_all(&mut *tx)
                .await
                .map_err(|e| format!("DB Error: {}", e))?
                .into_iter()
                .filter_map(|r| r.telegram_id)
                .collect::<Vec<_>>();
                
                // Dispatch CreateTournamentRoom
                let _ = room_manager_tx.send(RoomManagerCommand::CreateTournamentRoom {
                    room_id,
                    tournament_id: t.id,
                    match_id,
                    players,
                });
                
            } else {
                // Bye match (clan1 automatically wins)
                sqlx::query!(
                    r#"
                    INSERT INTO tournament_matches (tournament_id, round, clan1_id, match_index, winner_id)
                    VALUES ($1, $2, $3, $4, $5)
                    "#,
                    t.id, 1, clan1, idx as i32, clan1
                )
                .execute(&mut *tx)
                .await
                .map_err(|e| format!("DB Error: {}", e))?;
            }
        }
        
        tx.commit().await.map_err(|e| format!("DB Error: {}", e))?;
        info!("Tournament {} successfully initialized with bracket.", t.id);
    }
    
    Ok(())
}

async fn advance_tournament_rounds(
    pool: &PgPool,
    room_manager_tx: &mpsc::UnboundedSender<RoomManagerCommand>,
) -> Result<(), String> {
    let active_tournaments = sqlx::query!("SELECT id FROM tournaments WHERE status = 'active'")
        .fetch_all(pool)
        .await
        .map_err(|e| format!("DB Error: {}", e))?;

    for t in active_tournaments {
        let mut tx = pool.begin().await.map_err(|e| format!("DB Error: {}", e))?;

        // Handle timeouts: any match created > 5 mins ago with no winner
        let timeout_matches = sqlx::query!(
            "SELECT id, room_id, clan1_id, clan2_id FROM tournament_matches WHERE tournament_id = $1 AND winner_id IS NULL AND created_at < NOW() - INTERVAL '5 minutes'",
            t.id
        ).fetch_all(&mut *tx).await.map_err(|e| format!("DB Error: {}", e))?;

        for tm in timeout_matches {
            // Assign random winner for timeout
            let winner_id = if rand::random() { tm.clan1_id } else { tm.clan2_id };
            sqlx::query!("UPDATE tournament_matches SET winner_id = $1 WHERE id = $2", winner_id, tm.id)
                .execute(&mut *tx).await.map_err(|e| format!("DB Error: {}", e))?;
                
            // Send FinishRoom to the engine to clean it up
            if let Some(room_id) = tm.room_id {
                let _ = room_manager_tx.send(RoomManagerCommand::FinishRoom { room_id });
            }
        }

        // Get max round for this tournament
        let max_round_row = sqlx::query!("SELECT MAX(round) as max_round FROM tournament_matches WHERE tournament_id = $1", t.id)
            .fetch_one(&mut *tx).await.map_err(|e| format!("DB Error: {}", e))?;
            
        let current_round = max_round_row.max_round.unwrap_or(1);

        // Check if all matches in current_round have a winner
        let unfinished_count = sqlx::query!("SELECT COUNT(*) as count FROM tournament_matches WHERE tournament_id = $1 AND round = $2 AND winner_id IS NULL", t.id, current_round)
            .fetch_one(&mut *tx).await.map_err(|e| format!("DB Error: {}", e))?
            .count.unwrap_or(0);

        if unfinished_count == 0 {
            // All matches in current round are finished!
            let matches_in_round = sqlx::query!("SELECT id, winner_id, match_index FROM tournament_matches WHERE tournament_id = $1 AND round = $2 ORDER BY match_index ASC", t.id, current_round)
                .fetch_all(&mut *tx).await.map_err(|e| format!("DB Error: {}", e))?;

            if matches_in_round.len() == 1 {
                // Final round is over!
                let final_winner = matches_in_round[0].winner_id;
                sqlx::query!("UPDATE tournaments SET status = 'finished' WHERE id = $1", t.id)
                    .execute(&mut *tx).await.map_err(|e| format!("DB Error: {}", e))?;

                // Distribute rewards to the winning clan's registered squad members
                if let Some(winner_clan_id) = final_winner {
                    let squad_members = sqlx::query!(
                        r#"
                        SELECT telegram_id FROM tournament_squads 
                        WHERE registration_id = (
                            SELECT id FROM tournament_registrations WHERE tournament_id = $1 AND clan_id = $2
                        )
                        "#,
                        t.id, winner_clan_id
                    ).fetch_all(&mut *tx).await.map_err(|e| format!("DB Error: {}", e))?;

                    for member in squad_members {
                        if let Some(tid) = member.telegram_id {
                            // Give 1000 tournament coins to the winners
                            sqlx::query!("UPDATE users SET tournament_coins = tournament_coins + 1000 WHERE telegram_id = $1", tid)
                                .execute(&mut *tx).await.map_err(|e| format!("DB Error: {}", e))?;
                        }
                    }
                }
                info!("Tournament {} finished! Rewards distributed.", t.id);
            } else if matches_in_round.len() > 1 {
                // Generate next round
                let next_round = current_round + 1;
                
                // First check if we ALREADY generated next_round!
                let next_round_exists = sqlx::query!("SELECT COUNT(*) as count FROM tournament_matches WHERE tournament_id = $1 AND round = $2", t.id, next_round)
                    .fetch_one(&mut *tx).await.map_err(|e| format!("DB Error: {}", e))?.count.unwrap_or(0);
                    
                if next_round_exists == 0 {
                    let mut clan_idx = 0;
                    let mut match_idx = 0;
                    while clan_idx < matches_in_round.len() {
                        let clan1 = matches_in_round[clan_idx].winner_id;
                        let clan2_opt = if clan_idx + 1 < matches_in_round.len() {
                            matches_in_round[clan_idx + 1].winner_id
                        } else {
                            None
                        };
    
                        if let Some(clan2) = clan2_opt {
                            let room_id = Uuid::new_v4().to_string();
                            let inserted = sqlx::query!(
                                r#"
                                INSERT INTO tournament_matches (tournament_id, round, clan1_id, clan2_id, match_index, room_id)
                                VALUES ($1, $2, $3, $4, $5, $6)
                                RETURNING id
                                "#,
                                t.id, next_round, clan1, clan2, match_idx as i32, room_id.clone()
                            ).fetch_one(&mut *tx).await.map_err(|e| format!("DB Error: {}", e))?;
                            
                            let match_id = inserted.id;
    
                            let players = sqlx::query!(
                                r#"
                                SELECT telegram_id FROM tournament_squads 
                                WHERE registration_id IN (
                                    SELECT id FROM tournament_registrations WHERE tournament_id = $1 AND clan_id IN ($2, $3)
                                )
                                "#,
                                t.id, clan1, clan2
                            ).fetch_all(&mut *tx).await.map_err(|e| format!("DB Error: {}", e))?
                            .into_iter().filter_map(|r| r.telegram_id).collect::<Vec<_>>();
    
                            let _ = room_manager_tx.send(RoomManagerCommand::CreateTournamentRoom {
                                room_id,
                                tournament_id: t.id,
                                match_id,
                                players,
                            });
                        } else {
                            // Bye match
                            sqlx::query!(
                                r#"
                                INSERT INTO tournament_matches (tournament_id, round, clan1_id, match_index, winner_id)
                                VALUES ($1, $2, $3, $4, $5)
                                "#,
                                t.id, next_round, clan1, match_idx as i32, clan1
                            ).execute(&mut *tx).await.map_err(|e| format!("DB Error: {}", e))?;
                        }
    
                        clan_idx += 2;
                        match_idx += 1;
                    }
                    info!("Tournament {} advanced to round {}", t.id, next_round);
                }
            }
        }

        tx.commit().await.map_err(|e| format!("DB Error: {}", e))?;
    }

    Ok(())
}
