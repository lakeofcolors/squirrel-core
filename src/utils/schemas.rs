use serde::{Deserialize, Serialize};
use tokio::sync::{RwLock, Mutex};
use std::{sync::Arc, collections::HashMap};
use futures_util::stream::SplitSink;
use axum::extract::ws::WebSocket;
use std::fmt;
use rand::seq::SliceRandom;
use rand::thread_rng;

// use crate::core::engine::GameEngine;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum Suit {
    Clubs,
    Diamonds,
    Hearts,
    Spades,
}

impl Suit{
    pub fn random_suit() -> Suit {
        let suits = vec![Suit::Clubs, Suit::Diamonds, Suit::Hearts, Suit::Spades];
        let mut rng = thread_rng();
        *suits.choose(&mut rng).expect("suits list is not empty")
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub enum Rank {
    Seven,
    Eight,
    Nine,
    Ten,
    Jack,
    Queen,
    King,
    Ace,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct Card {
    pub suit: Suit,
    pub rank: Rank,
}

impl Card {
    pub fn points(&self, trump: Suit) -> u8 {
        match (self.rank, self.suit == trump) {
            (Rank::Ace, _) => 11,
            (Rank::Ten, _) => 10,
            (Rank::King, _) => 4,
            (Rank::Queen, _) => 3,
            (Rank::Jack, true) => 20,
            (Rank::Nine, true) => 14,
            (Rank::Jack, false) => 2,
            _ => 0,
        }
    }
}

pub fn full_deck() -> Vec<Card> {
    let mut deck = Vec::with_capacity(32);
    let suits = [Suit::Clubs, Suit::Diamonds, Suit::Hearts, Suit::Spades];
    let ranks = [
        Rank::Seven,
        Rank::Eight,
        Rank::Nine,
        Rank::Ten,
        Rank::Jack,
        Rank::Queen,
        Rank::King,
        Rank::Ace,
    ];
    for &suit in &suits {
        for &rank in &ranks {
            deck.push(Card { suit, rank });
        }
    }
    deck
}

pub fn deal_cards() -> Vec<Vec<Card>> {
    let mut deck = full_deck();
    let mut rng = thread_rng();
    deck.shuffle(&mut rng);
    deck.chunks(8).map(|chunk| chunk.to_vec()).collect()
}

pub fn jack_priority(suit: Suit) -> u8 {
    match suit {
        Suit::Clubs => 4,
        Suit::Diamonds => 3,
        Suit::Hearts => 2,
        Suit::Spades => 1,
    }
}


#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum PlayerPosition {
    North,
    East,
    South,
    West,
}

impl PlayerPosition {
    pub fn next(&self) -> PlayerPosition {
        match self {
            PlayerPosition::North => PlayerPosition::East,
            PlayerPosition::East => PlayerPosition::South,
            PlayerPosition::South => PlayerPosition::West,
            PlayerPosition::West => PlayerPosition::North,
        }
    }

    pub fn team(&self) -> u8 {
        match self {
            PlayerPosition::North | PlayerPosition::South => 1,
            PlayerPosition::East | PlayerPosition::West => 2,
        }
    }
}

#[derive(Debug)]
pub struct GameState {
    pub hands: HashMap<PlayerPosition, Vec<Card>>,
    pub trump: Suit,
    pub current_trick: Vec<(PlayerPosition, Card)>,
    pub team_scores: HashMap<u8, u32>,
    pub team_eye: HashMap<u8, u32>,
    pub current_turn: PlayerPosition,
    pub is_first_round: bool,
}

impl GameState {
    pub fn new(trump: Suit) -> Self {
        let hands_vec = deal_cards();
        let mut hands = HashMap::new();
        hands.insert(PlayerPosition::North, hands_vec[0].clone());
        hands.insert(PlayerPosition::East, hands_vec[1].clone());
        hands.insert(PlayerPosition::South, hands_vec[2].clone());
        hands.insert(PlayerPosition::West, hands_vec[3].clone());

        Self {
            hands,
            trump,
            current_trick: vec![],
            team_scores: HashMap::from([(1, 0), (2, 0)]),
            team_eye: HashMap::from([(1, 0), (2, 0)]),
            current_turn: PlayerPosition::North,
            is_first_round: true,
        }
    }

    pub fn update_hands(&mut self){
        let hands_vec = deal_cards();
        let mut new_hands = HashMap::new();
        new_hands.insert(PlayerPosition::North, hands_vec[0].clone());
        new_hands.insert(PlayerPosition::East, hands_vec[1].clone());
        new_hands.insert(PlayerPosition::South, hands_vec[2].clone());
        new_hands.insert(PlayerPosition::West, hands_vec[3].clone());

        self.hands = new_hands;
    }

    pub fn update_eye_after_round(&mut self) -> Option<u8> {
        let a = self.team_scores.get(&1).copied().unwrap_or(0);
        let b = self.team_scores.get(&2).copied().unwrap_or(0);

        if a == 60 && b == 60 {
            return None;
        }

        let (winner_team, loser_score, trump_team) = if a > b {
            (1, b, 1)
        } else {
            (2, a, 1)
        };

        let mut eyes = 1;

        if self.is_first_round {
            eyes = 2;
        } else if winner_team != trump_team {
            eyes = 2;
        }

        if loser_score < 30 {
            eyes += 1;
        }

        *self.team_eye.entry(winner_team).or_insert(0) += eyes;
        self.is_first_round = false;

        Some(winner_team)
    }



    pub fn play_card(&mut self, player: PlayerPosition, card: Card) -> Result<(), &'static str> {
        if player != self.current_turn {
            return Err("Not your turn");
        }
        let hand = self.hands.get_mut(&player).ok_or("Player not found")?;
        if !hand.contains(&card) {
            return Err("Card not in hand");
        }

        if !self.current_trick.is_empty() {
            let lead_suit = self.current_trick[0].1.suit;
            let has_lead_suit = hand.iter().any(|c| c.suit == lead_suit);
            if card.suit != lead_suit && has_lead_suit {
                return Err("Must follow suit");
            }
        }

        hand.retain(|&c| c != card);
        self.current_trick.push((player, card));
        self.current_turn = self.current_turn.next();
        Ok(())
    }


    pub fn resolve_trick(&mut self) -> Option<PlayerPosition> {
        if self.current_trick.len() != 4 {
            return None;
        }

        let lead_suit = self.current_trick[0].1.suit;
        let trump = self.trump;


        let winner = self.current_trick.iter().max_by_key(|(_, card)| {
            if card.rank == Rank::Jack {
                (3, jack_priority(card.suit), card.rank.clone()) // приоритет 3, валетный порядок
            } else if card.suit == self.trump {
                (2, 0, card.rank.clone()) // обычный козырь
            } else if card.suit == lead_suit {
                (1, 0, card.rank.clone()) // масть по взятке
            } else {
                (0, 0, card.rank.clone()) // остальное
            }
        }).map(|(pos, _)| *pos).unwrap();

        let trick_points: u32 = self
            .current_trick
            .iter()
            .map(|(_, c)| c.points(trump) as u32)
            .sum();

        let team = winner.team();
        *self.team_scores.entry(team).or_insert(0) += trick_points;

        self.current_trick.clear();
        self.current_turn = winner;

        Some(winner)
    }
}


#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "event", rename_all = "snake_case")]
pub enum WSEvent {
    PlayerDisconnected{ position: PlayerPosition },
    SuccessLogin{ username: String },
    GameStart { room_id: String, position: PlayerPosition },
    GameClose{reason: String},
    YourHand(WSYourHand),
    EyeUpdated{ team_a: u32, team_b: u32 },
    TrumpUpdated{ trump: Suit },
    YourTurn(WSYourTurn),
    CardPlayed(WSCardPlayed),
    TrickWon(WSTrickWon),
    GameOver(WSGameOver),
    Error{detail: String},
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WSYourHand {
    pub cards: Vec<Card>,
}


#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WSYourTurn;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WSCardPlayed {
    pub position: PlayerPosition,
    pub card: Card,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WSTrickWon {
    pub position: PlayerPosition,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WSGameOver {
    pub scores: HashMap<u8, u32>, // team_id -> score
}

#[derive(Default, Debug, Clone, Serialize, Deserialize, Hash)]
pub struct Auth {
    pub token: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SubManageMsg {
    pub rank: Option<String>,
    pub suit: Option<String>,
    pub room_id: Option<String>, // можно будет использовать для наблюдения
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "op", rename_all = "lowercase")]
pub enum SubOrUnsub {
    FindGame(SubManageMsg),
    PlayCard(SubManageMsg),
    Sub(SubManageMsg),
    UnSub(SubManageMsg),
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(untagged)]
pub enum WSIncomingMessage {
    Manage(SubOrUnsub),
    Auth(Auth),
}
