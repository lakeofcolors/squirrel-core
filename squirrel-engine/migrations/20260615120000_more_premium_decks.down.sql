-- Remove more premium animated card decks from store_cosmetics
DELETE FROM store_cosmetics WHERE id IN ('deck_arcane', 'deck_mecha');
