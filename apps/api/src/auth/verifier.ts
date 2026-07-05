import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { env } from "../config/env";

export interface AuthClaims {
  sub: string;
  email?: string;
  phone?: string;
  name?: string;
  jti?: string;
  exp?: number;
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
    phone: typeof payload.phone === "string" && payload.phone ? payload.phone : undefined,
    name:
      meta.name ??
      meta.full_name ??
      (typeof payload.name === "string" ? payload.name : undefined),
    jti: typeof payload.jti === "string" ? payload.jti : undefined,
    exp: typeof payload.exp === "number" ? payload.exp : undefined,
  };
}

/**
 * Production: verify Supabase's ES256 JWT against its remote JWKS.
 * Development: when Supabase is configured, accept both HS256 dev tokens AND
 * real Supabase tokens so you can use dev-login without touching .env.
 * No Supabase: HS256 dev tokens only.
 */
export function createVerifier(): Verifier {
  const devSecret = new TextEncoder().encode(env.DEV_AUTH_SECRET);
  const supabaseSecret = env.SUPABASE_JWT_SECRET
    ? new TextEncoder().encode(env.SUPABASE_JWT_SECRET)
    : null;

  if (env.authMode === "supabase") {
    const jwks = createRemoteJWKSet(new URL(env.SUPABASE_JWKS_URL));

    // Verification order:
    // 1. Supabase HS256 (Google OAuth, email/password via Supabase) — uses Supabase JWT secret
    // 2. Local dev HS256 (email/password via local auth route)
    // 3. ES256 JWKS (Supabase uses ECDSA P-256)
    return {
      mode: "supabase",
      async verify(token) {
        // Try Supabase's own JWT secret first (handles Google OAuth tokens)
        if (supabaseSecret) {
          try {
            const { payload } = await jwtVerify(token, supabaseSecret, { algorithms: ["HS256"] });
            return toClaims(payload);
          } catch { /* not a Supabase HS256 token */ }
        }
        // Try local dev HS256 secret
        try {
          const { payload } = await jwtVerify(token, devSecret, { algorithms: ["HS256"] });
          return toClaims(payload);
        } catch { /* not a dev HS256 token */ }
        // Fall back to JWKS (Supabase uses ES256 / ECDSA P-256)
        const { payload } = await jwtVerify(token, jwks, { algorithms: ["ES256"] });
        return toClaims(payload);
      },
    };
  }

  return {
    mode: "dev",
    async verify(token) {
      const { payload } = await jwtVerify(token, devSecret, { algorithms: ["HS256"] });
      return toClaims(payload);
    },
  };
}
