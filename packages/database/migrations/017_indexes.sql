-- Performance indexes for frequently queried columns
create index if not exists idx_results_round_id on results (round_id);
create index if not exists idx_results_user_id on results (user_id);
create index if not exists idx_registrations_user_id on registrations (user_id);
create index if not exists idx_registrations_competition_id on registrations (competition_id);
create index if not exists idx_round_advancements_round_id on round_advancements (round_id);
create unique index if not exists idx_round_advancements_round_user on round_advancements (round_id, user_id);
create index if not exists idx_practice_sessions_user_id on practice_sessions (user_id);
create index if not exists idx_practice_solves_session_id on practice_solves (session_id);
create index if not exists idx_competition_events_competition_id on competition_events (competition_id);
create index if not exists idx_rounds_competition_event_id on rounds (competition_event_id);
create index if not exists idx_payments_user_id on payments (user_id);
create index if not exists idx_registration_events_registration_id on registration_events (registration_id);
create unique index if not exists idx_users_email on users (email);
create unique index if not exists idx_users_mobile_no on users (mobile_no) where mobile_no is not null;
create unique index if not exists idx_users_cl_id on users (cl_id);
