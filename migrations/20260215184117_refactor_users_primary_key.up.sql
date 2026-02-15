-- Add up migration script here
ALTER TABLE users
ALTER COLUMN telegram_id TYPE BIGINT
USING telegram_id::bigint;

ALTER TABLE users
DROP CONSTRAINT users_pkey;

ALTER TABLE users
DROP COLUMN id;

ALTER TABLE users
ADD PRIMARY KEY (telegram_id);

ALTER TABLE users
ALTER COLUMN rating SET DEFAULT 100;

UPDATE users
SET rating = 100
WHERE rating = 0;
