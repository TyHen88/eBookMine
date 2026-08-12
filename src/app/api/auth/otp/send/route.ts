import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { sendOtpEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/otp/send — generate and send 6-digit OTP code for email verification or password reset via SMTP.
 * Body: { email: string, type: "VERIFY_EMAIL" | "FORGOT_PASSWORD" }
 */
export async function POST(req: NextRequest) {
  try {
    const { email, type } = await req.json();

    if (!email || !type || !["VERIFY_EMAIL", "FORGOT_PASSWORD"].includes(type)) {
      return NextResponse.json(
        { error: "Valid email and type ('VERIFY_EMAIL' or 'FORGOT_PASSWORD') are required" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // For forgot password, check if user exists
    if (type === "FORGOT_PASSWORD") {
      const user = await prisma.user.findUnique({
        where: { email: normalizedEmail },
      });
      if (!user) {
        return NextResponse.json(
          { error: "No account found with this email address" },
          { status: 404 }
        );
      }
    }

    // Generate 6-digit numeric OTP code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Delete existing unexpired codes of same type for this email
    await prisma.otpCode.deleteMany({
      where: { email: normalizedEmail, type },
    });

    // Create new OTP record in PostgreSQL
    await prisma.otpCode.create({
      data: {
        email: normalizedEmail,
        code,
        type,
        expiresAt,
      },
    });

    // Send OTP email via SMTP (or log fallback if SMTP credentials not configured yet)
    const emailResult = await sendOtpEmail({
      to: normalizedEmail,
      code,
      type,
    });

    return NextResponse.json({
      message: `OTP verification code sent to ${normalizedEmail}`,
      deliveryMode: emailResult.mode,
      otpCode: process.env.NODE_ENV === "development" ? code : undefined,
    });
  } catch (err) {
    logger.error("POST /api/auth/otp/send failed", err);
    return NextResponse.json({ error: "Failed to send OTP code" }, { status: 500 });
  }
}
