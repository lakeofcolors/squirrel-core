use hmac::{Hmac, Mac};
use sha2::{Sha256, Digest};
use serde::Deserialize;
use std::collections::HashMap;
use tracing::{info, warn, error};

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
    info!("Init data {}", init_data);
    use url::form_urlencoded;

    let parsed: HashMap<String, String> =
        form_urlencoded::parse(init_data.as_bytes()).into_owned().collect();

    let hash = parsed.get("hash").ok_or(())?.to_owned();

    let mut kv: Vec<(String, String)> = parsed
        .iter()
        .filter(|(k, _)| k.as_str() != "hash")
        .map(|(k, v)| (k.clone(), v.clone()))
        .collect();
    kv.sort_by(|a, b| a.0.cmp(&b.0));

    info()

    let data_check_string = kv
        .iter()
        .map(|(k, v)| format!("{k}={v}"))
        .collect::<Vec<_>>()
        .join("\n");

    let secret_key = Sha256::digest(bot_token.as_bytes());
    let mut mac = Hmac::<Sha256>::new_from_slice(&secret_key).map_err(|_| ())?;
    mac.update(data_check_string.as_bytes());
    let calc_hash = format!("{:x}", mac.finalize().into_bytes());

    info!("calc_hash {:?}", calc_hash);
    info!("hash {:?}", hash);

    if calc_hash != hash {
        return Err(());
    }

    let user_json = parsed.get("user").ok_or(())?;
    let user: TelegramUser = serde_json::from_str(user_json).map_err(|_| ())?;

    let auth_date = parsed.get("auth_date").cloned().unwrap_or_default();

    Ok(TelegramInitData { user, auth_date })
}
