-- Add coupon type and per-user tracking
ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'general';
ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS max_uses_per_user integer NOT NULL DEFAULT 0;

-- Track per-user promo code usage
CREATE TABLE IF NOT EXISTS promo_code_usages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id   uuid NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  used_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (promo_code_id, user_id)
);

-- Also add promo_code_id to payments for reference
ALTER TABLE payments ADD COLUMN IF NOT EXISTS promo_code_id uuid REFERENCES promo_codes(id) ON DELETE SET NULL;
