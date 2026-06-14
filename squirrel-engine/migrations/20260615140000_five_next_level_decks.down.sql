-- Remove 5 next-level premium animated card decks from store_cosmetics
DELETE FROM store_cosmetics WHERE id IN ('deck_celestial', 'deck_cyberpunk', 'deck_abyss', 'deck_chronos', 'deck_inferno');
