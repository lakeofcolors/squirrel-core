use axum::{
    http::{StatusCode, HeaderMap},
    response::IntoResponse,
};
use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::Extension;
use futures_util::StreamExt;
use futures_util::SinkExt;
use std::sync::Arc;
use tokio::sync::{Mutex, mpsc::{self, UnboundedReceiver, UnboundedSender}};
use tracing::{info, warn};

use crate::{
    core::context::AppContext,
    core::pool::{PlayerSession},
    utils::schemas::{QueueCommand, QueueKey, Card, Rank, Suit, PlayerPosition, WSIncomingMessage, WSEvent, WSCardPlayed, WSTrickWon, WSYourHand, WSYourTurn, RoomKind},
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

async fn handle_socket(socket: WebSocket, app_ctx: Arc<AppContext>, username: String) {
    let (write, mut read) = socket.split();
    let write_arc = Arc::new(Mutex::new(write));

    // NOTE mb mpsc::channel?
    let (tx, mut rx): (UnboundedSender<WSEvent>, UnboundedReceiver<WSEvent>) = mpsc::unbounded_channel();
    let connection_pool = app_ctx.connection_pool();
    connection_pool.pool(&username.clone(), tx);
    let session = connection_pool.get(&username).unwrap();

    info!("{} connected to pool", &username.clone());

    // Спавним отправку сообщений
    let write_loop = write_arc.clone();
    tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if let Ok(json) = serde_json::to_string(&msg) {
                if write_loop.lock().await.send(Message::Text(json)).await.is_err() {
                    warn!("Ошибка отправки JSON в WebSocket");
                    break;
                }
            } else {
                warn!("Не удалось сериализовать WSEvent");
            }
        }
    });

    while let Some(result) = read.next().await {
        let msg = match result {
            Ok(msg) => msg,
            Err(_) => break,
        };

        match msg {
            Message::Text(text) => {
                let parsed: Result<WSIncomingMessage, _> = serde_json::from_str(&text);
                let incoming = match parsed {
                    Ok(val) => val,
                    Err(e) => {
                        warn!("Invalid message: {e:?}");
                        continue;
                    }
                };

                match incoming {
                    WSIncomingMessage::FindGame{stake, currency, league} => {
                        let _ = app_ctx.queue_manager.send(
                            QueueCommand::Enqueue{
                                player: username.clone(),
                                key: QueueKey{
                                    stake,
                                    currency,
                                    league
                                }
                            }
                        );
                        session.mark_as_in_queue();
                    }

                    WSIncomingMessage::CancelSearch{stake, currency, league} => {
                         let _ = app_ctx.queue_manager.send(
                            QueueCommand::Dequeue{
                                player: username.clone(),
                                key: QueueKey{
                                    stake,
                                    currency,
                                    league
                                }
                            }
                        );
                        session.mark_as_connected();
                    }

                    WSIncomingMessage::CreateRoom { stake, currency, league, password_hash} => {
                        let _ = app_ctx.room_manager.send(
                            RoomManagerCommand::Create {
                                key: QueueKey { stake, currency, league },
                                players: Vec::from([username.clone()]),
                                password_hash: password_hash.clone(),
                                kind: match password_hash{
                                    Some(_) => RoomKind::Private,
                                    None => RoomKind::Open
                                }
                            }
                        );
                    }
                    WSIncomingMessage::RoomsList => {

                    }
                }

                //     WSIncomingMessage::Manage(SubOrUnsub::PlayCard(card)) => {
                //         if let Some(uid) = &client_uid {
                //             let card = Card {
                //                 rank: match card.rank.unwrap().to_lowercase().as_str() {
                //                     "7" => Rank::Seven,
                //                     "8" => Rank::Eight,
                //                     "9" => Rank::Nine,
                //                     "10" => Rank::Ten,
                //                     "j" => Rank::Jack,
                //                     "q" => Rank::Queen,
                //                     "k" => Rank::King,
                //                     "a" => Rank::Ace,
                //                     _ => { let _ = tx.send(WSEvent::Error { detail: "Invalid rank".to_string() }); continue; }
                //                 },
                //                 suit: match card.suit.unwrap().to_lowercase().as_str() {
                //                     "c" => Suit::Clubs,
                //                     "d" => Suit::Diamonds,
                //                     "h" => Suit::Hearts,
                //                     "s" => Suit::Spades,
                //                     _ => { let _ = tx.send(WSEvent::Error { detail: "Invalid suit".to_string() }); continue; }
                //                 },
                //             };

                //             let rooms = gm.active_rooms.lock().await;
                //             for room in rooms.values() {
                //                 let mut position: Option<PlayerPosition> = None;
                //                 for (p, player) in &room.players {
                //                     if player.lock().await.id == *uid {
                //                         position = Some(*p);
                //                         break;
                //                     }
                //                 }

                //                 if let Some(pos) = position {
                //                     let mut state = room.state.lock().await;
                //                     match state.play_card(pos, card) {
                //                         Ok(_) => {
                //                             for (_, s) in &room.players {
                //                                 let session = s.lock().await;
                //                                 let _ = session.sender.send(WSEvent::CardPlayed(WSCardPlayed { position: pos, card }));
                //                             }

                //                             if let Some(winner) = state.resolve_trick() {
                //                                 for (_, s) in &room.players {
                //                                     let session = s.lock().await;
                //                                     let _ = session.sender.send(WSEvent::TrickWon(WSTrickWon { position: winner }));
                //                                 }

                //                                 if state.hands.values().all(|h| h.is_empty()) {
                //                                     let _ = state.update_eye_after_round();
                //                                     let eye = state.team_eye.clone();
                //                                     state.trump = Suit::random_suit(); // TODO dont know!!!
                //                                     let _ = state.update_hands(); //

                //                                     for (pos, s) in &room.players {
                //                                         let session = s.lock().await;

                //                                         let _ = session.sender.send(WSEvent::EyeUpdated {
                //                                             team_a: eye.get(&1).copied().unwrap_or(0),
                //                                             team_b: eye.get(&2).copied().unwrap_or(0),
                //                                         });
                //                                         let _ = session.sender.send(WSEvent::TrumpUpdated { trump: state.trump.clone() });

                //                                         if let Some(hand) = state.hands.get(pos) {
                //                                             let _ = session.sender.send(WSEvent::YourHand(WSYourHand {
                //                                                 cards: hand.clone(),
                //                                             }));
                //                                             if state.current_turn == *pos {
                //                                                 let _ = session.sender.send(WSEvent::YourTurn(WSYourTurn));
                //                                             }
                //                                         }
                //                                     }

                //                                     if eye.get(&1).copied().unwrap_or(0) >= 12 || eye.get(&2).copied().unwrap_or(0) >= 12 {
                //                                         for (_, s) in &room.players {
                //                                             let session = s.lock().await;
                //                                             let _ = session.sender.send(WSEvent::GameOver(WSGameOver {
                //                                                 scores: state.team_scores.clone(),
                //                                             }));
                //                                         }
                //                                     }
                //                                 } else {
                //                                     let session = room.players.get(&winner).unwrap().lock().await;
                //                                     let _ = session.sender.send(WSEvent::YourTurn(WSYourTurn));
                //                                 }
                //                             } else {
                //                                 if let Some(s) = room.players.get(&state.current_turn) {
                //                                     let session = s.lock().await;
                //                                     let _ = session.sender.send(WSEvent::YourTurn(WSYourTurn));
                //                                 }
                //                             }
                //                         }
                //                         Err(e) => {
                //                             let _ = tx.send(WSEvent::Error { detail: e.to_string() });
                //                         }
                //                     }
                //                 }
                //             }
                //         }
                //     }
                //     _ => {break}
                // }
            }

            Message::Binary(data) => {
                if data.as_ref() == vec![9] {
                    if let Some(player) = connection_pool.get(&username.clone()) {
                        player.update_last_ping();
                    }
                }
            }

            Message::Ping(payload) => {
                // Обновляем last_ping и отвечаем Pong
                if let Some(player) = connection_pool.get(&username.clone()) {
                    player.update_last_ping();
                }
                let _ = write_arc.lock().await.send(Message::Pong(payload)).await;
            }

            Message::Close(_) => break,

            _ => {}
        }
    }
}
