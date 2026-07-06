const KNOWN_MESSAGES: Record<string, string> = {
  invalid_credentials: "That email/mobile or password isn't right. Try again.",
  user_not_found: "We couldn't find an account with that email or mobile number.",
  email_taken: "An account with that email already exists — try signing in instead.",
  mobile_taken: "An account with that mobile number already exists — try signing in instead.",
  invalid_otp: "That code is invalid or expired. Request a new one.",
  otp_expired: "That code has expired. Request a new one.",
  weak_password: "Password must be at least 6 characters.",
  account_suspended: "This account has been suspended. Contact support for help.",
  account_banned: "This account has been banned.",
  already_verified: "This is already verified.",
};

/**
 * Every auth/settings API call throws `Error("<status> <statusText> <jsonBody>")`
 * (see sendJson in lib/api.ts). This turns that raw dump into copy a user can act on,
 * instead of showing "401 Unauthorized {"error":"invalid_credentials"}" verbatim.
 */
export function friendlyAuthError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const statusMatch = raw.match(/^(\d{3})/);
  const status = statusMatch ? Number(statusMatch[1]) : undefined;

  const jsonMatch = raw.match(/\{.*\}$/);
  if (jsonMatch) {
    try {
      const body = JSON.parse(jsonMatch[0]);
      const code: string | undefined = body.error ?? body.code;
      if (code && KNOWN_MESSAGES[code]) return KNOWN_MESSAGES[code];
      if (typeof body.message === "string" && body.message.length < 140) return body.message;
    } catch {
      /* fall through to status-based copy */
    }
  }

  if (status === 401) return "That email/mobile or password isn't right. Try again.";
  if (status === 409) return "That already exists — try signing in instead.";
  if (status === 429) return "Too many attempts. Wait a moment and try again.";
  if (status && status >= 500) return "Something went wrong on our end. Please try again in a moment.";
  return "Something went wrong. Please try again.";
}
