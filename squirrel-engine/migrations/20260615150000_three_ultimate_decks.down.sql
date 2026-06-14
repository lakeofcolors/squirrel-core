-- Remove 3 ultimate super-premium animated card decks from store_cosmetics
DELETE FROM store_cosmetics WHERE id IN ('deck_cosmogenesis', 'deck_hyperdrive', 'deck_alchemist');
