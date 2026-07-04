-- Migration 019: Add resolved_at column to appeals
ALTER TABLE appeals ADD COLUMN IF NOT EXISTS resolved_at timestamptz;
