import { env } from "../config/env";

interface EmailMessage {
  to: string;
  subject: string;
  html: string;
}

interface EmailService {
  send(msg: EmailMessage): Promise<boolean>;
}

function createResendService(apiKey: string): EmailService {
  return {
    async send(msg) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: env.EMAIL_FROM,
          to: msg.to,
          subject: msg.subject,
          html: msg.html,
        }),
      });
      return res.ok;
    },
  };
}

function createConsoleService(): EmailService {
  return {
    async send(msg) {
      console.log(`[EMAIL] To: ${msg.to} | Subject: ${msg.subject}`);
      return true;
    },
  };
}

export const emailService: EmailService = env.RESEND_API_KEY
  ? createResendService(env.RESEND_API_KEY)
  : createConsoleService();

export function verificationEmail(name: string, token: string): { subject: string; html: string } {
  const link = `${env.APP_URL}/verify-email?token=${token}`;
  return {
    subject: "Verify your Cubelelo Events email",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2>Welcome, ${name}!</h2>
        <p>Please verify your email address to complete your registration.</p>
        <a href="${link}" style="display:inline-block;background:#059669;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Verify Email</a>
        <p style="margin-top:24px;font-size:12px;color:#71717a">If you didn't create an account, you can ignore this email.</p>
        <p style="font-size:12px;color:#71717a">Or copy this link: ${link}</p>
      </div>
    `,
  };
}

export function passwordResetEmail(name: string, token: string): { subject: string; html: string } {
  const link = `${env.APP_URL}/reset-password?token=${token}`;
  return {
    subject: "Reset your Cubelelo Events password",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2>Hi ${name},</h2>
        <p>You requested a password reset. Click below to set a new password. This link expires in 1 hour.</p>
        <a href="${link}" style="display:inline-block;background:#059669;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Reset Password</a>
        <p style="margin-top:24px;font-size:12px;color:#71717a">If you didn't request this, you can ignore this email.</p>
        <p style="font-size:12px;color:#71717a">Or copy this link: ${link}</p>
      </div>
    `,
  };
}

export function roundNotificationEmail(
  name: string,
  competitionTitle: string,
  roundNumber: number,
  action: "opened" | "closing_soon" | "results_published",
): { subject: string; html: string } {
  type Action = typeof action;
  const subjects: Record<Action, string> = {
    opened: `Round ${roundNumber} is now open — ${competitionTitle}`,
    closing_soon: `Round ${roundNumber} closes in 30 min — ${competitionTitle}`,
    results_published: `Results are in — ${competitionTitle} Round ${roundNumber}`,
  };
  const bodies: Record<Action, string> = {
    opened: `<p>Round ${roundNumber} of <strong>${competitionTitle}</strong> is now open! Head over to submit your solves.</p>`,
    closing_soon: `<p>Round ${roundNumber} of <strong>${competitionTitle}</strong> closes in 30 minutes. Don't miss your chance to submit!</p>`,
    results_published: `<p>Results for Round ${roundNumber} of <strong>${competitionTitle}</strong> have been published. Check your ranking!</p>`,
  };
  return {
    subject: subjects[action],
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2>Hi ${name},</h2>
        ${bodies[action]}
        <a href="${env.APP_URL}/competitions" style="display:inline-block;background:#059669;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Go to Competition</a>
        <p style="margin-top:24px;font-size:12px;color:#71717a">You received this because you are registered for ${competitionTitle}.</p>
      </div>
    `,
  };
}

export function migrationEmail(name: string, clId: string): { subject: string; html: string } {
  const link = `${env.APP_URL}/register?migrate=true`;
  return {
    subject: "Your Cubelelo Events account is ready to claim",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2>Hi ${name},</h2>
        <p>Your competition history from the old Cubelelo Events platform has been migrated. Your CL ID is <strong>${clId}</strong>.</p>
        <p>Claim your account to keep your history, personal bests, and rankings.</p>
        <a href="${link}" style="display:inline-block;background:#059669;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Claim My Account</a>
        <p style="margin-top:24px;font-size:12px;color:#71717a">If you don't recognize this, you can ignore this email.</p>
      </div>
    `,
  };
}

export function bulkEmail(
  name: string,
  subject: string,
  bodyHtml: string,
): { subject: string; html: string } {
  return {
    subject,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2>Hi ${name},</h2>
        ${bodyHtml}
        <p style="margin-top:24px;font-size:12px;color:#71717a">You received this from Cubelelo Events.</p>
      </div>
    `,
  };
}
