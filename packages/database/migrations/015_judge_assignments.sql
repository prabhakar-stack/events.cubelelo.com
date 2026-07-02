-- Judge assignment for verification workflow
create table if not exists judge_assignments (
  id          uuid primary key default gen_random_uuid(),
  judge_id    uuid not null references users(id) on delete cascade,
  round_id    uuid not null references rounds(id) on delete cascade,
  assigned_by uuid not null references users(id),
  assigned_at timestamptz not null default now(),
  unique (judge_id, round_id)
);

create index if not exists idx_judge_assignments_judge on judge_assignments (judge_id);
create index if not exists idx_judge_assignments_round on judge_assignments (round_id);

-- Add verification_comment to results
alter table results add column if not exists verification_comment text;
