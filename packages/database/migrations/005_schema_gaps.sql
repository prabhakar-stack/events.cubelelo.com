-- Migration 005: Fill schema gaps from original design

-- ── users ─────────────────────────────────────────────────────────────────────
-- first_name stored separately from display `name` (which holds full/display name)
-- password/token skipped — handled by Supabase Auth
-- active skipped — account_stage enum already covers active/suspended/banned
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS first_name  text,
  ADD COLUMN IF NOT EXISTS facebook    text,
  ADD COLUMN IF NOT EXISTS twitter     text,
  ADD COLUMN IF NOT EXISTS address     text,
  ADD COLUMN IF NOT EXISTS pincode     text,
  ADD COLUMN IF NOT EXISTS raw_json    jsonb;

-- ── competitions ──────────────────────────────────────────────────────────────
ALTER TABLE competitions
  ADD COLUMN IF NOT EXISTS short_name      text,
  ADD COLUMN IF NOT EXISTS verified        boolean not null default false,
  ADD COLUMN IF NOT EXISTS is_reminder_set boolean not null default false,
  ADD COLUMN IF NOT EXISTS raw_json        jsonb;

-- ── competition_events ────────────────────────────────────────────────────────
-- per-event start/end for multi-day competitions where events span different days
ALTER TABLE competition_events
  ADD COLUMN IF NOT EXISTS starts_at   timestamptz,
  ADD COLUMN IF NOT EXISTS ends_at     timestamptz,
  ADD COLUMN IF NOT EXISTS is_verified boolean not null default false,
  ADD COLUMN IF NOT EXISTS raw_json    jsonb,
  ADD COLUMN IF NOT EXISTS updated_at  timestamptz not null default now();

-- ── rounds ────────────────────────────────────────────────────────────────────
ALTER TABLE rounds
  ADD COLUMN IF NOT EXISTS is_verified boolean not null default false,
  ADD COLUMN IF NOT EXISTS updated_at  timestamptz not null default now();

-- ── scramble_sets ─────────────────────────────────────────────────────────────
ALTER TABLE scramble_sets
  ADD COLUMN IF NOT EXISTS updated_at timestamptz not null default now();

-- ── registrations ─────────────────────────────────────────────────────────────
-- payment_ref: Razorpay order/payment reference string
-- transaction_id: gateway transaction ID (can overlap with razorpay_payment_id on payments)
ALTER TABLE registrations
  ADD COLUMN IF NOT EXISTS payment_ref    text,
  ADD COLUMN IF NOT EXISTS transaction_id text,
  ADD COLUMN IF NOT EXISTS updated_at     timestamptz not null default now();
