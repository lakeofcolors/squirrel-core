-- Add premium animated card decks to store_cosmetics
INSERT INTO store_cosmetics
    (id, item_type, item_key, title, description, price_nuts, rarity, is_active, sort_order, created_at, updated_at)
VALUES
    (
        'deck_cosmic',
        'deck',
        'cosmic',
        'Космическая бездна',
        'Премиальная колода с эффектом звездного свечения и туманностей',
        100000,
        'mythic',
        TRUE,
        170,
        NOW(),
        NOW()
    ),
    (
        'deck_magma',
        'deck',
        'magma',
        'Первородная магма',
        'Премиальная колода с раскаленной лавой и вулканическим сиянием',
        100000,
        'mythic',
        TRUE,
        180,
        NOW(),
        NOW()
    ),
    (
        'deck_matrix',
        'deck',
        'matrix',
        'Цифровой глитч',
        'Премиальная колода в стиле киберпанка и глитч-эффектов',
        100000,
        'mythic',
        TRUE,
        190,
        NOW(),
        NOW()
    )
ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    price_nuts = EXCLUDED.price_nuts,
    rarity = EXCLUDED.rarity,
    is_active = EXCLUDED.is_active,
    sort_order = EXCLUDED.sort_order,
    updated_at = NOW();
