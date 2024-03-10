use constants::{cards, DESK_CAPACITY, SUITS};
mod constants;

#[derive(Debug, Clone)]
struct Suit {
    name: String,
}

#[derive(Debug, Clone)]
struct Card {
    name: String,
    suit: String,
    record: u8,
}

#[derive(Debug)]
pub struct CardDeck {
    cards: Vec<Card>,
    capacity: u8,
}

impl CardDeck {
    pub fn build() -> Self {
        let mut desk: Vec<Card> = Vec::new();
        for card in cards {
            for suit in SUITS {
                let new_card = Card {
                    name: card.0.to_string(),
                    suit: suit.to_string(),
                    record: card.1,
                };
                desk.push(new_card);
            }
        }
        Self {
            cards: desk,
            capacity: DESK_CAPACITY,
        }
    }

    fn shuffle(&mut self) {
        //  Faro Shuffle # TODO хуйня какая то а не алгоритм
        return ();
    }
}
