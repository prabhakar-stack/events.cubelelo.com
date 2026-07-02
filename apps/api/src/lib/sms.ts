import { env } from "../config/env";

export interface SmsService {
  sendOtp(phone: string, otp: string): Promise<boolean>;
}

function createSupabaseSmsService(): SmsService {
  const supabaseUrl = env.SUPABASE_URL.replace(/\/$/, "");
  const serviceKey = env.SUPABASE_SERVICE_KEY;

  return {
    async sendOtp(phone, otp) {
      // Use Supabase's auth/admin API to send an SMS via the Twilio provider
      // configured in the Supabase dashboard. We send a custom SMS using
      // Twilio's API through the service key.
      const accountSid = env.TWILIO_ACCOUNT_SID;
      const authToken = env.TWILIO_AUTH_TOKEN;
      const from = env.TWILIO_FROM_NUMBER;

      if (!accountSid || !authToken || !from) {
        console.log(`[SMS] To: ${phone} | OTP: ${otp} (no Twilio configured)`);
        return true;
      }

      const messagingSid = env.TWILIO_MESSAGING_SID;

      const params: Record<string, string> = {
        To: phone,
        Body: `Your Cubelelo Events verification code is: ${otp}`,
      };
      if (messagingSid) {
        params.MessagingServiceSid = messagingSid;
      } else {
        params.From = from;
      }

      const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(params).toString(),
      });

      if (!res.ok) {
        const body = await res.text();
        console.error(`[SMS] Twilio send failed (${res.status}): ${body}`);
        return false;
      }
      return true;
    },
  };
}

function createConsoleSmsService(): SmsService {
  return {
    async sendOtp(phone, otp) {
      console.log(`[SMS] To: ${phone} | OTP: ${otp}`);
      return true;
    },
  };
}

export const smsService: SmsService =
  env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM_NUMBER
    ? createSupabaseSmsService()
    : createConsoleSmsService();
