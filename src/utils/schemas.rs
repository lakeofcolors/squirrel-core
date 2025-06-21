use serde::{Deserialize, Serialize};
use tokio::sync::{RwLock, Mutex};
use std::{sync::Arc, collections::HashMap};
use futures_util::stream::SplitSink;
use axum::extract::ws::WebSocket;
use std::fmt;

use crate::core::engine::GameEngine;

#[derive(Debug, PartialEq, Eq, Hash, Clone, Copy, Serialize)]
pub enum Suit {
    Spades,
    Hearts,
    Diamonds,
    Clubs,
}


#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "event", rename_all = "lowercase")]
pub enum EventType {
    BeginGame,
    PlayCard,
    Hand,
    EndGame,
}

pub struct GameEvent{
    pub event_type: EventType,
    pub room: Arc<Mutex<Room>>,

}

#[derive(Debug, PartialEq, Eq, Hash, Clone, Copy, Serialize)]
pub struct Card {
    value: u8,
    suit: Suit,
}

impl fmt::Display for Card {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let value = match self.value {
            6 => "6",
            7 => "7",
            8 => "8",
            9 => "9",
            10 => "10",
            11 => "J",
            12 => "Q",
            13 => "K",
            14 => "A",
            _ => "Unknown",
        };
        let suit = match self.suit {
            Suit::Spades => "♠",
            Suit::Hearts => "♥",
            Suit::Diamonds => "♦",
            Suit::Clubs => "♣",
        };
        write!(f, "{}{}", value, suit)
    }
}

impl Card{
    pub fn new(value: u8, suit: Suit) -> Self {
        Card { value, suit }
    }
}

#[derive(Debug, Serialize)]
    pub struct Player{
    pub username: String,
    pub hand: Vec<Card>,
    // pub rating: u64,

    #[serde(skip)]
    pub client_writer: Arc<Mutex<SplitSink<WebSocket, axum::extract::ws::Message>>>
}

#[derive(Debug)]
pub struct Room{
    pub players: Arc<Mutex<Vec<Player>>>,
    pub deck: Arc<Mutex<Vec<Card>>>,
    pub trump_suit: Option<Suit>,
    pub engine: Arc<dyn GameEngine>,
}

#[derive(Default, Debug, Clone, Serialize, Deserialize, Hash)]
pub struct Auth {
    pub token: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Hash, Eq, PartialEq)]
pub struct SubManageMsg {
    pub context: Option<String>,
    pub game_id: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "op", rename_all = "lowercase")]
pub enum SubOrUnsub {
    FindGame(SubManageMsg),
    Sub(SubManageMsg),
    UnSub(SubManageMsg),
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(untagged)]
pub enum WSIncomingMessage {
    Manage(SubOrUnsub),
    Auth(Auth),
}
