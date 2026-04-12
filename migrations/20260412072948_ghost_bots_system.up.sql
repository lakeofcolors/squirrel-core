CREATE TABLE ghost_bots (
    telegram_id BIGINT PRIMARY KEY REFERENCES users(telegram_id) ON DELETE CASCADE,
    is_active BOOLEAN NOT NULL DEFAULT true
);
