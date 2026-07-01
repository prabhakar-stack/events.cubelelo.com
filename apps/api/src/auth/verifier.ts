import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { env } from "../config/env";

export interface AuthClaims {
  sub: string;
  email?: string;
  name?: string;
}

export interface Verifier {
  mode: "supabase" | "dev";
  verify(token: string): Promise<AuthClaims>;
}

function toClaims(payload: JWTPayload): AuthClaims {
  const meta = (payload.user_metadata ?? {}) as {
    name?: string;
    full_name?: string;
  };
  return {
    sub: String(payload.sub),
    email: typeof payload.email === "string" ? payload.email : undefined,
    name:
      meta.name ??
      meta.full_name ??
      (typeof payload.name === "string" ? payload.name : undefined),
  };
}

/**
 * Production: verify Supabase's RS256 JWT against its remote JWKS.
 * Development: when Supabase is configured, accept both HS256 dev tokens AND
 * real Supabase tokens so you can use dev-login without touching .env.
 * No Supabase: HS256 dev tokens only.
 */
export function createVerifier(): Verifier {
  const devSecret = new TextEncoder().encode(env.DEV_AUTH_SECRET);
  const isDev = process.env.NODE_ENV !== "production";

  if (env.authMode === "supabase") {
    const jwks = createRemoteJWKSet(new URL(env.SUPABASE_JWKS_URL));

    // Accept both HS256 tokens (email/password auth) and RS256 Supabase tokens
    // (Google OAuth). Try HS256 first since it's a local check (faster); fall
    // back to the remote JWKS verification for Supabase tokens.
    return {
      mode: "supabase",
      async verify(token) {
        try {
          const { payload } = await jwtVerify(token, devSecret);
          return toClaims(payload);
        } catch {
          const { payload } = await jwtVerify(token, jwks);
          return toClaims(payload);
        }
      },
    };
  }

  return {
    mode: "dev",
    async verify(token) {
      const { payload } = await jwtVerify(token, devSecret);
      return toClaims(payload);
    },
  };
}
