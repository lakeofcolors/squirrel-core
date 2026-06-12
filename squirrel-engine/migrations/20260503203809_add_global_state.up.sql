CREATE TABLE IF NOT EXISTS global_state (
    key TEXT PRIMARY KEY,
    value BIGINT NOT NULL
);

INSERT INTO global_state (key, value) VALUES ('slots_jackpot', 100000) ON CONFLICT DO NOTHING;
