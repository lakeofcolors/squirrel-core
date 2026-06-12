-- Add user_rewards table

CREATE TABLE IF NOT EXISTS user_rewards (
    id BIGSERIAL PRIMARY KEY,
    telegram_id BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
    reward_key TEXT NOT NULL, -- e.g. 'first_win', 'streak_5', 'gold_league'
    title TEXT NOT NULL,
    icon TEXT NOT NULL,
    rarity TEXT NOT NULL CHECK (rarity IN ('Common', 'Rare', 'Epic', 'Legendary', 'Mythic')),
    unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (telegram_id, reward_key)
);

CREATE INDEX IF NOT EXISTS idx_user_rewards_telegram_id ON user_rewards(telegram_id);
