import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/otp/verify — verify 6-digit OTP code.
 * Body: { email: string, code: string, type: "VERIFY_EMAIL" | "FORGOT_PASSWORD" }
 */
export async function POST(req: NextRequest) {
  try {
    const { email, code, type } = await req.json();

    if (!email || !code || !type) {
      return NextResponse.json(
        { error: "Email, code, and type are required" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    const otpRecord = await prisma.otpCode.findFirst({
      where: {
        email: normalizedEmail,
        code: code.trim(),
        type,
        expiresAt: { gte: new Date() },
      },
    });

    if (!otpRecord) {
      return NextResponse.json(
        { error: "Invalid or expired OTP code" },
        { status: 400 }
      );
    }

    logger.info("OTP Code Verified Successfully", { email: normalizedEmail, type });

    return NextResponse.json({
      success: true,
      message: "OTP code verified successfully",
    });
  } catch (err) {
    logger.error("POST /api/auth/otp/verify failed", err);
    return NextResponse.json({ error: "Failed to verify OTP" }, { status: 500 });
  }
}
