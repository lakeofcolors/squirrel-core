use hmac::{Hmac, Mac};
use sha2::{Sha256, Digest};
use serde::Deserialize;
use std::collections::HashMap;
use tracing::{info, warn, error};
use url::form_urlencoded;
use hex;

#[derive(Debug, Deserialize)]
pub struct TelegramUser {
    pub id: String,
    pub username: Option<String>,
    pub first_name: String,
}

#[derive(Debug, Deserialize)]
pub struct TelegramInitData {
    pub user: TelegramUser,
    pub auth_date: String,
}

pub fn verify_telegram_auth(init_data: &str, bot_token: &str) -> Result<TelegramInitData, ()> {

    let parsed: HashMap<String, String> =
        form_urlencoded::parse(init_data.as_bytes()).into_owned().collect();

    let hash = parsed.get("hash").ok_or(())?.to_owned();

    let mut kv: Vec<&str> = init_data
        .split('&')
        .filter(|s| !s.starts_with("hash=") && !s.starts_with("signature="))
        .collect();
    kv.sort();

    let data_check_string = kv.join("\n");

    let mut secret_mac = Hmac::<Sha256>::new_from_slice(b"WebAppData").map_err(|_| ())?;
    secret_mac.update(bot_token.as_bytes());
    let secret_key = secret_mac.finalize().into_bytes();

    let mut mac = Hmac::<Sha256>::new_from_slice(&secret_key).map_err(|_| ())?;
    mac.update(data_check_string.as_bytes());
    let calc_hash = hex::encode(mac.finalize().into_bytes());

    if calc_hash != hash {
        return Err(());
    }

    let user_json = parsed.get("user").ok_or(())?;
    let user: TelegramUser = serde_json::from_str(user_json).map_err(|_| ())?;
    let auth_date = parsed.get("auth_date").cloned().unwrap_or_default();

    Ok(TelegramInitData { user, auth_date })
}
