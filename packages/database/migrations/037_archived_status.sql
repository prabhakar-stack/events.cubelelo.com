ALTER TABLE competition_events ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;
