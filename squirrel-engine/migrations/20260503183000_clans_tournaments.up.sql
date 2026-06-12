-- Add tournament coins to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS tournament_coins INTEGER NOT NULL DEFAULT 0;

-- Create Clans table
CREATE TABLE IF NOT EXISTS clans (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    tag TEXT UNIQUE NOT NULL,
    owner_id BIGINT REFERENCES users(telegram_id) ON DELETE SET NULL,
    rating INTEGER NOT NULL DEFAULT 0,
    trophies INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create Clan Members table (Unique telegram_id ensures a user can only be in one clan)
CREATE TABLE IF NOT EXISTS clan_members (
    clan_id INTEGER REFERENCES clans(id) ON DELETE CASCADE,
    telegram_id BIGINT UNIQUE REFERENCES users(telegram_id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('leader', 'officer', 'member')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (clan_id, telegram_id)
);

-- Create Tournaments table
CREATE TABLE IF NOT EXISTS tournaments (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('upcoming', 'active', 'finished'))
);

-- Insert dummy tournament for the upcoming weekend
INSERT INTO tournaments (title, start_time, end_time, status) VALUES
('Беличья Битва Выходного Дня', NOW() + INTERVAL '2 days', NOW() + INTERVAL '4 days', 'upcoming');
