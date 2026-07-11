-- Prevent duplicate result submissions for the same user in a round
DO $$ BEGIN
  ALTER TABLE results
    ADD CONSTRAINT results_round_user_unique UNIQUE (round_id, user_id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;

-- Prevent duplicate daily challenge submissions
DO $$ BEGIN
  ALTER TABLE daily_challenge_results
    ADD CONSTRAINT daily_challenge_results_user_challenge_unique UNIQUE (challenge_id, user_id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
