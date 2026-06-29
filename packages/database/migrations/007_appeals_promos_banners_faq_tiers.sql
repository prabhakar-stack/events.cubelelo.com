-- Migration 007: Create tables for appeals, promo_codes, rank_tiers, banners, faq_entries
-- Also adds email_verified and profile_privacy to users.

-- ── users columns ────────────────────────────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified   boolean not null default false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_privacy  text not null default 'public';

-- ── appeals ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS appeals (
  id             uuid primary key default gen_random_uuid(),
  result_id      uuid not null references results(id) on delete cascade,
  user_id        uuid not null references users(id) on delete cascade,
  reason         text not null,
  status         text not null default 'pending',
  admin_response text,
  resolved_by    uuid references users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS idx_appeals_user   ON appeals (user_id);
CREATE INDEX IF NOT EXISTS idx_appeals_result ON appeals (result_id);

-- ── rank_tiers ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rank_tiers (
  id          uuid primary key default gen_random_uuid(),
  event_type  text not null,
  name        text not null,
  max_ao5_ms  integer not null,
  color       text not null default '#4f46e5',
  created_at  timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS idx_rank_tiers_event ON rank_tiers (event_type);

-- ── promo_codes ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS promo_codes (
  id              uuid primary key default gen_random_uuid(),
  code            text unique not null,
  discount_type   text not null default 'percentage',
  discount_value  integer not null default 0,
  max_uses        integer,
  used_count      integer not null default 0,
  valid_from      timestamptz,
  valid_until     timestamptz,
  active          boolean not null default true,
  competition_id  uuid references competitions(id) on delete set null,
  created_at      timestamptz not null default now()
);

-- ── banners ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS banners (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  image_url   text not null,
  link_url    text,
  "order"     integer not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ── faq_entries ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS faq_entries (
  id          uuid primary key default gen_random_uuid(),
  question    text not null,
  answer      text not null,
  category    text,
  "order"     integer not null default 0,
  published   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
