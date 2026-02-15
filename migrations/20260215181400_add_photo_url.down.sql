-- Add down migration script here
ALTER TABLE users
DROP COLUMN photo_url;
