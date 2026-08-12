import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/register — register new user account with verified OTP code.
 * Body: { name?: string, email: string, password: string, otpCode: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { name, email, password, otpCode } = await req.json();

    if (!email || !password || !otpCode) {
      return NextResponse.json(
        { error: "Email, password, and OTP verification code are required" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
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
        type: "VERIFY_EMAIL",
        expiresAt: { gte: new Date() },
      },
    });

    if (!validOtp) {
      return NextResponse.json(
        { error: "Invalid or expired OTP verification code" },
        { status: 400 }
      );
    }

    // Check if user with password already exists
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing && existing.passwordHash) {
      return NextResponse.json(
        { error: "An account with this email address already exists. Please sign in." },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const ownerEmail = process.env.OWNER_EMAIL;
    const isOwner = ownerEmail ? normalizedEmail === ownerEmail.toLowerCase() : false;
    const role = isOwner ? "ADMIN" : "USER";

    const user = await prisma.user.upsert({
      where: { email: normalizedEmail },
      update: {
        name: name?.trim() || existing?.name || null,
        passwordHash,
        emailVerified: new Date(),
        role: isOwner ? "ADMIN" : existing?.role || role,
      },
      create: {
        email: normalizedEmail,
        name: name?.trim() || null,
        passwordHash,
        emailVerified: new Date(),
        role,
      },
    });

    // Clean up used OTP code
    await prisma.otpCode.deleteMany({
      where: { email: normalizedEmail, type: "VERIFY_EMAIL" },
    });

    logger.info("User registered successfully", { userId: user.id, email: user.email });

    return NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name },
    });
  } catch (err) {
    logger.error("POST /api/auth/register failed", err);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
