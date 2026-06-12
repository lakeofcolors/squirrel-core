-- Rebalance Store Cosmetics Prices
UPDATE store_cosmetics SET price_nuts = 0 WHERE rarity = 'common';
UPDATE store_cosmetics SET price_nuts = 500 WHERE rarity = 'rare';
UPDATE store_cosmetics SET price_nuts = 2000 WHERE rarity = 'epic';
UPDATE store_cosmetics SET price_nuts = 7500 WHERE rarity = 'legendary';
UPDATE store_cosmetics SET price_nuts = 20000 WHERE rarity = 'mythic';

-- Rebalance Nuts Packs
DELETE FROM store_nuts_packs;

INSERT INTO store_nuts_packs
    (id, title, description, xtr_amount, nuts_amount, bonus_nuts_amount, is_featured, is_active, sort_order, created_at, updated_at)
VALUES
    ('nuts_1000', 'Горсть орехов', '1000 орехов для хорошего старта', 50, 1000, 0, FALSE, TRUE, 10, NOW(), NOW()),
    ('nuts_2500', 'Мешок орехов', '2500 орехов', 100, 2500, 200, FALSE, TRUE, 20, NOW(), NOW()),
    ('nuts_7500', 'Сундук орехов', 'Хватит на легендарный предмет!', 250, 7500, 500, TRUE, TRUE, 30, NOW(), NOW()),
    ('nuts_20000', 'Склад орехов', 'Хватит на мифический предмет!', 500, 20000, 1500, FALSE, TRUE, 40, NOW(), NOW());
