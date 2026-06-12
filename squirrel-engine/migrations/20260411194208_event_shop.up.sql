CREATE TABLE IF NOT EXISTS event_shop_items (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    item_type TEXT NOT NULL, -- e.g. booster, chest
    item_id TEXT NOT NULL,   -- e.g. xp_booster, rare
    cost INTEGER NOT NULL,
    title TEXT NOT NULL,
    icon TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0
);

INSERT INTO event_shop_items (event_id, item_type, item_id, cost, title, icon, sort_order)
SELECT id, 'booster', 'xp_booster', 35, 'Удвоитель Опыта (1 ч)', '⭐', 1 FROM events WHERE key = 'spring_2026';

INSERT INTO event_shop_items (event_id, item_type, item_id, cost, title, icon, sort_order)
SELECT id, 'booster', 'nuts_booster', 35, 'Удвоитель Орехов (1 ч)', '🥜', 2 FROM events WHERE key = 'spring_2026';

INSERT INTO event_shop_items (event_id, item_type, item_id, cost, title, icon, sort_order)
SELECT id, 'chest', 'rare', 300, 'Редкий Сундук', '🎁', 3 FROM events WHERE key = 'spring_2026';
