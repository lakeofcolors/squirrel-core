-- --! Up
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    telegram_id TEXT UNIQUE NOT NULL,
    username TEXT,
    rating INTEGER NOT NULL DEFAULT 0,
    free_coins INTEGER NOT NULL DEFAULT 0,
    ton_balance BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX idx_users_rating ON users (rating DESC);
