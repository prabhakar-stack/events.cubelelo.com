function jwksUrl(): string {
  // Explicit override always wins.
  if (process.env.SUPABASE_JWKS_URL) return process.env.SUPABASE_JWKS_URL;
  // Auto-derive only in production — local dev stays in HS256 mode even when
  // SUPABASE_URL is set (e.g. solely for the database connection string).
  if (process.env.SUPABASE_URL && process.env.NODE_ENV === "production") {
    return `${process.env.SUPABASE_URL.replace(/\/$/, "")}/auth/v1/.well-known/jwks.json`;
  }
  return "";
}

const SUPABASE_JWKS_URL = jwksUrl();

export const env = {
  PORT: Number(process.env.PORT ?? 4000),
  HOST: process.env.HOST ?? "0.0.0.0",
  DATABASE_URL: process.env.DATABASE_URL ?? "",
  REDIS_URL: process.env.REDIS_URL ?? "",
  SUPABASE_URL: process.env.SUPABASE_URL ?? "",
  SUPABASE_JWKS_URL,
  /** HS256 secret for the local dev sign-in path (no Supabase needed). */
  DEV_AUTH_SECRET: process.env.DEV_AUTH_SECRET ?? "dev-secret-change-me",
  /** "supabase" once a JWKS URL is configured, otherwise the dev fallback. */
  authMode: (SUPABASE_JWKS_URL ? "supabase" : "dev") as "supabase" | "dev",
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID ?? "",
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET ?? "",
  RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET ?? "",
  WCA_API_BASE: process.env.WCA_API_BASE ?? "https://www.worldcubeassociation.org/api/v0",
  RESEND_API_KEY: process.env.RESEND_API_KEY ?? "",
  EMAIL_FROM: process.env.EMAIL_FROM ?? "Cubelelo Events <noreply@cubelelo.com>",
  APP_URL: process.env.APP_URL ?? "http://localhost:3000",
  R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID ?? "",
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID ?? "",
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY ?? "",
  R2_BUCKET: process.env.R2_BUCKET ?? "",
  R2_PUBLIC_URL: process.env.R2_PUBLIC_URL ?? "",
};
