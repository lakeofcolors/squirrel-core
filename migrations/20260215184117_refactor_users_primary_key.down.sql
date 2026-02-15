-- Add down migration script here
ALTER TABLE users
ALTER COLUMN rating SET DEFAULT 0;

ALTER TABLE users
ADD COLUMN id SERIAL;

ALTER TABLE users
DROP CONSTRAINT users_pkey;

ALTER TABLE users
ADD PRIMARY KEY (id);

ALTER TABLE users
ALTER COLUMN telegram_id TYPE TEXT
USING telegram_id::text;
