-- Add up migration script here

CREATE TABLE IF NOT EXISTS store_nuts_packs (
    id TEXT PRIMARY KEY,                -- nuts_250
    title TEXT NOT NULL,                -- 250 орехов
    description TEXT,
    xtr_amount BIGINT NOT NULL,         -- цена в XTR
    nuts_amount BIGINT NOT NULL,        -- сколько орехов даёт
    bonus_nuts_amount BIGINT NOT NULL DEFAULT 0,
    is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_store_nuts_packs_is_active
    ON store_nuts_packs (is_active);

CREATE INDEX IF NOT EXISTS idx_store_nuts_packs_sort_order
    ON store_nuts_packs (sort_order);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_store_nuts_packs_featured
    ON store_nuts_packs (is_featured)
    WHERE is_featured = TRUE;


CREATE TABLE IF NOT EXISTS store_cosmetics (
    id TEXT PRIMARY KEY, -- deck_pink / bg_fire
    item_type TEXT NOT NULL CHECK (item_type IN ('deck', 'background')),
    item_key TEXT NOT NULL, -- pink / fire / neon_table / void
    title TEXT NOT NULL,
    description TEXT,
    price_nuts BIGINT NOT NULL,
    rarity TEXT NOT NULL CHECK (rarity IN ('common', 'rare', 'epic', 'legendary', 'mythic')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (item_type, item_key)
);

CREATE INDEX IF NOT EXISTS idx_store_cosmetics_item_type
    ON store_cosmetics (item_type);

CREATE INDEX IF NOT EXISTS idx_store_cosmetics_is_active
    ON store_cosmetics (is_active);

CREATE INDEX IF NOT EXISTS idx_store_cosmetics_sort_order
    ON store_cosmetics (sort_order);


INSERT INTO store_cosmetics
    (id, item_type, item_key, title, description, price_nuts, rarity, is_active, sort_order, created_at, updated_at)
VALUES
    (
        'deck_classic',
        'deck',
        'classic',
        'Классическая',
        'Базовая колода',
        0,
        'common',
        TRUE,
        100,
        NOW(),
        NOW()
    ),
    (
        'deck_neon',
        'deck',
        'neon',
        'Неоновая',
        'Неоновая колода',
        250,
        'common',
        TRUE,
        110,
        NOW(),
        NOW()
    ),
    (
        'deck_cyber',
        'deck',
        'cyber',
        'Кибер',
        'Кибер-колода',
        500,
        'rare',
        TRUE,
        120,
        NOW(),
        NOW()
    ),
    (
        'deck_forest',
        'deck',
        'forest',
        'Лесная',
        'Лесная колода',
        900,
        'epic',
        TRUE,
        130,
        NOW(),
        NOW()
    ),
    (
        'deck_gold',
        'deck',
        'gold',
        'Золотая',
        'Золотая колода',
        1100,
        'legendary',
        TRUE,
        140,
        NOW(),
        NOW()
    ),
    (
        'deck_void',
        'deck',
        'void',
        'Пустота',
        'Мистическая колода',
        3500,
        'mythic',
        TRUE,
        150,
        NOW(),
        NOW()
    ),
    (
        'deck_pink',
        'deck',
        'pink',
        'Розовый',
        'Розовая колода',
        3000,
        'mythic',
        TRUE,
        160,
        NOW(),
        NOW()
    ),

    (
        'bg_neon',
        'background',
        'neon',
        'Неон',
        'Неоновый фон',
        0,
        'common',
        TRUE,
        200,
        NOW(),
        NOW()
    ),
    (
        'bg_forest',
        'background',
        'forest',
        'Лес',
        'Лесной фон',
        300,
        'rare',
        TRUE,
        210,
        NOW(),
        NOW()
    ),
    (
        'bg_void',
        'background',
        'void',
        'Пустота',
        'Фон пустоты',
        550,
        'epic',
        TRUE,
        220,
        NOW(),
        NOW()
    ),
    (
        'bg_fire',
        'background',
        'fire',
        'Огонь',
        'Огненный фон',
        800,
        'legendary',
        TRUE,
        230,
        NOW(),
        NOW()
    ),
    (
        'bg_neon_table',
        'background',
        'neon_table',
        'Неоновый стол',
        'Фон неонового стола',
        650,
        'rare',
        TRUE,
        240,
        NOW(),
        NOW()
    ),
    (
        'bg_pink',
        'background',
        'pink',
        'Розовый стол',
        'Розовый фон стола',
        700,
        'epic',
        TRUE,
        250,
        NOW(),
        NOW()
    ),
    (
        'bg_pool',
        'background',
        'pool',
        'Бассейн',
        'Фон бассейна',
        900,
        'legendary',
        TRUE,
        260,
        NOW(),
        NOW()
    ),
    (
        'bg_rug',
        'background',
        'rug',
        'Ковровый стол',
        'Фон коврового стола',
        1000,
        'epic',
        TRUE,
        270,
        NOW(),
        NOW()
    ),
    (
        'bg_kz',
        'background',
        'kz',
        'KZ',
        'Традиционный',
        1200,
        'mythic',
        TRUE,
        280,
        NOW(),
        NOW()
    )
ON CONFLICT (id) DO UPDATE SET
    item_type = EXCLUDED.item_type,
    item_key = EXCLUDED.item_key,
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    price_nuts = EXCLUDED.price_nuts,
    rarity = EXCLUDED.rarity,
    is_active = EXCLUDED.is_active,
    sort_order = EXCLUDED.sort_order,
    updated_at = NOW();


INSERT INTO store_nuts_packs
    (id, title, description, xtr_amount, nuts_amount, bonus_nuts_amount, is_featured, is_active, sort_order, created_at, updated_at)
VALUES
    (
        'nuts_250',
        '250 орехов',
        'Стартовый пакет орехов',
        80,
        250,
        0,
        FALSE,
        TRUE,
        10,
        NOW(),
        NOW()
    ),
    (
        'nuts_700',
        '700 орехов',
        'Средний пакет орехов с бонусом',
        199,
        700,
        50,
        FALSE,
        TRUE,
        20,
        NOW(),
        NOW()
    ),
    (
        'nuts_1500',
        '1500 орехов',
        'Популярный пакет орехов',
        350,
        1500,
        200,
        TRUE,
        TRUE,
        30,
        NOW(),
        NOW()
    ),
    (
        'nuts_4000',
        '4000 орехов',
        'Большой пакет орехов с максимальной выгодой',
        900,
        4000,
        500,
        FALSE,
        TRUE,
        40,
        NOW(),
        NOW()
    )
ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    xtr_amount = EXCLUDED.xtr_amount,
    nuts_amount = EXCLUDED.nuts_amount,
    bonus_nuts_amount = EXCLUDED.bonus_nuts_amount,
    is_featured = EXCLUDED.is_featured,
    is_active = EXCLUDED.is_active,
    sort_order = EXCLUDED.sort_order,
    updated_at = NOW();
