use hmac::{Hmac, Mac};
use sha2::{Sha256, Digest};
use serde::Deserialize;
use std::collections::{BTreeMap};
use tracing::{info, warn, error};
use url::form_urlencoded;
use hex;

#[derive(Debug, Deserialize)]
pub struct TelegramUser {
    pub id: u64,
    pub username: Option<String>,
    pub first_name: String,
    pub photo_url: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct TelegramInitData {
    pub user: TelegramUser,
}

type HmacSha256 = Hmac<Sha256>;

pub fn verify_telegram_auth(init_data: &str, bot_token: &str) -> Result<TelegramInitData, ()> {
    let parsed = form_urlencoded::parse(init_data.as_bytes());

    let mut params: BTreeMap<String, String> = BTreeMap::new();
    let mut hash = String::new();

    for (key, value) in parsed {
        if key == "hash" {
            hash = value.to_string();
        } else {
            params.insert(key.to_string(), value.to_string());
        }
    }

    let data_check_string = params
        .iter()
        .map(|(k, v)| format!("{k}={v}"))
        .collect::<Vec<_>>()
        .join("\n");

    //  secret_key = HMAC_SHA256("WebAppData", bot_token)
    let mut secret_hmac = HmacSha256::new_from_slice(b"WebAppData").map_err(|_| ())?;
    secret_hmac.update(bot_token.as_bytes());
    let secret_key = secret_hmac.finalize().into_bytes();

    //  hmac = HMAC_SHA256(data_check_string, secret_key)
    let mut check_hmac = HmacSha256::new_from_slice(&secret_key).map_err(|_| ())?;
    check_hmac.update(data_check_string.as_bytes());
    let calc_hash = hex::encode(check_hmac.finalize().into_bytes());

    if calc_hash == hash {
        let user_json = params.get("user").ok_or(())?;
        info!("json: {:?}", user_json);

        let user : TelegramUser = serde_json::from_str(user_json).map_err(|_| ())?;
        info!("json: {:?}", user);


        let init_data = TelegramInitData { user };

        Ok(init_data)
    } else {
        Err(())
    }
}
