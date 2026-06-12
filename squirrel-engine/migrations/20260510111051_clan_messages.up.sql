CREATE TABLE IF NOT EXISTS clan_messages (
    id SERIAL PRIMARY KEY,
    clan_id INTEGER REFERENCES clans(id) ON DELETE CASCADE,
    sender_id BIGINT REFERENCES users(telegram_id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
