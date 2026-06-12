-- Add up migration script here
ALTER TABLE users
ADD COLUMN photo_url TEXT;
