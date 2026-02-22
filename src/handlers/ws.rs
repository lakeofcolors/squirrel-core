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
    core::pool::{PlayerSession, ConnectionPool},
    utils::schemas::{QueueCommand, QueueKey, Card, Rank, Suit, PlayerPosition, WSIncomingMessage, WSEvent, WSCardPlayed, WSTrickWon, RoomKind},
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

    let username = match validate_token(token){
        Ok(claims) => {
            claims.sub
        }
        Err(_) => {
            return StatusCode::UNAUTHORIZED.into_response()
        }
    };

    ws.protocols(["jwt"])
        .on_upgrade(move |socket| handle_socket(socket, app_ctx.0.clone(), username))

}

fn handle_incoming(
    incoming: WSIncomingMessage,
    app_ctx: &Arc<AppContext>,
    connection_pool: &ConnectionPool,
    username: &str,
) {
    match incoming {

        WSIncomingMessage::FindGame { stake, currency, league } => {
            let _ = app_ctx.queue_manager.send(
                QueueCommand::Enqueue {
                    player: username.to_string(),
                    key: QueueKey {
                        stake,
                        currency,
                        league,
                    },
                },
            );

            if let Some(session) = connection_pool.get(username) {
                session.mark_as_in_queue();
            }
        }

        WSIncomingMessage::CancelSearch { stake, currency, league } => {
            let _ = app_ctx.queue_manager.send(
                QueueCommand::Dequeue {
                    player: username.to_string(),
                    key: QueueKey {
                        stake,
                        currency,
                        league,
                    },
                },
            );

            if let Some(session) = connection_pool.get(username) {
                session.mark_as_connected();
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
                    players: vec![username.to_string()],
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
                    player: username.to_string(),
                    room_id,
                },
            );
        }

        WSIncomingMessage::LeaveRoom { room_id } => {
            let _ = app_ctx.room_manager.send(
                RoomManagerCommand::LeaveRoom {
                    player: username.to_string(),
                    room_id,
                },
            );
        }

        WSIncomingMessage::SubscribeRooms => {
            let _ = app_ctx.room_manager.send(
                RoomManagerCommand::SubscribeRooms {
                    player: username.to_string(),
                },
            );
        }

        WSIncomingMessage::UnsubscribeRooms => {
            let _ = app_ctx.room_manager.send(
                RoomManagerCommand::UnsubscribeRooms {
                    player: username.to_string(),
                },
            );
        }

        WSIncomingMessage::PlayCard { room_id, rank, suit } => {
            match Card::build_from(rank, suit) {
                Ok(card) => {
                    let _ = app_ctx.room_manager.send(
                        RoomManagerCommand::PlayCard {
                            player: username.to_string(),
                            room_id,
                            card,
                        },
                    );
                }
                Err(err_msg) => {
                    if let Some(player) = connection_pool.get(username) {
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
    username: String,
) {
    let (mut write, mut read) = socket.split();

    let (tx, mut rx) = mpsc::unbounded_channel::<WSEvent>();
    let connection_pool = app_ctx.connection_pool();

    connection_pool.pool(&username, tx);
    info!("{} connected to pool", username);

    let mut ping_interval = tokio::time::interval(Duration::from_secs(5));

    loop {
        tokio::select! {

            // ===== READ SIDE =====
            msg = read.next() => {
                match msg {
                    Some(Ok(Message::Text(text))) => {
                        if let Ok(incoming) = serde_json::from_str::<WSIncomingMessage>(&text) {
                            handle_incoming(incoming, &app_ctx, &connection_pool, &username);
                        } else {
                            warn!("Invalid WS message");
                        }
                    }

                    Some(Ok(Message::Pong(_))) => {
                        if let Some(player) = connection_pool.get(&username) {
                            player.update_last_ping();
                        }
                    }

                    Some(Ok(Message::Close(_))) => {
                        info!("{} sent Close", username);
                        break;
                    }

                    Some(Err(e)) => {
                        warn!("WS read error: {:?}", e);
                        break;
                    }

                    None => {
                        info!("{} socket closed", username);
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
                            warn!("WS write failed for {}", username);
                            break;
                        }
                    }
                    Err(_) => warn!("Failed to serialize WSEvent"),
                }
            }

            // ===== PING =====
            _ = ping_interval.tick() => {
                if let Some(player) = connection_pool.get(&username) {
                    let last = *player.last_ping.lock().unwrap();
                    if last.elapsed() > Duration::from_secs(20) {
                        warn!("Ping timeout for {}", username);
                        break;
                    }
                } else {
                    break;
                }

                if write.send(Message::Ping(vec![])).await.is_err() {
                    warn!("Ping send failed for {}", username);
                    break;
                }
            }
        }
    }

    // ===== CLEANUP (единственное место disconnect) =====

    if let Some(room_id) = connection_pool.disconnect(&username) {
        let _ = app_ctx.room_manager.send(
            RoomManagerCommand::PlayerDisconnected {
                player: username.clone(),
                room_id,
            }
        );
    }

    let _ = app_ctx.queue_manager.send(
        QueueCommand::Disconnect { player: username.clone() }
    );

    let _ = app_ctx.room_manager.send(
        RoomManagerCommand::LeaveAllRoom { player: username.clone() }
    );

    let _ = app_ctx.room_manager.send(
        RoomManagerCommand::UnsubscribeRooms { player: username.clone() }
    );

    connection_pool.remove(&username);

    info!("{} fully disconnected", username);
}
