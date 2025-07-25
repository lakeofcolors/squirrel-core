// src/handlers/ws.rs — финальный GameManager вариант

use axum::{extract::ws::{Message, WebSocket, WebSocketUpgrade}, response::IntoResponse, extract::Extension};
use futures_util::StreamExt;
use futures_util::SinkExt;
use uuid::Bytes;
use std::{sync::{Arc, atomic::AtomicBool}};
use tokio::sync::{Mutex, mpsc};
use tracing::{error, info, warn};

use crate::{
    core::context::AppContext,
    core::manager::{PlayerSession},
    utils::schemas::{Card, Rank, Suit, PlayerPosition, WSIncomingMessage, SubOrUnsub, WSEvent, WSCardPlayed, WSGameOver, WSTrickWon, WSYourHand, WSYourTurn},
    utils::jwt::handle_auth,
};


pub async fn ws_handler(
    app_ctx: Extension<Arc<AppContext>>,
    ws: WebSocketUpgrade,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, app_ctx.0.clone()))
}

async fn handle_socket(socket: WebSocket, app_ctx: Arc<AppContext>) {
    let (mut write, mut read) = socket.split();
    let write_arc = Arc::new(Mutex::new(write));
    let mut client_uid: Option<String> = None;
    let (tx, mut rx) = mpsc::unbounded_channel();
    let gm = app_ctx.game_manager();

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
                    WSIncomingMessage::Auth(auth_msg) => {
                        if let Some(uid) = handle_auth(auth_msg, &write_arc).await {
                            client_uid = Some(uid.clone());
                            info!("User {uid} authenticated");

                            if let Some(existing_player) = gm.find_player_by_uid(&uid).await {
                                let mut player_guard = existing_player.lock().await;
                                player_guard.sender = tx.clone();
                                player_guard.mark_as_connected();
                            }
                        } else {
                            let _ = write_arc.lock().await.send(Message::Text("AuthFailed".into())).await;
                            break;
                        }
                    }

                    WSIncomingMessage::Manage(SubOrUnsub::FindGame(_)) => {
                        if let Some(uid) = &client_uid {
                            let player = PlayerSession::new(uid.clone(), tx.clone());
                            gm.join(player.clone()).await;

                            let rooms = gm.active_rooms.lock().await;
                            for room in rooms.values() {
                                let state = room.state.lock().await;
                                for (pos, session) in &room.players {
                                    let session = session.lock().await;
                                    if let Some(hand) = state.hands.get(pos) {
                                        let _ = session.sender.send(WSEvent::YourHand(WSYourHand {
                                            cards: hand.clone(),
                                        }));
                                        if state.current_turn == *pos {
                                            let _ = session.sender.send(WSEvent::YourTurn(WSYourTurn));
                                        }
                                    }
                                }
                            }
                        }
                    }

                    WSIncomingMessage::Manage(SubOrUnsub::PlayCard(card)) => {
                        if let Some(uid) = &client_uid {
                            let card = Card {
                                rank: match card.rank.unwrap().to_lowercase().as_str() {
                                    "7" => Rank::Seven,
                                    "8" => Rank::Eight,
                                    "9" => Rank::Nine,
                                    "10" => Rank::Ten,
                                    "j" => Rank::Jack,
                                    "q" => Rank::Queen,
                                    "k" => Rank::King,
                                    "a" => Rank::Ace,
                                    _ => { let _ = tx.send(WSEvent::Error { detail: "Invalid rank".to_string() }); continue; }
                                },
                                suit: match card.suit.unwrap().to_lowercase().as_str() {
                                    "c" => Suit::Clubs,
                                    "d" => Suit::Diamonds,
                                    "h" => Suit::Hearts,
                                    "s" => Suit::Spades,
                                    _ => { let _ = tx.send(WSEvent::Error { detail: "Invalid suit".to_string() }); continue; }
                                },
                            };

                            let rooms = gm.active_rooms.lock().await;
                            for room in rooms.values() {
                                let mut position: Option<PlayerPosition> = None;
                                for (p, player) in &room.players {
                                    if player.lock().await.id == *uid {
                                        position = Some(*p);
                                        break;
                                    }
                                }

                                if let Some(pos) = position {
                                    let mut state = room.state.lock().await;
                                    match state.play_card(pos, card) {
                                        Ok(_) => {
                                            for (_, s) in &room.players {
                                                let session = s.lock().await;
                                                let _ = session.sender.send(WSEvent::CardPlayed(WSCardPlayed { position: pos, card }));
                                            }

                                            if let Some(winner) = state.resolve_trick() {
                                                for (_, s) in &room.players {
                                                    let session = s.lock().await;
                                                    let _ = session.sender.send(WSEvent::TrickWon(WSTrickWon { position: winner }));
                                                }

                                                if state.hands.values().all(|h| h.is_empty()) {
                                                    let _ = state.update_eye_after_round();
                                                    let eye = state.team_eye.clone();
                                                    state.trump = Suit::random_suit(); // TODO dont know!!!
                                                    let _ = state.update_hands(); //

                                                    for (pos, s) in &room.players {
                                                        let session = s.lock().await;

                                                        let _ = session.sender.send(WSEvent::EyeUpdated {
                                                            team_a: eye.get(&1).copied().unwrap_or(0),
                                                            team_b: eye.get(&2).copied().unwrap_or(0),
                                                        });
                                                        let _ = session.sender.send(WSEvent::TrumpUpdated { trump: state.trump.clone() });

                                                        if let Some(hand) = state.hands.get(pos) {
                                                            let _ = session.sender.send(WSEvent::YourHand(WSYourHand {
                                                                cards: hand.clone(),
                                                            }));
                                                            if state.current_turn == *pos {
                                                                let _ = session.sender.send(WSEvent::YourTurn(WSYourTurn));
                                                            }
                                                        }
                                                    }

                                                    if eye.get(&1).copied().unwrap_or(0) >= 12 || eye.get(&2).copied().unwrap_or(0) >= 12 {
                                                        for (_, s) in &room.players {
                                                            let session = s.lock().await;
                                                            let _ = session.sender.send(WSEvent::GameOver(WSGameOver {
                                                                scores: state.team_scores.clone(),
                                                            }));
                                                        }
                                                    }
                                                } else {
                                                    let session = room.players.get(&winner).unwrap().lock().await;
                                                    let _ = session.sender.send(WSEvent::YourTurn(WSYourTurn));
                                                }
                                            } else {
                                                if let Some(s) = room.players.get(&state.current_turn) {
                                                    let session = s.lock().await;
                                                    let _ = session.sender.send(WSEvent::YourTurn(WSYourTurn));
                                                }
                                            }
                                        }
                                        Err(e) => {
                                            let _ = tx.send(WSEvent::Error { detail: e.to_string() });
                                        }
                                    }
                                }
                            }
                        }
                    }
                    _ => {break}
                }
            }

            Message::Binary(data) => {
                if data.as_ref() == vec![9] {
                    if let Some(uid) = &client_uid {
                        if let Some(player) = gm.find_player_by_uid(uid).await {
                            let player_guard = player.lock().await;
                            let mut ping_guard = player_guard.last_ping.lock().await;
                            *ping_guard = std::time::Instant::now();
                        }
                    }
                }
            }

            Message::Ping(payload) => {
                // Обновляем last_ping и отвечаем Pong
                if let Some(uid) = &client_uid {
                    if let Some(player) = gm.find_player_by_uid(uid).await {
                        let player_guard = player.lock().await;
                        let mut ping_guard = player_guard.last_ping.lock().await;
                        *ping_guard = std::time::Instant::now();
                        info!("{:?}:  ping after{:?}", client_uid.clone(), *ping_guard);
                    }
                }
                let _ = write_arc.lock().await.send(Message::Pong(payload)).await;
            }

            Message::Close(_) => break,

            _ => {}
        }
    }
}
