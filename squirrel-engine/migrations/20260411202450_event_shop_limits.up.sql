ALTER TABLE event_shop_items ADD COLUMN max_purchases INTEGER DEFAULT NULL;

-- Update existing items explicitly
UPDATE event_shop_items SET max_purchases = 3 WHERE item_type = 'booster';
UPDATE event_shop_items SET max_purchases = 2 WHERE item_type = 'chest';

CREATE TABLE IF NOT EXISTS user_event_purchases (
    telegram_id BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
    shop_item_id INTEGER NOT NULL REFERENCES event_shop_items(id) ON DELETE CASCADE,
    purchase_count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (telegram_id, shop_item_id)
);
