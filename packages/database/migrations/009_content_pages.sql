CREATE TABLE IF NOT EXISTS content_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  body_md TEXT NOT NULL DEFAULT '',
  published BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed default footer pages
INSERT INTO content_pages (id, slug, title, body_md, published) VALUES
  (gen_random_uuid(), 'about-us', 'About Us', '', false),
  (gen_random_uuid(), 'rules', 'Rules', '', false),
  (gen_random_uuid(), 'faqs', 'FAQs', '', false),
  (gen_random_uuid(), 'privacy-policy', 'Privacy Policy', '', false),
  (gen_random_uuid(), 'contact-us', 'Contact Us', '', false)
ON CONFLICT (slug) DO NOTHING;
