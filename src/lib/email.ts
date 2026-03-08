import nodemailer from "nodemailer";
import { Resend } from "resend";

export type SendEmailOptions = {
  to: string;
  subject: string;
  html: string;
  fromName?: string;
};

/** Uses Gmail if GMAIL_USER + GMAIL_APP_PASSWORD are set; otherwise Resend if RESEND_API_KEY is set. */
export async function sendEmail(options: SendEmailOptions): Promise<{ ok: true; id?: string } | { ok: false; error: string }> {
  const { to, subject, html, fromName = "BAP FDU" } = options;

  const gmailUser = process.env.GMAIL_USER;
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;

  if (gmailUser && gmailAppPassword) {
    console.log("[email] Using Gmail; sending to", to);
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user: gmailUser,
        pass: gmailAppPassword,
      },
    });
    try {
      const info = await transporter.sendMail({
        from: `"${fromName}" <${gmailUser}>`,
        to,
        subject,
        html,
      });
      return { ok: true, id: info.messageId };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[email] Gmail send failed:", message);
      return { ok: false, error: message };
    }
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    const from = process.env.RESEND_FROM_EMAIL ?? `${fromName} <onboarding@resend.dev>`;
    console.log("[email] Using Resend; from:", from, "to:", to);
    const resend = new Resend(resendKey);
    const { data, error } = await resend.emails.send({ from, to, subject, html });
    if (error) {
      console.error("[email] Resend send failed:", error.message);
      return { ok: false, error: error.message };
    }
    console.log("[email] Resend sent ok, id:", data?.id);
    return { ok: true, id: data?.id ?? undefined };
  }

  console.error("[email] No provider configured (no Gmail credentials and no RESEND_API_KEY)");
  return { ok: false, error: "No email configured. Set GMAIL_USER + GMAIL_APP_PASSWORD or RESEND_API_KEY." };
}

export function isEmailConfigured(): boolean {
  return !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) || !!process.env.RESEND_API_KEY;
}
