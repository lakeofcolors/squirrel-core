DELETE FROM store_cosmetics WHERE item_type = 'booster';

DROP TABLE IF EXISTS user_quest_progress CASCADE;
DROP TABLE IF EXISTS event_quests CASCADE;
DROP TABLE IF EXISTS user_event_currency CASCADE;
DROP TABLE IF EXISTS events CASCADE;

ALTER TABLE store_cosmetics DROP CONSTRAINT IF EXISTS store_cosmetics_item_type_check;
ALTER TABLE store_cosmetics ADD CONSTRAINT store_cosmetics_item_type_check CHECK (item_type IN ('deck', 'background', 'taunt'));

ALTER TABLE user_inventory DROP CONSTRAINT IF EXISTS user_inventory_item_type_check;
ALTER TABLE user_inventory ADD CONSTRAINT user_inventory_item_type_check CHECK (item_type IN ('deck', 'background', 'taunt'));

ALTER TABLE users DROP COLUMN IF EXISTS xp;
ALTER TABLE users DROP COLUMN IF EXISTS xp_booster_ends_at;
ALTER TABLE users DROP COLUMN IF EXISTS nuts_booster_ends_at;
