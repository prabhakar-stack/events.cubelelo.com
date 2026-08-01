CREATE TABLE IF NOT EXISTS rule_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS rule_sets_name_unique ON rule_sets (lower(name));

ALTER TABLE competitions ADD COLUMN IF NOT EXISTS rule_set_id uuid REFERENCES rule_sets(id);
