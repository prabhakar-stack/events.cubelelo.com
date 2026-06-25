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
 * Production: verify Supabase's RS256 JWT against its remote JWKS (keys cached
 * in-process, no DB round-trip). Dev: verify an HS256 token minted by
 * /auth/dev-login so the full auth flow works without Supabase.
 */
export function createVerifier(): Verifier {
  if (env.authMode === "supabase") {
    const jwks = createRemoteJWKSet(new URL(env.SUPABASE_JWKS_URL));
    return {
      mode: "supabase",
      async verify(token) {
        const { payload } = await jwtVerify(token, jwks);
        return toClaims(payload);
      },
    };
  }

  const secret = new TextEncoder().encode(env.DEV_AUTH_SECRET);
  return {
    mode: "dev",
    async verify(token) {
      const { payload } = await jwtVerify(token, secret);
      return toClaims(payload);
    },
  };
}
