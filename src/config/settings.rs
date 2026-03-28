use std::env;


#[derive(Debug, Clone)]
pub struct AppSettings {
    secret_key: String,
    bot_token: String,
}

impl AppSettings{
    pub fn new() -> Self{
        Self{
            secret_key: env::var("SECRET_KEY").expect("SECRET_KEY not found in ENV"),
            bot_token: env::var("BOT_TOKEN").expect("BOT_TOKEN not found in ENV"),
        }
    }
}
