CREATE TABLE achievements (
    key TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    icon_url TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE user_achievements (
    telegram_id BIGINT REFERENCES users(telegram_id) ON DELETE CASCADE,
    achievement_key TEXT REFERENCES achievements(key) ON DELETE CASCADE,
    unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (telegram_id, achievement_key)
);

-- Seed achievements
INSERT INTO achievements (key, title, description, icon_url, sort_order) VALUES
('first_win', 'Первая кровь', 'Одержите первую победу', 'https://api.dicebear.com/7.x/icons/svg?seed=first_win&backgroundColor=FFD700', 10),
('veteran', 'Ветеран', 'Сыграйте 100 матчей', 'https://api.dicebear.com/7.x/icons/svg?seed=veteran&backgroundColor=C0C0C0', 20),
('rich_squirrel', 'Богатая белка', 'Накопите 10,000 орехов', 'https://api.dicebear.com/7.x/icons/svg?seed=rich_squirrel&backgroundColor=FF8C00', 30),
('deck_collector', 'Коллекционер', 'Соберите 3 эпические или легендарные колоды', 'https://api.dicebear.com/7.x/icons/svg?seed=deck_collector&backgroundColor=8A2BE2', 40),
('win_streak_3', 'В ударе', 'Одержите 3 победы подряд', 'https://api.dicebear.com/7.x/icons/svg?seed=win_streak_3&backgroundColor=FF4500', 50);
