ALTER TABLE users ADD COLUMN IF NOT EXISTS mobile_verified boolean NOT NULL DEFAULT false;
