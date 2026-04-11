DELETE FROM event_shop_items WHERE item_type = 'deck' AND item_id = 'pink';

-- We cannot easily reverse the transfer from user_boosters to user_inventory respecting the unique constraint if amount > 1
-- But we can try to insert 1 of each 
INSERT INTO user_inventory (telegram_id, item_type, item_id)
SELECT telegram_id, 'booster', booster_id FROM user_boosters WHERE amount > 0
ON CONFLICT DO NOTHING;

DROP TABLE IF EXISTS user_boosters CASCADE;
