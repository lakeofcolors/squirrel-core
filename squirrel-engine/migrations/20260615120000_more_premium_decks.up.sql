-- Add more premium animated card decks to store_cosmetics
INSERT INTO store_cosmetics
    (id, item_type, item_key, title, description, price_nuts, rarity, is_active, sort_order, created_at, updated_at)
VALUES
    (
        'deck_arcane',
        'deck',
        'arcane',
        'Древний Аркан',
        'Премиальная колода с вращающимися магическими кругами и руническими артефактами',
        100000,
        'mythic',
        TRUE,
        200,
        NOW(),
        NOW()
    ),
    (
        'deck_mecha',
        'deck',
        'mecha',
        'Стальной Протокол',
        'Премиальная колода с тактическим HUD-интерфейсом и кибернетическими деталями',
        100000,
        'mythic',
        TRUE,
        210,
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
