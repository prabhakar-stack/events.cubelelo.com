-- Allow users to register with only a mobile number (no email).
-- Drop the old unique-and-not-null constraint, make the column nullable,
-- and add a partial unique index so that non-null emails are still unique.
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
ALTER TABLE users ALTER COLUMN email SET DEFAULT NULL;

-- Replace the simple UNIQUE constraint with a partial unique index
-- that ignores NULL values (multiple mobile-only users can have NULL email).
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (email) WHERE email IS NOT NULL;
