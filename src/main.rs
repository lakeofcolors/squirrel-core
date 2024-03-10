mod deck;
use tokio::net::{TcpListener, TcpStream};



async fn handle(socket: TcpStream){
    println!("Message {:?}", socket);
    let mut connection = Connection

}

#[tokio::main]
async fn main() {
    let deck = deck::CardDeck::build();
    let server = TcpListener::bind("127.0.0.1:5555").await.unwrap();
    loop {
        // The second item contains the IP and port of the new connection.
        let (socket, ip) = server.accept().await.unwrap();
        handle(socket).await;
    }
}
