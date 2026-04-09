use serde::{Deserialize, Serialize};
use tokio::sync::mpsc;
use std::collections::HashMap;
use std::time::Instant;
use rand::seq::SliceRandom;
use rand::thread_rng;
use rust_decimal::Decimal;
use std::collections::HashSet;

// use crate::core::engine::GameEngine;

pub type Hash = String;
pub type RoomId = String;
pub type RoomName = String;
pub type PlayerId = i64;


#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PlayerMeta{
    pub id: PlayerId,
    pub username: Option<String>,
    pub rating: i32,
    pub photo_url: Option<String>,
    #[sqlx(default)]
    #[serde(default)]
    pub is_bot: bool,
    #[sqlx(default)]
    #[serde(default)]
    pub bot_difficulty: Option<BotDifficulty>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum BotDifficulty {
    Medium,
    Hard,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Currency {
    RealMoney,
    Virtual,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum RoomKind {
    Private,
    Open,
    Queue,
    BotMatch,
}


#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum League {
    Bronze,
    Silver,
    Gold,
    Diamond,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct QueueKey {
    pub stake: Decimal,
    pub currency: Currency,
    pub league: League
}

pub enum QueueCommand {
    Enqueue {
        player: PlayerId,
        key: QueueKey,
    },
    Dequeue {
        player: PlayerId,
        key: QueueKey,
    },
    Disconnect {
        player: PlayerId,
    },
}

#[derive(Debug)]
pub enum RoomManagerCommand {
    CreateRoom {
        key: QueueKey,
        players: Vec<PlayerId>,
        password_hash: Option<Hash>,
        kind: RoomKind
    },
    CreateBotRoom {
        key: QueueKey,
        player: PlayerId,
        difficulty: BotDifficulty,
    },
    JoinRoom { player: PlayerId, room_id: RoomId, password: Option<String> },
    LeaveRoom { player: PlayerId, room_id: RoomId },
    SurrenderRoom { player: PlayerId, room_id: RoomId },
    SpectateRoom { player: PlayerId, room_id: RoomId },
    UnspectateRoom { player: PlayerId, room_id: RoomId },
    LeaveAllRoom { player: PlayerId },
    FinishRoom{
        room_id: RoomId
    },
    SubscribeRooms { player: PlayerId },
    UnsubscribeRooms { player: PlayerId },

    PlayCard{ player: PlayerId, room_id: RoomId, card: Card},
    PlayerTemporaryDisconnect{ player: PlayerId, room_id: RoomId },
    PlayerReconnect{ player: PlayerId, room_id: RoomId },
    PlayerDisconnected { player: PlayerId, room_id: RoomId },
}

#[derive(Debug)]
pub enum RoomActorCommand{
    PlayCard{ player: PlayerId, card: Card},
    PlayerTemporaryDisconnect{ player: PlayerId },
    PlayerReconnect{ player: PlayerId },
    PlayerDisconnected { player: PlayerId },
    PlayerSurrendered { player: PlayerId },
    AddSpectator { player: PlayerId },
    RemoveSpectator { player: PlayerId },
}


#[derive(Debug, Clone)]
pub struct Room {
    pub meta: RoomMeta,
    pub password_hash: Option<Hash>,
    pub created_at: Instant,
    pub actor: Option<mpsc::UnboundedSender<RoomActorCommand>>
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoomMeta{
    pub id: RoomId,
    pub name: RoomName,
    pub key: QueueKey,
    pub kind: RoomKind,
    pub players: Vec<PlayerMeta>,

}


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

impl Rank {
    fn power(&self) -> u8{
        match self{
            Rank::Ace => 7,
            Rank::Ten => 6,
            Rank::King => 5,
            Rank::Queen => 4,
            Rank::Nine => 3,
            Rank::Eight => 2,
            Rank::Seven => 1,
            Rank::Jack => 0,
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct Card {
    pub suit: Suit,
    pub rank: Rank,
}


impl Card {
    pub fn points(&self) -> u8 {
        match self.rank {
            Rank::Ace => 11,
            Rank::Ten => 10,
            Rank::King => 4,
            Rank::Queen => 3,
            Rank::Jack => 2,
            _ => 0,
        }
    }
    pub fn build_from(rank: String, suit: String) -> Result<Self, &'static str>{
        let card = Self{
            rank: match rank.to_lowercase().as_str() {
                "7" => Rank::Seven,
                "8" => Rank::Eight,
                "9" => Rank::Nine,
                "10" => Rank::Ten,
                "j" => Rank::Jack,
                "q" => Rank::Queen,
                "k" => Rank::King,
                "a" => Rank::Ace,
                _ => return Err("Invalid rank")
            },
            suit: match suit.to_lowercase().as_str() {
                "c" => Suit::Clubs,
                "d" => Suit::Diamonds,
                "h" => Suit::Hearts,
                "s" => Suit::Spades,
                _ => return Err("Invalid suit")
            }
        };
        Ok(card)
    }
    pub fn power(&self, lead: Suit, trump: Suit) -> u16{
        if self.rank == Rank::Jack {
            return 1000 + jack_priority(self.suit) as u16;
        }

        if self.suit == trump {
            return 500 + self.rank.power() as u16;
        }

        if self.suit == lead {
            return 100 + self.rank.power() as u16;
        }
        0
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
        Suit::Spades => 3,
        Suit::Hearts => 2,
        Suit::Diamonds => 1,
    }
}


#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum PlayerPosition {
    North,
    East,
    South,
    West,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum Team {
    Kaskyr,
    Uzi,
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

    pub fn team(&self) -> Team {
        match self {
            PlayerPosition::North | PlayerPosition::South => Team::Kaskyr,
            PlayerPosition::East | PlayerPosition::West => Team::Uzi,
        }
    }
}

#[derive(Debug)]
pub struct GameState {
    pub hands: HashMap<PlayerPosition, Vec<Card>>,
    pub trump: Suit,
    pub current_trick: Vec<(PlayerPosition, Card)>,
    pub last_trick: Vec<(PlayerPosition, Card)>,
    pub team_scores: HashMap<Team, u16>,
    pub team_eye: HashMap<Team, u16>,
    pub current_turn: PlayerPosition,
    pub is_first_round: bool,
    pub attacking_team: Team,
    pub player_trump_map: HashMap<PlayerPosition, Suit>,
    pub club_jack_owner: PlayerPosition,
    pub suits_played: HashSet<Suit>,
    pub paused: bool,
}

impl GameState {
    pub fn new() -> Self {
        let hands_vec = deal_cards();
        let mut hands = HashMap::new();
        hands.insert(PlayerPosition::North, hands_vec[0].clone());
        hands.insert(PlayerPosition::East, hands_vec[1].clone());
        hands.insert(PlayerPosition::South, hands_vec[2].clone());
        hands.insert(PlayerPosition::West, hands_vec[3].clone());

        Self {
            trump: Suit::Clubs,
            club_jack_owner: Self::find_club_jack_owner(hands.clone()).unwrap(),
            player_trump_map: Self::assign_player_trumps(hands.clone()),
            hands,
            current_trick: vec![],
            last_trick: vec![],
            suits_played: HashSet::new(),
            attacking_team: Team::Kaskyr,
            team_scores: HashMap::from([(Team::Kaskyr, 0), (Team::Uzi, 0)]),
            team_eye: HashMap::from([(Team::Kaskyr, 0), (Team::Uzi, 0)]),
            current_turn: PlayerPosition::North,
            is_first_round: true,
            paused: false,
        }
    }

    pub fn find_club_jack_owner(hands: HashMap<PlayerPosition, Vec<Card>>) -> Option<PlayerPosition> {
        for (pos, hand) in hands {
            if hand.contains(&Card { suit: Suit::Clubs, rank: Rank::Jack }) {
                return Some(pos);
            }
        }
        None
    }

    pub fn update_round_trump(&mut self) {
        let owner = Self::find_club_jack_owner(self.hands.clone()).unwrap();
        self.trump = *self.player_trump_map.get(&owner).unwrap();
    }

    pub fn update_round_attacking_team(&mut self){
        if let Some(owner) = Self::find_club_jack_owner(self.hands.clone()) {
            self.attacking_team = owner.team();
        }
    }
    fn assign_player_trumps(hands: HashMap<PlayerPosition, Vec<Card>>) ->  HashMap<PlayerPosition, Suit> {
        let owner = Self::find_club_jack_owner(hands).unwrap();
        let mut player_trump_map = HashMap::new();
        let order = [
            owner,
            owner.next(),
            owner.next().next(),
            owner.next().next().next(),
        ];

        let suits = [
            Suit::Clubs,
            Suit::Hearts,
            Suit::Spades,
            Suit::Diamonds,
        ];

        for (pos, suit) in order.iter().zip(suits.iter()) {
            player_trump_map.insert(*pos, *suit);
        }
        player_trump_map
    }

    pub fn update_hands(&mut self){
        let hands_vec = deal_cards();
        let mut new_hands = HashMap::new();
        new_hands.insert(PlayerPosition::North, hands_vec[0].clone());
        new_hands.insert(PlayerPosition::East, hands_vec[1].clone());
        new_hands.insert(PlayerPosition::South, hands_vec[2].clone());
        new_hands.insert(PlayerPosition::West, hands_vec[3].clone());

        self.club_jack_owner = Self::find_club_jack_owner(new_hands.clone()).unwrap();
        self.hands = new_hands;
    }

    pub fn update_team_score_afrer_round(&mut self){
        *self.team_scores.get_mut(&Team::Kaskyr).unwrap() = 0;
        *self.team_scores.get_mut(&Team::Uzi).unwrap() = 0;
    }

    pub fn update_eye_after_round(&mut self) -> Option<Team> {
        let a = self.team_scores.get(&Team::Kaskyr).copied().unwrap_or(0);
        let b = self.team_scores.get(&Team::Uzi).copied().unwrap_or(0);

        if a == 60 && b == 60 {
            self.attacking_team = if self.attacking_team == Team::Kaskyr { Team::Uzi } else { Team::Kaskyr };
            return None;
        }

        if a == 120 {
            *self.team_eye.entry(Team::Kaskyr).or_insert(0) += 12;
            return Some(Team::Kaskyr);
        }

        if b == 120 {
            *self.team_eye.entry(Team::Uzi).or_insert(0) += 12;
            return Some(Team::Uzi);
        }

        let (winner, loser_score) = if a > b {
            (Team::Kaskyr, b)
        } else {
            (Team::Uzi, a)
        };

        let mut eyes = 1;

        if self.is_first_round{
            eyes = 2
        }else{
            if loser_score < 30 {
                eyes = 2;
            }

            if winner != self.attacking_team {
                eyes = 2;
            }
        }

        *self.team_eye.entry(winner).or_insert(0) += eyes;
        self.is_first_round = false;

        Some(winner)
    }


    pub fn play_card(&mut self, player: PlayerPosition, card: Card) -> Result<(), &'static str> {
        if self.paused {
            return Err("Игра остановленна");
        }
        if player != self.current_turn {
            return Err("Не твой ход");
        }
        let hand = self.hands.get_mut(&player).ok_or("Player not found")?;
        if !hand.contains(&card) {
            return Err("Карты нет в руке");
        }
        if !self.current_trick.is_empty() {
            let lead_card = self.current_trick[0].1;

            let effective_lead_suit = if lead_card.rank == Rank::Jack {
                self.trump
            } else {
                lead_card.suit
            };

            let has_effective_lead_suit = hand.iter().any(|c| {
                if effective_lead_suit == self.trump {
                    c.suit == self.trump || c.rank == Rank::Jack
                } else {
                    c.rank != Rank::Jack && c.suit == effective_lead_suit
                }
            });

            let played_matches_effective_lead = if effective_lead_suit == self.trump {
                card.suit == self.trump || card.rank == Rank::Jack
            } else {
                card.rank != Rank::Jack && card.suit == effective_lead_suit
            };

            if has_effective_lead_suit && !played_matches_effective_lead {
                return Err("Нужно ходить в масть");
            }
            if card.rank == Rank::Ace && !self.suits_played.contains(&card.suit) {
                if hand.len() > 1 {
                    let has_alternative = hand.iter().any(|c| {
                        if *c == card {
                            return false;
                        }

                        let matches_effective = if effective_lead_suit == self.trump {
                            c.suit == self.trump || c.rank == Rank::Jack
                        } else {
                            c.rank != Rank::Jack && c.suit == effective_lead_suit
                        };

                        if has_effective_lead_suit && !matches_effective {
                            return false;
                        }

                        !(c.rank == Rank::Ace && !self.suits_played.contains(&c.suit))
                    });

                    if has_alternative {
                        return Err("Нельзя играть туза пока его масть не сыграла");
                    }
                }
            }
        }


        hand.retain(|&c| c != card);
        self.current_trick.push((player, card));
        if self.current_trick.len() < 4 {
            self.current_turn = self.current_turn.next();
        }
        Ok(())
    }


    pub fn resolve_trick(&mut self) -> Option<PlayerPosition> {
        if self.current_trick.len() > 0 {
            let lead_card = self.current_trick[0].1;
            if lead_card.rank != Rank::Jack {
                self.suits_played.insert(lead_card.suit);
            }
        }
        if self.current_trick.len() != 4 {
            return None;
        }

        let lead_card = self.current_trick[0].1;
        let trump = self.trump;


        let winner = self.current_trick
            .iter()
            .max_by_key(|(_, card)| card.power(lead_card.suit, trump))
            .map(|(pos, _)| *pos)
            .unwrap();

        let trick_points: u16 = self
            .current_trick
            .iter()
            .map(|(_, c)| c.points() as u16)
            .sum();

        let team = winner.team();
        *self.team_scores.entry(team).or_insert(0) += trick_points;

        self.last_trick = self.current_trick.clone();

        self.current_trick.clear();
        self.current_turn = winner;

        Some(winner)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlayerInfo {
    pub meta: PlayerMeta,
    pub position: PlayerPosition,
    pub team: Team,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameSnapshot {
    pub room_id: RoomId,
    pub players: Vec<PlayerInfo>,
    pub trump: Suit,
    pub player_trump_map: HashMap<PlayerPosition, Suit>,
    pub club_jack_owner: PlayerPosition,
    pub eyes: HashMap<Team, u16>,
    pub scores: HashMap<Team, u16>,
    pub current_turn: PlayerPosition,
    pub current_trick: Vec<(PlayerPosition, Card)>,
    pub last_trick: Vec<(PlayerPosition, Card)>
}


#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "event", rename_all = "snake_case")]
pub enum WSEvent {
    RoomsSnapshot{ items: Vec<RoomMeta> },
    RoomCreated { room: RoomMeta },
    RoomUpdated { room: RoomMeta },
    RoomRemoved { room_id: RoomId },

    PlayerDisconnected { position: PlayerPosition },
    PlayerReconnected { position: PlayerPosition },
    SpectatorCountUpdated { count: usize },
    SuccessLogin{ username: String },
    GameSnapshot (GameSnapshot),
    GameClose{reason: String},
    YourHand{cards: Vec<Card>},
    CardPlayed{position: PlayerPosition, card: Card},
    TrickWon{position: PlayerPosition, team: Team},
    GameOver{scores: HashMap<Team, u16>}, // team_id -> score
    Error{detail: String},
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WSCardPlayed {
    pub position: PlayerPosition,
    pub card: Card,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WSTrickWon {
    pub position: PlayerPosition,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SubManageMsg {
    pub rank: Option<String>,
    pub suit: Option<String>,
}


#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "op", rename_all = "lowercase")]
pub enum WSIncomingMessage {
    FindGame{stake: Decimal, currency: Currency, league: League},
    CancelSearch{stake: Decimal, currency: Currency, league: League},
    PlayWithBots{stake: Decimal, currency: Currency, league: League, difficulty: BotDifficulty},
    CreateRoom{stake: Decimal, currency: Currency, league: League, password_hash: Option<Hash>},
    JoinRoom { room_id: RoomId, password: Option<String> },
    LeaveRoom { room_id: RoomId },
    SurrenderRoom { room_id: RoomId },
    SpectateRoom { room_id: RoomId },
    UnspectateRoom { room_id: RoomId },
    SubscribeRooms,
    UnsubscribeRooms,
    PlayCard{room_id: RoomId, rank: String, suit: String},
    // SubcribeRoom{room_id: RoomId},
    // UnsubscribeRoom{room_id: RoomId},
}
