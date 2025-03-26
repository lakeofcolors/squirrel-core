use constants::{cards, DESK_CAPACITY, SUITS};
mod constants;
use serde::{Deserialize, Serialize};
use serde_json::{Result, Value};
use squirrel_core::utils::redis::RedisHA;
use bb8_redis::redis::{cmd, AsyncCommands};


#[derive(Debug, Clone)]
struct Suit {
    name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Card {
    name: String,
    suit: String,
    record: u8,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CardDeck {
    cards: Vec<Card>,
    capacity: u8,
}

pub struct User{
    name: String,
    id: String
}

pub struct Room{
    deck: CardDeck,
    user1: Option<User>,
    user2: Option<User>,
    user3: Option<User>,
    user4: Option<User>,
}


impl Room {
    // pub fn connect() {

    // }

    pub async fn find(sub_context: Value){
        // TODO redis connect
        let i = Self{
            deck: CardDeck::build(),
            user1: Some(User{
                id: "1".to_string(),
                name: "Vladimir".to_string()
            }),
            user2: None,
            user3: None,
            user4: None,
        };

        println!("find game");
        let client = RedisHA::new().await;
        let mut conn = client.get_rw().await;
        let reply: String = cmd("SET").arg("foo").arg("bar").query_async(&mut *conn).await.unwrap();
        let result: String = cmd("GET").arg("foo").query_async(&mut *conn).await.unwrap();
        println!("{:?}", reply);
        println!("{:?}", result);
    }

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
        // for &mut i in self.cards
        return ();
    }
}
