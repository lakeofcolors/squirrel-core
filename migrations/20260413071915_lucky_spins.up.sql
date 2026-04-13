CREATE TABLE lucky_spin_rewards (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    reward_type VARCHAR(50) NOT NULL, -- 'nuts', 'cosmetic', 'tickets'
    item_id VARCHAR(255), -- If reward_type is cosmetic
    amount INT NOT NULL DEFAULT 1,
    weight INT NOT NULL DEFAULT 10,
    hex_color VARCHAR(10) NOT NULL DEFAULT '#1a1a2e',
    icon_emoji VARCHAR(10) NOT NULL DEFAULT '🎁'
);

CREATE TABLE user_lucky_spins (
    telegram_id BIGINT PRIMARY KEY REFERENCES users(telegram_id) ON DELETE CASCADE,
    last_free_spin_at TIMESTAMP WITH TIME ZONE
);

-- Seed basic items for the lucky spin (8 items)
INSERT INTO lucky_spin_rewards (name, reward_type, item_id, amount, weight, hex_color, icon_emoji) VALUES
('100 Орехов', 'nuts', NULL, 100, 30, '#1a1a2e', '🥜'),
('500 Орехов', 'nuts', NULL, 500, 10, '#3b0764', '🥜'),
('Стол: Неоновый', 'cosmetic', 'neon_table', 1, 5, '#1e3a8a', '✨'),
('50 Орехов', 'nuts', NULL, 50, 40, '#064e3b', '🥜'),
('1000 Орехов', 'nuts', NULL, 1000, 2, '#4c1d95', '💎'),
('Рубашка: Золотая', 'cosmetic', 'golden_deck', 1, 1, '#78350f', '🃏'),
('200 Орехов', 'nuts', NULL, 200, 20, '#831843', '🥜'),
('Малая коробка', 'cosmetic', 'small_chest', 1, 15, '#1e1b4b', '📦');
