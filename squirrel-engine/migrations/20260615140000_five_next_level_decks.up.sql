-- Add 5 next-level premium animated card decks to store_cosmetics
INSERT INTO store_cosmetics
    (id, item_type, item_key, title, description, price_nuts, rarity, is_active, sort_order, created_at, updated_at)
VALUES
    (
        'deck_celestial',
        'deck',
        'celestial',
        'Небесная Галактика',
        'Божественная колода с сиянием звезд, орбитами планет и космической пылью',
        200000,
        'mythic',
        TRUE,
        300,
        NOW(),
        NOW()
    ),
    (
        'deck_cyberpunk',
        'deck',
        'cyberpunk',
        'Неоновый Киберпанк',
        'Высокотехнологичная колода с глитч-эффектами, неоновыми сетками и голограммами',
        200000,
        'mythic',
        TRUE,
        310,
        NOW(),
        NOW()
    ),
    (
        'deck_abyss',
        'deck',
        'abyss',
        'Космическая Бездна',
        'Мистическая колода с притяжением черной дыры, темной энергией и вихрем пустоты',
        200000,
        'mythic',
        TRUE,
        320,
        NOW(),
        NOW()
    ),
    (
        'deck_chronos',
        'deck',
        'chronos',
        'Властелин Времени',
        'Механическая колода с вращающимися шестеренками, ходом часов и золотым песком времени',
        200000,
        'mythic',
        TRUE,
        330,
        NOW(),
        NOW()
    ),
    (
        'deck_inferno',
        'deck',
        'inferno',
        'Адское Пламя',
        'Яростная колода с плавящейся магмой, искрами пепла и огненным штормом',
        200000,
        'mythic',
        TRUE,
        340,
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
