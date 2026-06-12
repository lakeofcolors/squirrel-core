use sqlx::postgres::PgPoolOptions;
use sqlx::Row;

#[tokio::main]
async fn main() -> Result<(), sqlx::Error> {
    let database_url = std::env::var("DATABASE_URL").unwrap_or_else(|_| "postgres://postgres:postgres@localhost/squirrel_db".to_string());
    let pool = PgPoolOptions::new().connect(&database_url).await?;

    let row = sqlx::query("SELECT id, replay_events FROM matches ORDER BY id DESC LIMIT 1").fetch_one(&pool).await?;
    let id: i64 = row.get("id");
    
    // Try Vec<Value>
    let res: Result<Vec<serde_json::Value>, _> = row.try_get("replay_events");
    match res {
        Ok(v) => println!("Match ID {}: Decoded Vec<Value> len: {}", id, v.len()),
        Err(e) => println!("Match ID {}: Error decoding Vec<Value>: {:?}", id, e),
    }

    // Try sqlx::types::Json
    let res2: Result<sqlx::types::Json<Vec<serde_json::Value>>, _> = row.try_get("replay_events");
    match res2 {
        Ok(v) => println!("Match ID {}: Decoded sqlx::types::Json len: {}", id, v.0.len()),
        Err(e) => println!("Match ID {}: Error decoding sqlx::types::Json: {:?}", id, e),
    }

    // Try just Value
    let res3: Result<serde_json::Value, _> = row.try_get("replay_events");
    match res3 {
        Ok(v) => println!("Match ID {}: Decoded Value is_array: {}, is_null: {}", id, v.is_array(), v.is_null()),
        Err(e) => println!("Match ID {}: Error decoding Value: {:?}", id, e),
    }

    Ok(())
}
