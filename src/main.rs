mod deck;
use tokio::net::{TcpListener, TcpStream};
use axum::{
    routing::{get, post},
    http::StatusCode,
    Json, Router,
};


#[tokio::main]
async fn main() {
    println!("Start squirrel core");
    let app = Router::new()
        .route("/", get(create_room));
    let addr = ([0,0,0,0], 5555).into();
    axum::Server::bind(&addr)
        .serve(app.into_make_service()).await.unwrap();
}


async fn create_room() -> &'static str{
    let deck = deck::CardDeck::build();
    println!("{:?}", deck);
   "Hello world"
}
