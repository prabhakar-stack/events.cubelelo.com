CREATE TABLE IF NOT EXISTS system_settings (
  id text PRIMARY KEY DEFAULT 'default',
  data jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO system_settings (id, data)
VALUES ('default', '{
  "eventDurations": {
    "222": 15, "333": 20, "444": 25, "555": 30,
    "666": 35, "777": 40,
    "pyram": 15, "skewb": 15, "minx": 30,
    "333oh": 20, "333bf": 25, "sq1": 20,
    "clock": 15, "444bf": 40, "555bf": 50,
    "333mbf": 60, "fto": 25, "333fm": 60
  },
  "registrationDurationDays": 5,
  "gapBetweenEventsMinutes": 0,
  "defaultRoundDurationMinutes": 20,
  "videoDeadlineMinutes": 1440
}')
ON CONFLICT (id) DO NOTHING;
