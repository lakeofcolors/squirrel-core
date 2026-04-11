-- Add XP and Booster logic to Users
ALTER TABLE users ADD COLUMN IF NOT EXISTS xp INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS xp_booster_ends_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS nuts_booster_ends_at TIMESTAMPTZ;

-- Adjust inventory constraints for boosters
ALTER TABLE store_cosmetics DROP CONSTRAINT IF EXISTS store_cosmetics_item_type_check;
ALTER TABLE store_cosmetics ADD CONSTRAINT store_cosmetics_item_type_check CHECK (item_type IN ('deck', 'background', 'taunt', 'booster'));

ALTER TABLE user_inventory DROP CONSTRAINT IF EXISTS user_inventory_item_type_check;
ALTER TABLE user_inventory ADD CONSTRAINT user_inventory_item_type_check CHECK (item_type IN ('deck', 'background', 'taunt', 'booster'));

-- Create events table
CREATE TABLE IF NOT EXISTS events (
    id SERIAL PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    currency_icon TEXT NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Event Currency Balance
CREATE TABLE IF NOT EXISTS user_event_currency (
    telegram_id BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (telegram_id, event_id)
);

-- Event quests table
CREATE TABLE IF NOT EXISTS event_quests (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    quest_type TEXT NOT NULL, -- e.g. play_ranked, win_bot, add_friend
    target_amount INTEGER NOT NULL,
    reward_type TEXT NOT NULL, -- e.g. event_currency, nuts, xp, chest
    reward_amount INTEGER NOT NULL,
    reward_item_id TEXT, -- e.g. common, rare 
    title TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
);

-- User quest progress
CREATE TABLE IF NOT EXISTS user_quest_progress (
    telegram_id BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
    quest_id INTEGER NOT NULL REFERENCES event_quests(id) ON DELETE CASCADE,
    current_amount INTEGER NOT NULL DEFAULT 0,
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    is_claimed BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (telegram_id, quest_id)
);

CREATE INDEX IF NOT EXISTS idx_user_quest_progress_telegram_id ON user_quest_progress(telegram_id);

-- Insert a Mock Event: "Праздник Весны" (Spring Festival)
INSERT INTO events (key, title, description, currency_icon, start_time, end_time, is_active)
VALUES (
    'spring_2026', 
    'Весенний Фестиваль', 
    'Выполняйте задания, собирайте весенние цветы и обменивайте их на уникальные награды!', 
    '🌸', 
    NOW() - INTERVAL '1 day', 
    NOW() + INTERVAL '14 days', 
    TRUE
) ON CONFLICT (key) DO NOTHING;

-- Insert Event Quests
INSERT INTO event_quests (event_id, quest_type, target_amount, reward_type, reward_amount, title, sort_order)
SELECT id, 'play_ranked', 1, 'event_currency', 50, 'Сыграть 1 рейтинговую игру', 1 FROM events WHERE key = 'spring_2026';

INSERT INTO event_quests (event_id, quest_type, target_amount, reward_type, reward_amount, title, sort_order)
SELECT id, 'win_ranked', 3, 'event_currency', 100, 'Выиграть 3 рейтинговые игры', 2 FROM events WHERE key = 'spring_2026';

INSERT INTO event_quests (event_id, quest_type, target_amount, reward_type, reward_amount, title, sort_order)
SELECT id, 'play_bot', 5, 'xp', 200, 'Сыграть 5 игр с ботами', 3 FROM events WHERE key = 'spring_2026';

INSERT INTO event_quests (event_id, quest_type, target_amount, reward_type, reward_amount, title, sort_order)
SELECT id, 'add_friend', 1, 'chest', 1, 'Добавить нового друга', 4 FROM events WHERE key = 'spring_2026';

-- Delete related items and Insert Boosters into store_cosmetics
DELETE FROM store_cosmetics WHERE item_type = 'booster';

INSERT INTO store_cosmetics (id, item_type, item_key, title, description, price_nuts, rarity, is_active, sort_order, created_at, updated_at)
VALUES 
    ('booster_xp_1h', 'booster', 'xp_1h', 'Бустер Опыта (1 ч.)', 'Удваивает получаемый опыт на 1 час', 500, 'rare', TRUE, 400, NOW(), NOW()),
    ('booster_nuts_1h', 'booster', 'nuts_1h', 'Бустер Орехов (1 ч.)', 'Удваивает получаемые орехи на 1 час', 800, 'epic', TRUE, 410, NOW(), NOW());
