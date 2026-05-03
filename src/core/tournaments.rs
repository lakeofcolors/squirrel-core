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
