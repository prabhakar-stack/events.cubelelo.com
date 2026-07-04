-- Migration 021: Add penalty column to daily_challenge_results
ALTER TABLE daily_challenge_results ADD COLUMN IF NOT EXISTS penalty text NOT NULL DEFAULT 'none';
