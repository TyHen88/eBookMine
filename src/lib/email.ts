import nodemailer from "nodemailer";
import { logger } from "@/lib/logger";

interface SendOtpParams {
  to: string;
  code: string;
  type: "VERIFY_EMAIL" | "FORGOT_PASSWORD";
}

/**
 * Send 6-digit OTP Verification code via SMTP email (or server log fallback if SMTP is not configured).
 */
export async function sendOtpEmail({ to, code, type }: SendOtpParams): Promise<{ sent: boolean; mode: "smtp" | "console" }> {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const secure = process.env.SMTP_SECURE === "true";
  const from = process.env.SMTP_FROM?.trim() || "eBookMine <noreply@ebookmine.app>";

  const isConfigured = Boolean(host && user && pass);

  if (!isConfigured) {
    logger.info("SMTP email credentials not set. Logging OTP code to server logs.", { to, type, code });
    console.log(`\n========================================`);
    console.log(`🔑 eBookMine OTP Code for [${to}] (${type}): ${code}`);
    console.log(`========================================\n`);
    return { sent: true, mode: "console" };
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
    });

    const isReset = type === "FORGOT_PASSWORD";
    const subject = isReset
      ? `🔑 ${code} — Your eBookMine Password Reset Code`
      : `✨ ${code} — Your eBookMine Verification Code`;

    const title = isReset ? "Password Reset Request" : "Verify Your Email Address";
    const description = isReset
      ? "We received a request to reset your eBookMine account password. Use the 6-digit code below to set a new password."
      : "Thank you for joining eBookMine! Use the 6-digit code below to complete your registration.";

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #0f172a; margin: 0; padding: 32px 16px;">
        <div style="max-width: 480px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 24px; padding: 32px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05);">
          
          <!-- Header Logo -->
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="display: inline-block; width: 48px; height: 48px; background: linear-gradient(135deg, #4f46e5, #6366f1); border-radius: 16px; line-height: 48px; color: #ffffff; font-weight: 800; font-size: 24px;">
              📚
            </div>
            <h1 style="font-size: 22px; font-weight: 800; color: #4f46e5; margin: 12px 0 4px 0; tracking: -0.5px;">eBookMine</h1>
            <p style="font-size: 13px; color: #64748b; margin: 0;">Personal eBook Library & AI Assistant</p>
          </div>

          <!-- Body Title -->
          <h2 style="font-size: 16px; font-weight: 700; color: #1e293b; margin: 0 0 8px 0; text-align: center;">${title}</h2>
          <p style="font-size: 13px; color: #475569; line-height: 1.5; text-align: center; margin: 0 0 24px 0;">${description}</p>

          <!-- OTP Code Box -->
          <div style="background-color: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 16px; padding: 20px; text-align: center; margin-bottom: 24px;">
            <span style="font-family: 'Courier New', Courier, monospace; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #4f46e5;">${code}</span>
            <p style="font-size: 11px; font-weight: 600; color: #64748b; margin: 8px 0 0 0;">(This code expires in 10 minutes)</p>
          </div>

          <p style="font-size: 12px; color: #94a3b8; line-height: 1.5; text-align: center; margin: 0;">
            If you did not request this verification code, please ignore this email.
          </p>

          <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0 16px 0;" />

          <p style="font-size: 11px; color: #cbd5e1; text-align: center; margin: 0;">
            © ${new Date().getFullYear()} eBookMine • All rights reserved.
          </p>
        </div>
      </body>
      </html>
    `;

    await transporter.sendMail({
      from,
      to,
      subject,
      html,
    });

    logger.info("OTP verification email sent via SMTP", { to, type });
    return { sent: true, mode: "smtp" };
  } catch (err) {
    logger.error("Failed to send SMTP email, logging fallback OTP to server log", err, { to, type, code });
    console.log(`\n========================================`);
    console.log(`🔑 eBookMine OTP Code for [${to}] (${type}): ${code}`);
    console.log(`========================================\n`);
    return { sent: true, mode: "console" };
  }
}
