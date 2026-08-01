CREATE UNIQUE INDEX IF NOT EXISTS competitions_title_unique
  ON competitions (lower(title))
  WHERE status <> 'cancelled';
