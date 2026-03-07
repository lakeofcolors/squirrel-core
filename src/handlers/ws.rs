use axum::{
    http::{StatusCode, HeaderMap},
    response::IntoResponse,
};
use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::Extension;
use futures_util::StreamExt;
use futures_util::SinkExt;
use std::{sync::Arc, time::Duration};
use tokio::sync::{Mutex, mpsc::{self, UnboundedReceiver, UnboundedSender}};
use tracing::{info, warn, debug, error};

use crate::{
    core::context::AppContext,
    core::pool::{PlayerSession, ConnectionPool, PlayerStatus},
    utils::schemas::{QueueCommand, QueueKey, Card, Rank, Suit, PlayerPosition, WSIncomingMessage, WSEvent, WSCardPlayed, WSTrickWon, RoomKind, PlayerMeta},
    utils::{jwt::{validate_token}, schemas::RoomManagerCommand},
};


pub async fn ws_handler(
    app_ctx: Extension<Arc<AppContext>>,
    ws: WebSocketUpgrade,
    headers: HeaderMap
) -> impl IntoResponse {
    let protocols = match headers.get("sec-websocket-protocol") {
        Some(v) => v.to_str().ok(),
        None => None,
    };

    let token = match protocols
        .and_then(|p| p.split(',').map(|s| s.trim()).nth(1))
    {
        Some(t) => t,
        None => return StatusCode::UNAUTHORIZED.into_response(),
    };

    let player_id = match validate_token(token){
        Ok(claims) => {
            claims.sub
        }
        Err(_) => {
            return StatusCode::UNAUTHORIZED.into_response()
        }
    };

    ws.protocols(["jwt"])
        .on_upgrade(move |socket| handle_socket(socket, app_ctx.0.clone(), player_id))

}

async fn handle_incoming(
    incoming: WSIncomingMessage,
    app_ctx: &Arc<AppContext>,
    connection_pool: &ConnectionPool,
    player_id: i64,
) {
    match incoming {

        WSIncomingMessage::FindGame { stake, currency, league } => {
            let _ = app_ctx.queue_manager.send(
                QueueCommand::Enqueue {
                    player: player_id,
                    key: QueueKey {
                        stake,
                        currency,
                        league,
                    },
                },
            );

            if let Some(session) = connection_pool.get(&player_id) {
                session.mark_as_in_queue().await;
            }
        }

        WSIncomingMessage::CancelSearch { stake, currency, league } => {
            let _ = app_ctx.queue_manager.send(
                QueueCommand::Dequeue {
                    player: player_id,
                    key: QueueKey {
                        stake,
                        currency,
                        league,
                    },
                },
            );

            if let Some(session) = connection_pool.get(&player_id) {
                session.mark_back_to_connected().await;
            }
        }

        WSIncomingMessage::CreateRoom {
            stake,
            currency,
            league,
            password_hash,
        } => {
            let _ = app_ctx.room_manager.send(
                RoomManagerCommand::CreateRoom {
                    key: QueueKey {
                        stake,
                        currency,
                        league,
                    },
                    players: vec![player_id],
                    password_hash: password_hash.clone(),
                    kind: if password_hash.is_some() {
                        RoomKind::Private
                    } else {
                        RoomKind::Open
                    },
                },
            );
        }

        WSIncomingMessage::JoinRoom { room_id } => {
            let _ = app_ctx.room_manager.send(
                RoomManagerCommand::JoinRoom {
                    player: player_id,
                    room_id,
                },
            );
        }

        WSIncomingMessage::LeaveRoom { room_id } => {
            let _ = app_ctx.room_manager.send(
                RoomManagerCommand::LeaveRoom {
                    player: player_id,
                    room_id,
                },
            );
        }

        WSIncomingMessage::SubscribeRooms => {
            let _ = app_ctx.room_manager.send(
                RoomManagerCommand::SubscribeRooms {
                    player: player_id,
                },
            );
        }

        WSIncomingMessage::UnsubscribeRooms => {
            let _ = app_ctx.room_manager.send(
                RoomManagerCommand::UnsubscribeRooms {
                    player: player_id,
                },
            );
        }

        WSIncomingMessage::PlayCard { room_id, rank, suit } => {
            match Card::build_from(rank, suit) {
                Ok(card) => {
                    let _ = app_ctx.room_manager.send(
                        RoomManagerCommand::PlayCard {
                            player: player_id,
                            room_id,
                            card,
                        },
                    );
                }
                Err(err_msg) => {
                    if let Some(player) = connection_pool.get(&player_id) {
                        let _ = player.send(
                            WSEvent::Error {
                                detail: err_msg.to_string(),
                            },
                        );
                    }
                }
            }
        }
    }
}

async fn handle_socket(
    socket: WebSocket,
    app_ctx: Arc<AppContext>,
    player_id: i64,
) {
    let (mut write, mut read) = socket.split();

    let (tx, mut rx) = mpsc::unbounded_channel::<WSEvent>();
    let connection_pool = app_ctx.connection_pool();

    let profile = match sqlx::query_as!(PlayerMeta,
        r#"
        SELECT telegram_id as id, username, rating, photo_url
        FROM users
        WHERE telegram_id = $1
        "#,
        player_id
    )
    .fetch_optional(&app_ctx.db_pool)
    .await
    {
        Ok(p) => p,
        Err(e) => {
            error!("DB error: {:?}", e);
            return;
        }
    };
    let player_meta = match profile {
        Some(p) => PlayerMeta {
            id: player_id,
            username: p.username,
            photo_url: p.photo_url,
            rating: p.rating,   // если нужно
        },
        None => PlayerMeta {
            id: player_id,
            username: None,
            photo_url: None,
            rating: 0,
        },
    };


    let reconnect_room_id = if let Some(existing_player) = connection_pool.get(&player_id) {
        let status = {
            let guard = existing_player.status.read().await;
            guard.clone()
        };

        match status {
            PlayerStatus::InGame {
                room_id,
                disconnected_at: Some(_),
                ..
            } => Some(room_id),
            _ => None,
        }
    } else {
        None
    };

    connection_pool.pool(player_meta.clone(), tx.clone()).await;

    if let Some(room_id) = reconnect_room_id {
        let _ = app_ctx.room_manager.send(
            RoomManagerCommand::PlayerReconnect {
                player: player_id,
                room_id,
            }
        );
    }
    info!("{} connected to pool", player_id);

    let mut ping_interval = tokio::time::interval(Duration::from_secs(5));

    loop {
        tokio::select! {

            // ===== READ SIDE =====
            msg = read.next() => {
                match msg {
                    Some(Ok(Message::Text(text))) => {
                        if let Ok(incoming) = serde_json::from_str::<WSIncomingMessage>(&text) {
                            handle_incoming(incoming, &app_ctx, &connection_pool, player_id).await;
                        } else {
                            warn!("Invalid WS message");
                        }
                    }

                    Some(Ok(Message::Pong(_))) => {
                        if let Some(player) = connection_pool.get(&player_id) {
                            debug!("Pong from {}", player_id);
                            player.update_last_ping().await;
                        }
                    }

                    Some(Ok(Message::Close(_))) => {
                        info!("{} sent Close", player_id);
                        break;
                    }

                    Some(Err(e)) => {
                        warn!("WS read error: {:?}", e);
                        break;
                    }

                    None => {
                        info!("{} socket closed", player_id);
                        break;
                    }

                    _ => {}
                }
            }

            // ===== WRITE SIDE =====
            Some(event) = rx.recv() => {
                match serde_json::to_string(&event) {
                    Ok(json) => {
                        if write.send(Message::Text(json)).await.is_err() {
                            warn!("WS write failed for {}", player_id);
                            break;
                        }
                    }
                    Err(_) => warn!("Failed to serialize WSEvent"),
                }
            }

            // ===== PING =====
            _ = ping_interval.tick() => {
                if let Some(player) = connection_pool.get(&player_id) {
                    let last = *player.last_ping.lock().await;
                    if last.elapsed() > Duration::from_secs(200) {
                        warn!("Ping timeout for {}", player_id);
                        break;
                    }
                } else {
                    break;
                }

                if write.send(Message::Ping(vec![])).await.is_err() {
                    warn!("Ping send failed for {}", player_id);
                    break;
                }
            }
        }
    }

    // ===== CLEANUP =====
    if let Some(player) = connection_pool.get(&player_id) {
        let status = {
            let guard = player.status.read().await;
            guard.clone()
        };
        match status {
            PlayerStatus::InGame { room_id, .. } => {
                connection_pool.temp_disconnected(&player_id).await;
                let _ = app_ctx.room_manager.send(
                    RoomManagerCommand::PlayerTemporaryDisconnect { player: player_id, room_id: room_id.to_string() }
                );
            }
            _ => {
                let _ = app_ctx.queue_manager.send(
                    QueueCommand::Disconnect { player: player_id }
                );
                let _ = app_ctx.room_manager.send(
                    RoomManagerCommand::UnsubscribeRooms { player: player_id }
                );
                let _ = app_ctx.room_manager.send(
                    RoomManagerCommand::LeaveAllRoom { player: player_id }
                );
                connection_pool.disconnect(&player_id).await;
                // connection_pool.remove(&player_id);
            }
        }
    }
    info!("{} disconnected", player_id);
}
