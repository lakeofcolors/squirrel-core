use sqlx::postgres::PgPool;
use sqlx::postgres::PgPoolOptions;
use std::time::Duration;
use dotenvy::dotenv;

pub async fn pg_pool() -> Result<PgPool, sqlx::Error> {
    dotenv().ok();
    let database_url = format!(
        "postgresql://{}:{}@{}:{}/{}",
        std::env::var("POSTGRES_USER").unwrap(),
        std::env::var("POSTGRES_PASSWORD").unwrap(),
        std::env::var("POSTGRES_HOST").unwrap(),
        std::env::var("POSTGRES_PORT").unwrap(),
        std::env::var("POSTGRES_DB").unwrap()
    );


    let pool = PgPoolOptions::new()
        .min_connections(0)
        .max_connections(256)
        .acquire_timeout(Duration::from_secs(30))
        .connect(&database_url)
        .await?;
    Ok(pool)
}

