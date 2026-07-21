-- Compound indexes for hot-path queries at 1K concurrent users
CREATE INDEX IF NOT EXISTS idx_registrations_user_comp
  ON registrations (user_id, competition_id);

CREATE INDEX IF NOT EXISTS idx_results_round_user
  ON results (round_id, user_id);
