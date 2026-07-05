-- Add supabase_id column to users for linking Google/OAuth accounts.
-- This avoids changing the PK (which would break FK constraints).
-- On first Google sign-in, the sync route writes the Supabase UUID here.
ALTER TABLE users ADD COLUMN IF NOT EXISTS supabase_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS users_supabase_id_idx ON users (supabase_id) WHERE supabase_id IS NOT NULL;
