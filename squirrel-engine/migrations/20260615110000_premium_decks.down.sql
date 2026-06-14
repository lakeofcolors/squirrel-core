-- Remove premium animated card decks from store_cosmetics
DELETE FROM store_cosmetics WHERE id IN ('deck_cosmic', 'deck_magma', 'deck_matrix');
