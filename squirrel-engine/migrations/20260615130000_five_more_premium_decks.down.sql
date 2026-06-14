-- Remove 5 more premium animated card decks from store_cosmetics
DELETE FROM store_cosmetics WHERE id IN ('deck_synthwave', 'deck_egypt', 'deck_singularity', 'deck_glacier', 'deck_biohazard');
