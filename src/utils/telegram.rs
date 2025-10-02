use hmac::{Hmac, Mac};
use sha2::{Sha256, Digest};

pub fn verify_telegram_auth(init_data: &str, bot_token: &str) -> Result<serde_json::Value, ()> {
    use url::form_urlencoded;

    let parsed: Vec<(String, String)> = form_urlencoded::parse(init_data.as_bytes())
        .into_owned()
        .collect();

    let mut hash = None;
    let mut data_check_string = String::new();

    for (k, v) in parsed.iter() {
        if k == "hash" {
            hash = Some(v.clone());
        }
    }

    let mut data: Vec<_> = parsed.into_iter().filter(|(k, _)| k != "hash").collect();
    data.sort_by(|a, b| a.0.cmp(&b.0));

    for (i, (k, v)) in data.iter().enumerate() {
        if i > 0 {
            data_check_string.push('\n');
        }
        data_check_string.push_str(&format!("{}={}", k, v));
    }

    let secret_key = Sha256::digest(bot_token.as_bytes());
    let mut mac = Hmac::<Sha256>::new_from_slice(&secret_key).unwrap();
    mac.update(data_check_string.as_bytes());
    let calc_hash = hex::encode(mac.finalize().into_bytes());

    if Some(calc_hash) == hash {
        Ok(serde_json::from_str::<serde_json::Value>(&format!("{{{}}}", data_check_string)).unwrap())
    } else {
        Err(())
    }
}
