use std::collections::{VecDeque, HashMap};
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio::time::{sleep, Duration};
use crate::utils::schemas::{Player, Room, Suit, Card, GameEvent, EventType};
use crate::core::pool::ConnectionPool;
use tracing::{info, debug};
use futures_util::SinkExt;
use axum::extract::ws::Message;
use async_trait::async_trait;
use rand::seq::SliceRandom;
use rand::thread_rng;

#[derive(Debug)]
pub struct SearchEngine{
    player_queue: Arc<Mutex<VecDeque<Player>>>,
    rooms: Arc<Mutex<Vec<Arc<Mutex<Room>>>>>
}

#[async_trait]
pub trait GameEngine: EventSubscriber + std::fmt::Debug + Send + Sync {
    async fn start_game(&self, room: Arc<Mutex<Room>>);
    async fn create_deck(&self) -> Arc<Mutex<Vec<Card>>>;
}

#[async_trait]
pub trait EventSubscriber: Send + Sync {
    async fn on_update(&self, event: GameEvent) -> anyhow::Result<()>;
}

#[derive(Debug)]
pub struct SquirrelEngine{
}

impl SquirrelEngine {
    fn new() -> Self{
        Self{}
    }
}


#[async_trait]
impl EventSubscriber for SquirrelEngine {
    async fn on_update(&self, event: GameEvent)  -> anyhow::Result<()>{
        match event.event_type {
            EventType::BeginGame=> {
                Ok(())
            }
            EventType::Hand => {
                Ok(())
            }
            _ => {
                Ok(())
            }
        }


    }
}


#[async_trait]
impl GameEngine for SquirrelEngine {
    async fn start_game(&self, room: Arc<Mutex<Room>>) {
        let room_lock = room.lock().await;
        // let mut scores: HashMap<Player, > = HashMap::new();
        info!("🎮 Game begin for {:?}", room_lock.players);
        self.on_update(GameEvent{event_type: EventType::BeginGame, room: room.clone()}).await;
        let mut deck = room_lock.deck.lock().await;
        let mut players_lock = room_lock.players.lock().await;

        for player in players_lock.iter_mut(){
            for _ in 0..6{
                if let Some(card) = deck.pop(){
                    player.hand.push(card);
                }

            }
            info!("Player {} hand: {:?}", player.username, player.hand)
        }

        for _ in 0..(deck.len() / 4){

        }



        sleep(Duration::from_secs(10)).await; // Имитируем игру
        info!("🏆 Game is ended!");
    }


    async fn create_deck(&self) -> Arc<Mutex<Vec<Card>>>{
        let suits = vec![Suit::Spades, Suit::Hearts, Suit::Diamonds, Suit::Clubs];
        let mut deck = Vec::new();
        for &suit in &suits {
            for value in 6..=14 {
                deck.push(Card::new(value, suit));
            }
        }
        deck.shuffle(&mut thread_rng());
        Arc::new(Mutex::new(deck))
    }

}


impl SearchEngine {

    pub fn new() -> Self{
        Self{
            player_queue: Arc::new(Mutex::new(VecDeque::new())),
            rooms: Arc::new(Mutex::new(Vec::new())),
        }
    }

    pub async fn add_player(&self, player: Player){
        let mut queue_lock = self.player_queue.lock().await;

        if queue_lock.iter().any(|p| p.username == player.username){
            info!("Player {} already in queue!", player.username);
            return;
        }
        queue_lock.push_back(player);
    }

    pub async fn process_queue(&self, connection_pool: Arc<ConnectionPool>){
        loop {
            let mut queue_lock = self.player_queue.lock().await;
            let mut rooms = self.rooms.lock().await;
            let engine = Arc::new(SquirrelEngine::new());
            debug!("Queue players len: {:?}", queue_lock.len());
            if queue_lock.len() > 4 {
                //TODO check healty players before create room
                let room_players: Vec<Player> = queue_lock.drain(..4).collect();
                let new_room = Arc::new(Mutex::new(Room{
                    players: Arc::new(Mutex::new(room_players)),
                    deck: engine.create_deck().await,
                    trump_suit: Some(Suit::Clubs),
                    engine: engine.clone()
                }));
                rooms.push(new_room.clone());
                tokio::spawn(async move {
                    engine.start_game(new_room.clone()).await
                });

            }

            drop(queue_lock);
            sleep(Duration::from_secs(1)).await;
        }
    }
}
