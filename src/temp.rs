use rand::seq::SliceRandom;
use rand::thread_rng;
use std::collections::HashMap;
use std::io::{self, Write};

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

impl Card {
    fn new(value: u8, suit: Suit) -> Self {
        Card { value, suit }
    }

    fn display(&self) -> String {
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
        format!("{}{}", value, suit)
    }
}

#[derive(Debug)]
struct Player {
    name: String,
    hand: Vec<Card>,
}

impl Player {
    fn new(name: String) -> Self {
        Player {
            name,
            hand: Vec::new(),
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
}

fn main() {
    let suits = vec![Suit::Spades, Suit::Hearts, Suit::Diamonds, Suit::Clubs];
    let mut deck = Vec::new();

    for &suit in &suits {
        for value in 6..=14 {
            deck.push(Card::new(value, suit));
        }
    }

    deck.shuffle(&mut thread_rng());

    let mut players = vec![
        Player::new("Player 1".to_string()),
        Player::new("Player 2".to_string()),
    ];

    // Раздача карт
    for i in 0..deck.len() {
        players[i % 2].add_card(deck[i]);
    }

    let trump_card = deck[0];
    let trump_suit = trump_card.suit;
    println!("Trump suit is {:?}", trump_suit);

    let mut scores: HashMap<String, u8> = HashMap::new();

    // Начинаем игру
    for round in 0..(deck.len() / 2) {
        println!("Round {}", round + 1);

        for player in &mut players {
            print!("{}'s hand: ", player.name);
            player.display_hand();
        }

        let card1 = play_card(&mut players[0]);
        let card2 = play_card(&mut players[1]);

        println!(
            "{} plays {}",
            players[0].name,
            card1.display()
        );
        println!(
            "{} plays {}",
            players[1].name,
            card2.display()
        );

        let round_winner = determine_winner(card1, card2, trump_suit);
        match round_winner {
            Some(winner) => {
                *scores.entry(players[winner].name.clone()).or_insert(0) += 1;
                println!("{} wins the round!", players[winner].name);
            }
            None => println!("This round is a draw!"),
        }

        println!();
    }

    println!("Final scores:");
    for (player, score) in &scores {
        println!("{}: {}", player, score);
    }

    if scores[&players[0].name] > scores[&players[1].name] {
        println!("{} wins the game!", players[0].name);
    } else if scores[&players[1].name] > scores[&players[0].name] {
        println!("{} wins the game!", players[1].name);
    } else {
        println!("The game is a draw!");
    }
}

fn play_card(player: &mut Player) -> Card {
    loop {
        print!("{}: Choose a card to play: ", player.name);
        io::stdout().flush().unwrap();
        let mut choice = String::new();
        io::stdin().read_line(&mut choice).unwrap();
        if let Ok(index) = choice.trim().parse::<usize>() {
            if index > 0 && index <= player.hand.len() {
                return player.remove_card(index - 1);
            }
        }
        println!("Invalid choice, try again.");
    }
}

fn determine_winner(card1: Card, card2: Card, trump_suit: Suit) -> Option<usize> {
    if card1.suit == trump_suit && card2.suit != trump_suit {
        Some(0)
    } else if card2.suit == trump_suit && card1.suit != trump_suit {
        Some(1)
    } else if card1.suit == card2.suit {
        if card1.value > card2.value {
            Some(0)
        } else if card2.value > card1.value {
            Some(1)
        } else {
            None
        }
    } else {
        None
    }
}
