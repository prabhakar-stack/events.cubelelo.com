-- Add video upload deadline setting to competitions (minutes after round closes)
alter table competitions add column if not exists video_deadline_minutes integer not null default 1440;

-- Ensure one result per user per round
create unique index if not exists results_round_user_unique on results (round_id, user_id);
