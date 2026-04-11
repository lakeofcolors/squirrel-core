CREATE TABLE IF NOT EXISTS user_chests (
    id BIGSERIAL PRIMARY KEY,
    telegram_id BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
    chest_type TEXT NOT NULL CHECK (chest_type IN ('common', 'rare', 'epic', 'legendary')),
    amount INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (telegram_id, chest_type)
);

CREATE INDEX IF NOT EXISTS idx_user_chests_telegram_id ON user_chests(telegram_id);
