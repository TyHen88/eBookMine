import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/reset-password — reset user password using verified OTP code.
 * Body: { email: string, newPassword: string, otpCode: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { email, newPassword, otpCode } = await req.json();

    if (!email || !newPassword || !otpCode) {
      return NextResponse.json(
        { error: "Email, new password, and OTP code are required" },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters long" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Verify OTP code
    const validOtp = await prisma.otpCode.findFirst({
      where: {
        email: normalizedEmail,
        code: otpCode.trim(),
        type: "FORGOT_PASSWORD",
        expiresAt: { gte: new Date() },
      },
    });

    if (!validOtp) {
      return NextResponse.json(
        { error: "Invalid or expired OTP code" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User account not found" },
        { status: 404 }
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    // Delete used OTP code
    await prisma.otpCode.deleteMany({
      where: { email: normalizedEmail, type: "FORGOT_PASSWORD" },
    });

    logger.info("Password reset successfully", { userId: user.id, email: user.email });

    return NextResponse.json({
      success: true,
      message: "Password reset successfully. You can now sign in with your new password.",
    });
  } catch (err) {
    logger.error("POST /api/auth/reset-password failed", err);
    return NextResponse.json({ error: "Password reset failed" }, { status: 500 });
  }
}
