-- --! Up

-- =========================================
-- STORE ORDERS (Telegram Stars / XTR)
-- =========================================

CREATE TABLE IF NOT EXISTS store_orders (
    id TEXT PRIMARY KEY,
    telegram_id BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
    product_id TEXT NOT NULL,
    nuts_amount BIGINT NOT NULL,
    xtr_amount BIGINT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'failed', 'cancelled')),
    telegram_payment_charge_id TEXT,
    provider_payment_charge_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    paid_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_store_orders_telegram_id ON store_orders (telegram_id);
CREATE INDEX IF NOT EXISTS idx_store_orders_status ON store_orders (status);
CREATE INDEX IF NOT EXISTS idx_store_orders_created_at ON store_orders (created_at DESC);


-- =========================================
-- WALLET TRANSACTIONS
-- =========================================

CREATE TABLE IF NOT EXISTS wallet_transactions (
    id BIGSERIAL PRIMARY KEY,
    telegram_id BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
    amount BIGINT NOT NULL,
    currency TEXT NOT NULL CHECK (currency IN ('nuts', 'ton')),
    tx_type TEXT NOT NULL CHECK (tx_type IN ('topup', 'spend', 'reward', 'refund', 'adjustment')),
    metadata TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_telegram_id ON wallet_transactions (telegram_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created_at ON wallet_transactions (created_at DESC);


-- =========================================
-- INVENTORY
-- =========================================

CREATE TABLE IF NOT EXISTS user_inventory (
    id BIGSERIAL PRIMARY KEY,
    telegram_id BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
    item_type TEXT NOT NULL CHECK (item_type IN ('deck', 'background')),
    item_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (telegram_id, item_type, item_id)
);

CREATE INDEX IF NOT EXISTS idx_user_inventory_telegram_id ON user_inventory (telegram_id);
CREATE INDEX IF NOT EXISTS idx_user_inventory_item_type ON user_inventory (item_type);

CREATE TABLE IF NOT EXISTS user_equipped_items (
    telegram_id BIGINT PRIMARY KEY REFERENCES users(telegram_id) ON DELETE CASCADE,
    equipped_deck_id TEXT,
    equipped_background_id TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =========================================
-- REWARDED ADS SESSIONS
-- =========================================

CREATE TABLE IF NOT EXISTS rewarded_sessions (
    id TEXT PRIMARY KEY,
    telegram_id BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
    reward_type TEXT NOT NULL CHECK (reward_type IN ('nuts')),
    reward_amount BIGINT NOT NULL,
    ad_provider TEXT,
    status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'expired')),
    provider_event_id TEXT,
    custom_data TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_rewarded_sessions_provider_event_id
    ON rewarded_sessions (provider_event_id)
    WHERE provider_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rewarded_sessions_telegram_id ON rewarded_sessions (telegram_id);
CREATE INDEX IF NOT EXISTS idx_rewarded_sessions_status ON rewarded_sessions (status);


-- =========================================
-- MATCHES
-- =========================================

CREATE TABLE IF NOT EXISTS matches (
    id BIGSERIAL PRIMARY KEY,
    room_id TEXT,
    mode TEXT NOT NULL, -- Ranked 2v2 / Casual 2v2
    is_ranked BOOLEAN NOT NULL DEFAULT FALSE,
    stake BIGINT NOT NULL DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('pending', 'active', 'finished', 'cancelled')),
    end_reason TEXT CHECK (end_reason IN ('normal', 'abandoned', 'timeout', 'server_stop')),
    winner_team TEXT,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_matches_created_at
    ON matches (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_matches_status
    ON matches (status);

CREATE INDEX IF NOT EXISTS idx_matches_room_id
    ON matches (room_id);


-- =========================================
-- MATCH PLAYERS
-- =========================================

CREATE TABLE IF NOT EXISTS match_players (
    id BIGSERIAL PRIMARY KEY,
    match_id BIGINT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    telegram_id BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
    team TEXT,
    seat INTEGER,
    result TEXT NOT NULL CHECK (result IN ('win', 'lose', 'abandoned')),
    rating_before INTEGER NOT NULL DEFAULT 0,
    rating_after INTEGER NOT NULL DEFAULT 0,
    rating_delta INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (match_id, telegram_id)
);

CREATE INDEX IF NOT EXISTS idx_match_players_match_id
    ON match_players (match_id);

CREATE INDEX IF NOT EXISTS idx_match_players_telegram_id
    ON match_players (telegram_id);

CREATE INDEX IF NOT EXISTS idx_match_players_result
    ON match_players (result);


-- =========================================
-- MATCH HISTORY (READ MODEL FOR PROFILE/UI)
-- =========================================

CREATE TABLE IF NOT EXISTS match_history (
    id BIGSERIAL PRIMARY KEY,
    match_id BIGINT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    telegram_id BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
    room_id TEXT,
    mode TEXT NOT NULL,
    result TEXT NOT NULL CHECK (result IN ('win', 'lose', 'abandoned')),
    score TEXT,
    rating_delta INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (match_id, telegram_id)
);

CREATE INDEX IF NOT EXISTS idx_match_history_telegram_id_created_at
    ON match_history (telegram_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_match_history_match_id
    ON match_history (match_id);

-- =========================================
-- FRIENDS
-- =========================================

-- Заявки в друзья
CREATE TABLE IF NOT EXISTS friend_requests (
    id BIGSERIAL PRIMARY KEY,
    from_telegram_id BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
    to_telegram_id BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    responded_at TIMESTAMPTZ,
    CHECK (from_telegram_id <> to_telegram_id),
    UNIQUE (from_telegram_id, to_telegram_id)
);

CREATE INDEX IF NOT EXISTS idx_friend_requests_from_user
    ON friend_requests (from_telegram_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_friend_requests_to_user
    ON friend_requests (to_telegram_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_friend_requests_status
    ON friend_requests (status);

-- Список друзей
CREATE TABLE IF NOT EXISTS user_friends (
    id BIGSERIAL PRIMARY KEY,
    user_telegram_id BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
    friend_telegram_id BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (user_telegram_id <> friend_telegram_id),
    UNIQUE (user_telegram_id, friend_telegram_id)
);

CREATE INDEX IF NOT EXISTS idx_user_friends_user
    ON user_friends (user_telegram_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_friends_friend
    ON user_friends (friend_telegram_id);

-- Игровые инвайты
CREATE TABLE IF NOT EXISTS game_invites (
    id BIGSERIAL PRIMARY KEY,
    from_telegram_id BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
    to_telegram_id BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
    room_id TEXT,
    status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    responded_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    CHECK (from_telegram_id <> to_telegram_id)
);

CREATE INDEX IF NOT EXISTS idx_game_invites_to_user
    ON game_invites (to_telegram_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_game_invites_from_user
    ON game_invites (from_telegram_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_game_invites_room_id
    ON game_invites (room_id);
