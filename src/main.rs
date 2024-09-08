// use axum::{
//     extract::ws::{Message, WebSocket, WebSocketUpgrade},
//     response::Response,
//     routing::get,
//     Router,
// };

// use std::{net::SocketAddr, path::PathBuf};
// use serde_json::{Result, Value};
// mod deck;
// use deck::{Room, CardDeck};

// #[tokio::main]
// async fn main() {
//     // tracing_subscriber::registry()
//     //     .with(
//     //         tracing_subscriber::EnvFilter::try_from_default_env()
//     //             .unwrap_or_else(|_| "example_websockets=debug,tower_http=debug".into()),
//     //     )
//     //     .with(tracing_subscriber::fmt::layer())
//     //     .init();

//     let assets_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("assets");

//     // build our application with some routes
//     let app = Router::new()
//         .route("/ws", get(ws_handler));

//     let addr: SocketAddr = ([0,0,0,0], 5555).into();
//     // run it with hyper
//     axum::Server::bind(&addr).serve(
//         app.into_make_service_with_connect_info::<SocketAddr>(),
//     )
//     .await
//     .unwrap();
// }

// /// The handler for the HTTP request (this gets called when the HTTP GET lands at the start
// /// of websocket negotiation). After this completes, the actual switching from HTTP to
// /// websocket protocol will occur.
// /// This is the last point where we can extract TCP/IP metadata such as IP address of the client
// /// as well as things from HTTP headers such as user-agent of the browser etc.
// async fn ws_handler(
//     ws: WebSocketUpgrade,
// ) -> Response {
//     ws.on_upgrade(handle_socket)
// }


// async fn process_message(msg: Message) {
//     match msg {
//         Message::Text(t) => {
//             let sub_context: Value = serde_json::from_str(&t).expect("parse error");
//             let op = &sub_context["op"];
//             match op.as_str() {
//                 Some("find_game") => Room::find(sub_context).await,
//                 Some("connect") => println!("else"),
//                 _ => println!("other"),
//             }
//         }
//         Message::Binary(d) => {
//             println!("{:?} {:?}", d.len(), d);
//         }
//         Message::Ping(v) => {
//             println!("ping");
//         }
//         Message::Pong(v) => {
//             println!("ping");
//         }
//         Message::Close(c) => {
//             println!("close");
//         }
//     }
// }


// async fn handle_socket(mut socket: WebSocket) {
//     while let Some(msg) = socket.recv().await {
//         let msg = if let Ok(msg) = msg {
//             process_message(msg).await;
//             // println!("{:?}", msg);
//             "hi".into()
//         } else {
//             // client disconnected
//             return;
//         };

//         if socket.send(msg).await.is_err() {
//             // client disconnected
//             return;
//         }
//     }
// }

// use rand::seq::SliceRandom;
use rand::thread_rng;
use std::collections::HashMap;
use std::io::{self, Write};
use rand::prelude::SliceRandom;

#[derive(Debug, PartialEq, Eq, Hash, Clone, Copy)]
enum Suit {
    Spades,
    Hearts,
    Diamonds,
    Clubs,
}

#[derive(Debug, PartialEq, Eq, Hash, Clone, Copy)]
struct Card {
    value: u8,
    suit: Suit,
}

const JACK: u8 = 11;

impl Card {
    fn new(value: u8, suit: Suit) -> Self {
        Card { value, suit }
    }

    fn jack_suit_value(&self) -> u8 {
        match self.suit {
            Suit::Spades => 1,
            Suit::Hearts => 2,
            Suit::Diamonds => 3,
            Suit::Clubs => 4,
        }
    }

    fn display(&self) -> String {
        let value = match self.value {
            7 => "7",
            8 => "8",
            9 => "9",
            10 => "10",
            JACK => "J",
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
        format!("{}{}", value, suit)
    }
}

#[derive(Debug)]
struct Player {
    name: String,
    tg_id: u64,
    hand: Vec<Card>,
}

impl Player {
    fn new(name: String) -> Self {
        Player {
            name,
            tg_id: 1,
            hand: Vec::new(),
        }
    }

    fn has_round_suit(&self, round_suit: Suit) -> bool {
        for card in &self.hand {
            if card.suit == round_suit {
               return true;
            }
        }
        false
    }

    fn play_card(&mut self, round_suit: Option<Suit>) -> Card{
        loop {
            print!("{}: Choose a card to play: ", self.name);
            io::stdout().flush().unwrap();
            let mut choice = String::new();
            io::stdin().read_line(&mut choice).unwrap();
            if let Ok(index) = choice.trim().parse::<usize>() {
                if round_suit.is_none() {
                    return self.remove_card(index - 1);
                }
                if index > 0 && index <= self.hand.len() {
                    let card = self.hand[index-1];
                    if self.has_round_suit(round_suit.unwrap()) && card.suit != round_suit.unwrap(){
                        self.display_available_hand(round_suit.unwrap());
                    }else{
                        return self.remove_card(index - 1);
                    }
                }
            }
            println!("Invalid choice, try again.");
        }
    }

    fn add_card(&mut self, card: Card) {
        self.hand.push(card);
    }

    fn remove_card(&mut self, index: usize) -> Card {
        self.hand.remove(index)
    }

    fn display_hand(&self) {
        for (i, card) in self.hand.iter().enumerate() {
            print!("{}: {}  ", i + 1, card.display());
        }
        println!();
    }

    fn display_available_hand(&self, round_suit: Suit) {
        print!("Available is: ");
        if(self.has_round_suit(round_suit)){
            let available_choice: Vec<_> = self.hand.iter().filter(|card| card.suit==round_suit).collect();

            for card in available_choice.iter(){
                print!("{}, ", card.display());
            }
        }else{
            for card in self.hand.iter(){
                print!("{}, ", card.display());
            }
        }
        println!();
    }
}

fn main() {
    let suits = vec![Suit::Spades, Suit::Hearts, Suit::Diamonds, Suit::Clubs];
    let mut deck = Vec::new();

    for &suit in &suits {
        for value in 7..=14 {
            deck.push(Card::new(value, suit));
        }
    }

    deck.shuffle(&mut thread_rng());

    let mut players = vec![
        Player::new("Player 1".to_string()),
        Player::new("Player 2".to_string()),
        Player::new("Player 3".to_string()),
        Player::new("Player 4".to_string()),
    ];

    // Раздача карт
    println!("{}", deck.len());
    for i in 0..deck.len() {
        players[i % 4].add_card(deck[i]);
    }

    let trump_card = deck[0];
    let trump_suit = trump_card.suit;
    println!("Trump suit is {:?}", trump_suit);

    let mut scores: HashMap<String, u8> = HashMap::new();

    for round in 0..(deck.len() / 4) {
        for player in &players {
            print!("{}'s hand: ", player.name);
            player.display_hand();
        }

        let mut played_cards: Vec<Card> = vec![];
        let mut round_suit: Option<Suit> = None;
        for i in 0..4{
            let card = players[i].play_card(round_suit);
            if i == 0{
                round_suit=Some(card.suit)
            }
            played_cards.push(card)
        }

        let round_winner = determine_winner(&played_cards, round_suit.unwrap(), trump_suit);
        println!("Winner {:?}", players[round_winner.unwrap()]);
    }
}




fn determine_winner(played_cards: &[Card], round_suit: Suit, trump_suit: Suit) -> Option<usize> {
    let mut highest_card_idx = None;

    for (idx, card) in played_cards.iter().enumerate(){
        if highest_card_idx.is_none(){
            highest_card_idx = Some(idx);
        }else{
            let current_high = played_cards[highest_card_idx.unwrap()];
            if (played_cards[idx].suit == trump_suit && current_high.suit != trump_suit) ||
                (played_cards[idx].suit == current_high.suit && played_cards[idx].value > current_high.value) ||
                (played_cards[idx].value == JACK && current_high.value != JACK) ||
                (played_cards[idx].value == JACK && current_high.value == JACK && played_cards[idx].jack_suit_value() > current_high.jack_suit_value()){
                    highest_card_idx = Some(idx)
                }
        }
    }
    highest_card_idx
}
