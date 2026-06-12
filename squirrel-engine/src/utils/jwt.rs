use async_trait::async_trait;
use axum::{
    extract::FromRequestParts,
    http::{header::AUTHORIZATION, request::Parts, StatusCode},
};
use jsonwebtoken::EncodingKey;
use jsonwebtoken::{decode, encode, errors::Error, Algorithm, DecodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: i64,
    pub exp: usize,
}

#[derive(Debug, Clone)]
pub struct AuthUser {
    pub telegram_id: i64,
}

const SECRET: &[u8] = b"fuckyou";

#[async_trait]
impl<S> FromRequestParts<S> for AuthUser
where
    S: Send + Sync,
{
    type Rejection = (StatusCode, String);

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        let auth_header = parts.headers.get(AUTHORIZATION).ok_or((
            StatusCode::UNAUTHORIZED,
            "Missing Authorization header".to_string(),
        ))?;

        let auth_str = auth_header.to_str().map_err(|_| {
            (
                StatusCode::UNAUTHORIZED,
                "Invalid Authorization header".to_string(),
            )
        })?;

        let token = auth_str
            .strip_prefix("Bearer ")
            .ok_or((StatusCode::UNAUTHORIZED, "Invalid Bearer token".to_string()))?;

        let claims = validate_token(token).map_err(|_| {
            (
                StatusCode::UNAUTHORIZED,
                "Invalid or expired token".to_string(),
            )
        })?;

        Ok(AuthUser {
            telegram_id: claims.sub,
        })
    }
}

pub fn validate_token(token: &str) -> Result<Claims, Error> {
    let decoded = decode::<Claims>(
        token,
        &DecodingKey::from_secret(SECRET),
        &Validation::new(Algorithm::HS256),
    )?;
    Ok(decoded.claims)
}

pub fn generate_token(
    player_id: i64,
    exp: Option<u64>,
) -> Result<String, jsonwebtoken::errors::Error> {
    let expiration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs()
        + exp.unwrap_or(3600);

    let claims = Claims {
        exp: expiration as usize,
        sub: player_id,
    };

    // #TODO secret variable
    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(SECRET),
    )
}
