CREATE TABLE IF NOT EXISTS tournament_registrations (
    id SERIAL PRIMARY KEY,
    tournament_id INTEGER REFERENCES tournaments(id) ON DELETE CASCADE,
    clan_id INTEGER REFERENCES clans(id) ON DELETE CASCADE,
    registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tournament_id, clan_id)
);

CREATE TABLE IF NOT EXISTS tournament_squads (
    id SERIAL PRIMARY KEY,
    registration_id INTEGER REFERENCES tournament_registrations(id) ON DELETE CASCADE,
    telegram_id BIGINT REFERENCES users(telegram_id) ON DELETE CASCADE,
    is_substitute BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE(registration_id, telegram_id)
);

CREATE TABLE IF NOT EXISTS tournament_matches (
    id SERIAL PRIMARY KEY,
    tournament_id INTEGER REFERENCES tournaments(id) ON DELETE CASCADE,
    round INTEGER NOT NULL,
    match_index INTEGER NOT NULL,
    clan1_id INTEGER REFERENCES clans(id) ON DELETE SET NULL,
    clan2_id INTEGER REFERENCES clans(id) ON DELETE SET NULL,
    winner_id INTEGER REFERENCES clans(id) ON DELETE SET NULL,
    room_id TEXT,
    UNIQUE(tournament_id, round, match_index)
);
