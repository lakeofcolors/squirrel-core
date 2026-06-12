ALTER TABLE user_inventory DROP CONSTRAINT user_inventory_item_type_check;
ALTER TABLE user_inventory ADD CONSTRAINT user_inventory_item_type_check CHECK (item_type IN ('deck', 'background'));
