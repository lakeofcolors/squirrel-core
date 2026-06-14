-- Add 3 ultimate super-premium animated card decks to store_cosmetics
INSERT INTO store_cosmetics
    (id, item_type, item_key, title, description, price_nuts, rarity, is_active, sort_order, created_at, updated_at)
VALUES
    (
        'deck_cosmogenesis',
        'deck',
        'cosmogenesis',
        'Космогенез',
        'Космическая супер-премиум колода: рождение звезд, параллакс галактики и туманности',
        500000,
        'mythic',
        TRUE,
        400,
        NOW(),
        NOW()
    ),
    (
        'deck_hyperdrive',
        'deck',
        'hyperdrive',
        'Гипердрайв',
        'Технологическая супер-премиум колода: скорость света, варп-эффект и гиперпространство',
        500000,
        'mythic',
        TRUE,
        410,
        NOW(),
        NOW()
    ),
    (
        'deck_alchemist',
        'deck',
        'alchemist',
        'Эфирный Алхимик',
        'Алхимическая супер-премиум колода: трансмутация золота, эфирные волны и рунные круги',
        500000,
        'mythic',
        TRUE,
        420,
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
