-- Revert Store Cosmetics Prices
UPDATE store_cosmetics SET price_nuts = 0 WHERE rarity = 'common';
UPDATE store_cosmetics SET price_nuts = 250 WHERE rarity = 'rare';
UPDATE store_cosmetics SET price_nuts = 900 WHERE rarity = 'epic';
UPDATE store_cosmetics SET price_nuts = 1100 WHERE rarity = 'legendary';
UPDATE store_cosmetics SET price_nuts = 3000 WHERE rarity = 'mythic';

-- Revert Nuts Packs
DELETE FROM store_nuts_packs;

INSERT INTO store_nuts_packs
    (id, title, description, xtr_amount, nuts_amount, bonus_nuts_amount, is_featured, is_active, sort_order, created_at, updated_at)
VALUES
    ('nuts_250', '250 орехов', 'Стартовый пакет орехов', 80, 250, 0, FALSE, TRUE, 10, NOW(), NOW()),
    ('nuts_700', '700 орехов', 'Средний пакет орехов с бонусом', 199, 700, 50, FALSE, TRUE, 20, NOW(), NOW()),
    ('nuts_1500', '1500 орехов', 'Популярный пакет орехов', 350, 1500, 200, TRUE, TRUE, 30, NOW(), NOW()),
    ('nuts_4000', '4000 орехов', 'Большой пакет орехов с максимальной выгодой', 900, 4000, 500, FALSE, TRUE, 40, NOW(), NOW());
