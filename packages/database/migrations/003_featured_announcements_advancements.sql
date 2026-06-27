-- Migration 003: Featured competitions, announcements, round advancements

-- ── featured flag on competitions ────────────────────────────────────────────
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS featured       boolean not null default false;
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS featured_order integer;
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS cover_caption  text;

-- ── announcements ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS announcements (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  body_md     text not null,
  pinned      boolean not null default false,
  published   boolean not null default false,
  created_by  uuid references users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── round advancements (shortlisted participants for next round) ───────────────
CREATE TABLE IF NOT EXISTS round_advancements (
  round_id  uuid not null references rounds(id) on delete cascade,
  user_id   uuid not null references users(id) on delete cascade,
  rank      integer not null,
  primary key (round_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_announcements_published ON announcements (published, pinned);
CREATE INDEX IF NOT EXISTS idx_round_advancements      ON round_advancements (round_id);
