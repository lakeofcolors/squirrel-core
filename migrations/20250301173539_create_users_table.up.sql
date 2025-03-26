-- --! Up
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    rating INTEGER NOT NULL DEFAULT 0,
    free_coins INTEGER NOT NULL DEFAULT 0,
    ton_balance BIGINT NOT NULL DEFAULT 0
);
