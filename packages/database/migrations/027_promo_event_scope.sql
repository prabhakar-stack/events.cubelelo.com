ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS competition_event_id uuid REFERENCES competition_events(id) ON DELETE SET NULL;
