DELETE FROM store_cosmetics WHERE item_type = 'taunt';

ALTER TABLE store_cosmetics DROP CONSTRAINT IF EXISTS store_cosmetics_item_type_check;

ALTER TABLE store_cosmetics ADD CONSTRAINT store_cosmetics_item_type_check CHECK (item_type IN ('deck', 'background'));
