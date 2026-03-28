-- Add up migration script here

ALTER TABLE users
ALTER COLUMN free_coins SET DEFAULT 500
