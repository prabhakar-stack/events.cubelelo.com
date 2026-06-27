-- Schedule fields for competitions (auto-computed status based on time windows)
ALTER TABLE competitions
  ADD COLUMN IF NOT EXISTS registration_opens_at timestamptz,
  ADD COLUMN IF NOT EXISTS starts_at             timestamptz,
  ADD COLUMN IF NOT EXISTS ends_at               timestamptz;

-- Rounds already have opens_at / closes_at from the initial schema.
-- Nothing to add for rounds.
