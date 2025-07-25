use jsonwebtoken::EncodingKey;
use jsonwebtoken::{decode, encode, Header, DecodingKey, Validation, Algorithm, errors::Error};
use serde::{Serialize, Deserialize};
use crate::utils::schemas::{Auth, WSEvent};
use axum::extract::ws::Message;
use std::sync::Arc;
use std::time::{UNIX_EPOCH, SystemTime};
use tokio::sync::Mutex;
use tracing::{error, info};
use futures_util::SinkExt;
use futures_util::Sink;

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub exp: usize,
}

const SECRET: &[u8] = b"fuckyou";

pub fn validate_token(token: &str) -> Result<Claims, Error> {
    let decoded = decode::<Claims>(
        token,
        &DecodingKey::from_secret(SECRET),
        &Validation::new(Algorithm::HS256),
    )?;
    Ok(decoded.claims)
}

pub fn generate_token(username: &str, exp: Option<u64>) -> Result<String, jsonwebtoken::errors::Error> {
    let expiration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs() + exp.unwrap_or(3600);

    let claims = Claims{
        exp: expiration as usize,
        sub: username.to_string(),
    };

    // #TODO secret variable
    encode(&Header::default(), &claims, &EncodingKey::from_secret(SECRET))
}

pub async fn handle_auth(auth_msg: Auth, write: &Arc<Mutex<impl SinkExt<Message> + Unpin + Send>>) -> Option<String> {
    match validate_token(&auth_msg.token) {
        Ok(claims) => {
            // TODO  send like json object {"detail": "", "err_code"}
            // println!("{:?}", claims);
            let json = serde_json::to_string(&WSEvent::SuccessLogin { username: claims.sub.clone() }).unwrap();
            let _ = write.lock().await.send(Message::Text(json)).await;
            Some(claims.sub)
        }
        Err(err) => {
            error!("Invalid token: {:?}", err);
            let json = serde_json::to_string(&WSEvent::Error{detail: "Invalid token. Disconnecting.".to_string()}).unwrap();
            let _ = write.lock().await.send(Message::Text(json)).await;
            None
        }
    }
}
