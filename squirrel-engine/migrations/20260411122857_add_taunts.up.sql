ALTER TABLE store_cosmetics DROP CONSTRAINT IF EXISTS store_cosmetics_item_type_check;

ALTER TABLE store_cosmetics ADD CONSTRAINT store_cosmetics_item_type_check CHECK (item_type IN ('deck', 'background', 'taunt'));

INSERT INTO store_cosmetics
    (id, item_type, item_key, title, description, price_nuts, rarity, is_active, sort_order, created_at, updated_at)
VALUES
    ('taunt_chipmunk', 'taunt', '🐿', 'Бурундук', 'Стандартная насмешка', 0, 'common', TRUE, 300, NOW(), NOW()),
    ('taunt_angry', 'taunt', '😡', 'Злой', 'Стандартная насмешка', 0, 'common', TRUE, 310, NOW(), NOW()),
    ('taunt_laugh', 'taunt', '😂', 'Смех', 'Стандартная насмешка', 0, 'common', TRUE, 320, NOW(), NOW()),
    ('taunt_cool', 'taunt', '😎', 'Крутой', 'Стильная насмешка', 100, 'rare', TRUE, 330, NOW(), NOW()),
    ('taunt_cry', 'taunt', '😭', 'Плач', 'Типо плачешь', 150, 'rare', TRUE, 340, NOW(), NOW()),
    ('taunt_money', 'taunt', '🤑', 'Деньги', 'Насмешка для богатых', 500, 'epic', TRUE, 350, NOW(), NOW()),
    ('taunt_clown', 'taunt', '🤡', 'Клоун', 'Для троллинга оппонента', 1000, 'legendary', TRUE, 360, NOW(), NOW()),
    ('taunt_fire', 'taunt', '🔥', 'Огонь', 'Для горячих каток', 2000, 'mythic', TRUE, 370, NOW(), NOW());
