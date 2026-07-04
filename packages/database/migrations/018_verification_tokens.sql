-- Move in-memory OTP and email token stores to the database
create table if not exists verification_tokens (
  id uuid primary key,
  user_id uuid not null references users(id),
  type text not null, -- 'verify', 'reset', 'otp_email', 'otp_mobile'
  token text not null,
  identifier text, -- email or mobile number for OTP lookups
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_verification_tokens_token on verification_tokens (token);
create index if not exists idx_verification_tokens_identifier on verification_tokens (identifier, type);
create index if not exists idx_verification_tokens_expires on verification_tokens (expires_at);
