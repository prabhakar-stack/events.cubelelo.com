-- Add imageUrl and redirectUrl to announcements
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS redirect_url TEXT;

-- Add duration_minutes to rounds for auto-computing closesAt
ALTER TABLE rounds ADD COLUMN IF NOT EXISTS duration_minutes INTEGER;
