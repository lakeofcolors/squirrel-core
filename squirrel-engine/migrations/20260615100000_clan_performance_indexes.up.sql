-- Create performance indexes for clans table
CREATE INDEX IF NOT EXISTS idx_clans_owner_id ON clans (owner_id);
CREATE INDEX IF NOT EXISTS idx_clans_rating ON clans (rating DESC);
CREATE INDEX IF NOT EXISTS idx_clans_trophies ON clans (trophies DESC);
