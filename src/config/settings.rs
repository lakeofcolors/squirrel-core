use std::env;


#[derive(Debug, Clone)]
pub struct AppSettings {
    secret_key: String,
}

impl AppSettings{
    async fn new(&self) -> Self{
        Self{
            secret_key: env::var("SECRET_KEY").expect("SECRET_KEY not found in ENV"),
        }
    }
}
