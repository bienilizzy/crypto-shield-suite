import { env } from "../lib/env.js";

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

// Sends transactional email via Resend's REST API (https://resend.com/docs/api-reference/emails/send-email).
export async function sendEmail({ to, subject, html }: SendEmailParams): Promise<void> {
  if (!env.resendApiKey || !env.alertFromEmail) {
    console.warn("RESEND_API_KEY or ALERT_FROM_EMAIL not configured; skipping email send");
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.alertFromEmail,
      to,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend request failed: ${res.status} ${body}`);
  }
}
