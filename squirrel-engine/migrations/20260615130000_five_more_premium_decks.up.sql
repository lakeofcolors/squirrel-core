-- Add 5 more premium animated card decks to store_cosmetics
INSERT INTO store_cosmetics
    (id, item_type, item_key, title, description, price_nuts, rarity, is_active, sort_order, created_at, updated_at)
VALUES
    (
        'deck_synthwave',
        'deck',
        'synthwave',
        'Неоновый Синтвейв',
        'Премиальная колода с сеткой перспективы, закатным солнцем и артефактами в стиле 80-х',
        100000,
        'mythic',
        TRUE,
        220,
        NOW(),
        NOW()
    ),
    (
        'deck_egypt',
        'deck',
        'egypt',
        'Древний Египет',
        'Премиальная колода с песчаным свечением, древними иероглифами и фараонскими реликвиями',
        100000,
        'mythic',
        TRUE,
        230,
        NOW(),
        NOW()
    ),
    (
        'deck_singularity',
        'deck',
        'singularity',
        'Сингулярность',
        'Премиальная колода с эффектом черной дыры, гравитационным линзированием и искажением света',
        100000,
        'mythic',
        TRUE,
        240,
        NOW(),
        NOW()
    ),
    (
        'deck_glacier',
        'deck',
        'glacier',
        'Ледяной Пик',
        'Премиальная колода с ледяными морозными узорами, кристаллами и зимними реликвиями',
        100000,
        'mythic',
        TRUE,
        250,
        NOW(),
        NOW()
    ),
    (
        'deck_biohazard',
        'deck',
        'biohazard',
        'Биохазард',
        'Премиальная колода с радиоактивным свечением, поднимающимися пузырями химотходов и колбами',
        100000,
        'mythic',
        TRUE,
        260,
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
