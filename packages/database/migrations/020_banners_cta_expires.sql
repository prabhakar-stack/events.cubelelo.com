-- Migration 020: Add cta_text and expires_at to banners
ALTER TABLE banners ADD COLUMN IF NOT EXISTS cta_text text;
ALTER TABLE banners ADD COLUMN IF NOT EXISTS expires_at timestamptz;
