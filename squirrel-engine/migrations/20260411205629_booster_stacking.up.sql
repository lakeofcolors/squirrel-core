-- 1. Ensure event_shop item_ids match store logically, and users' previously bought match too
UPDATE event_shop_items SET item_id = 'xp_1h' WHERE item_type = 'booster' AND item_id = 'xp_booster';
UPDATE event_shop_items SET item_id = 'nuts_1h' WHERE item_type = 'booster' AND item_id = 'nuts_booster';

UPDATE user_inventory SET item_id = 'xp_1h' WHERE item_type = 'booster' AND item_id = 'xp_booster';
UPDATE user_inventory SET item_id = 'nuts_1h' WHERE item_type = 'booster' AND item_id = 'nuts_booster';

UPDATE user_event_purchases SET shop_item_id = (SELECT id FROM event_shop_items WHERE item_type = 'booster' AND item_id = 'xp_1h' LIMIT 1) WHERE shop_item_id = (SELECT id FROM event_shop_items WHERE item_type = 'booster' AND item_id = 'xp_booster' LIMIT 1);
UPDATE user_event_purchases SET shop_item_id = (SELECT id FROM event_shop_items WHERE item_type = 'booster' AND item_id = 'nuts_1h' LIMIT 1) WHERE shop_item_id = (SELECT id FROM event_shop_items WHERE item_type = 'booster' AND item_id = 'nuts_booster' LIMIT 1);

-- 2. Create user_boosters table
CREATE TABLE IF NOT EXISTS user_boosters (
    telegram_id BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
    booster_id TEXT NOT NULL,
    amount INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (telegram_id, booster_id)
);

CREATE INDEX IF NOT EXISTS idx_user_boosters_telegram_id ON user_boosters(telegram_id);

-- 3. Move existing boosters from inventory to user_boosters
INSERT INTO user_boosters (telegram_id, booster_id, amount)
SELECT telegram_id, item_id, COUNT(*) 
FROM user_inventory 
WHERE item_type = 'booster'
GROUP BY telegram_id, item_id
ON CONFLICT (telegram_id, booster_id) DO UPDATE SET amount = user_boosters.amount + EXCLUDED.amount;

-- 4. Delete boosters from user_inventory since they are now stackable
DELETE FROM user_inventory WHERE item_type = 'booster';

-- 5. Add Pink Deck to event shop
INSERT INTO event_shop_items (event_id, item_type, item_id, cost, title, icon, sort_order, max_purchases)
SELECT id, 'deck', 'pink', 150, 'Розовая колода', '🌸', 4, 1 
FROM events WHERE key = 'spring_2026';

-- Apply the user's requested limit of 1
UPDATE event_shop_items SET max_purchases = 1 WHERE item_type = 'booster';
UPDATE event_shop_items SET max_purchases = 1 WHERE item_type = 'chest';
