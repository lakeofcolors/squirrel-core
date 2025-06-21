use tokio::net::TcpListener;
use axum::{
    extract::ws::{WebSocketUpgrade, WebSocket, Message},
    extract::Extension,
    response::IntoResponse,
    routing::{get, post},
    Router,
};
use tracing::{info, warn, error};
use tracing_subscriber;
use crate::{utils::schemas::{WSIncomingMessage, SubOrUnsub}, handlers::auth::me};
use crate::core::context::{AppContext, set_global_context};
use crate::utils::jwt::handle_auth;
use crate::handlers::auth::login;
use crate::utils::db::pg_pool;
pub mod handlers;
pub mod utils;
pub mod core;
use std::sync::Arc;
use tokio::sync::Mutex;
use futures_util::StreamExt;
use futures_util::SinkExt;


#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter("info")
        .init();

    info!("Logical cores: {}", num_cpus::get());
    info!("Physical cores: {}", num_cpus::get_physical());

    let app_ctx = Arc::new(AppContext::new());
    let pg_pool = Arc::new(pg_pool().await.expect(""));
    set_global_context(app_ctx.clone());

    let router = Router::new()
        .route("/api/ws", get(ws_handler))
        .route("/api/login", post(login))
        .with_state(pg_pool)
        .route("/api/me", post(me))
        .layer(Extension(app_ctx));

    info!("Start server!");
    let server = TcpListener::bind("0.0.0.0:9221").await.unwrap();
    axum::serve(server, router.into_make_service()).await.unwrap();
}

async fn ws_handler(
    app_ctx: Extension<Arc<AppContext>>,
    ws: WebSocketUpgrade,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, app_ctx.0.clone()))
}


async fn handle_socket(socket: WebSocket, app_ctx: Arc<AppContext>) {
    let (write, mut read) = socket.split();
    let write = Arc::new(Mutex::new(write));
    let mut client_uid: Option<String> = None;

    let connection_pool = app_ctx.connection_pool();

    while let Some(raw_message) = tokio::select!{
        raw_message = read.next() => {
            if raw_message.is_none() {
                error!("client possibly closed");
            };
        raw_message
        }
    }{
        let mut parsed_msg: Option<WSIncomingMessage> = None;
        let message = match raw_message{
            Ok(raw_message) => raw_message,
            Err(e) => {
                warn!("Msg err: {e:?}");
                break;
            }
        };
        match message {
            Message::Text(text) => {
                match serde_json::from_str::<WSIncomingMessage>(text.as_str()) {
                    Ok(data) => {
                        parsed_msg = Some(data);
                    },
                    Err(err) => {
                        error!("Deserialized error {:?}", err);
                        continue;
                    },
                }
            }
            Message::Close(close) => {
                info!("Connection closed by client: {:?}", close);
                break;
            }
            Message::Ping(ping) => {
                info!("Received ping: {:?}", ping);
            }
            Message::Pong(_) => {
                info!("Received pong");
            }
            _ => {}
        };

        let write_clone = Arc::clone(&write);

        match parsed_msg.unwrap(){
            WSIncomingMessage::Auth(auth_msg) => {
                match handle_auth(auth_msg, &write).await {
                    Some(uid) => {
                        client_uid = Some(uid.clone());
                        connection_pool.register_client(uid, write_clone).await;
                        info!("User authorized successfully");
                    }
                    None => {
                        error!("Authorization failed. Closing connection.");
                        break;
                    }
                }
            }
            WSIncomingMessage::Manage(msg) => {
                info!("Processed msg {:?}", msg);
                if client_uid.clone().is_none() {
                    let _ = write.lock().await.send(Message::Text("Unauthorized".into())).await;
                    error!("Unauthorized request. Ignored.");
                    continue;
                }
                match msg {
                    SubOrUnsub::Sub(sub_ctx) => {
                    }
                    SubOrUnsub::UnSub(unsub_ctx) =>{
                    }
                    SubOrUnsub::FindGame(game_ctx) =>{
                        connection_pool.find_game(client_uid.clone().unwrap(), write_clone.clone()).await;
                    }
                }
            }
        }

    }
}
