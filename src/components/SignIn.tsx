"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import ThemeToggle from "./ThemeToggle";
import { Button, Spinner } from "./ui";
import {
  BookmarkIcon,
  CloudIcon,
  LogoIcon,
  TagIcon,
  LockIcon,
  SparklesIcon,
} from "./ui/icons";

type AuthTab = "signin" | "signup" | "forgot";

const FEATURES = [
  {
    icon: CloudIcon,
    title: "PostgreSQL & Drive",
    desc: "Metadata in Neon PostgreSQL, PDFs in Drive.",
  },
  {
    icon: BookmarkIcon,
    title: "Read & Track",
    desc: "Progress, bookmarks, highlights & notes.",
  },
  {
    icon: TagIcon,
    title: "AI Assistant & Tutor",
    desc: "Chat with books, RAG, quizzes & flashcards.",
  },
];

export default function SignIn({ initialTab = "signin" }: { initialTab?: AuthTab }) {
  const [tab, setTab] = useState<AuthTab>(initialTab);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form inputs
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);

  const clearState = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setOtpSent(false);
    setOtpCode("");
    setDevOtpHint(null);
  };

  const handleTabChange = (t: AuthTab) => {
    setTab(t);
    clearState();
  };

  // Sign In Handler
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setErrorMsg("Please enter both email and password.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await signIn("credentials", {
        email: email.trim(),
        password: password.trim(),
        redirect: false,
      });

      if (res?.error) {
        setErrorMsg("Invalid email or password.");
      } else {
        window.location.reload();
      }
    } catch {
      setErrorMsg("Sign in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Send OTP Handler for Sign Up / Forgot Password
  const handleSendOtp = async (type: "VERIFY_EMAIL" | "FORGOT_PASSWORD") => {
    if (!email.trim()) {
      setErrorMsg("Please enter your email address.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), type }),
      });

      const d = await res.json();
      if (!res.ok) {
        setErrorMsg(d.error || "Failed to send OTP code.");
      } else {
        setOtpSent(true);
        setSuccessMsg(`OTP code sent to ${email.trim()}`);
        if (d.otpCode) setDevOtpHint(d.otpCode);
      }
    } catch {
      setErrorMsg("Failed to send OTP. Please check your network.");
    } finally {
      setLoading(false);
    }
  };

  // Register Handler
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim() || !otpCode.trim()) {
      setErrorMsg("Email, password, and OTP code are required.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password: password.trim(),
          name: name.trim() || undefined,
          otpCode: otpCode.trim(),
        }),
      });

      const d = await res.json();
      if (!res.ok) {
        setErrorMsg(d.error || "Registration failed.");
      } else {
        // Auto Sign In after successful registration
        await signIn("credentials", {
          email: email.trim(),
          password: password.trim(),
          redirect: false,
        });
        window.location.reload();
      }
    } catch {
      setErrorMsg("Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Reset Password Handler
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim() || !otpCode.trim()) {
      setErrorMsg("Email, new password, and OTP code are required.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          newPassword: password.trim(),
          otpCode: otpCode.trim(),
        }),
      });

      const d = await res.json();
      if (!res.ok) {
        setErrorMsg(d.error || "Password reset failed.");
      } else {
        setSuccessMsg("Password reset successfully! You can now sign in.");
        setTab("signin");
        setOtpSent(false);
        setPassword("");
      }
    } catch {
      setErrorMsg("Password reset failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-8">
      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle />
      </div>

      {/* Animated background */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-50 via-white to-brand-100 dark:from-slate-950 dark:via-slate-950 dark:to-brand-950" />
        <div className="absolute -left-24 top-1/4 h-72 w-72 animate-blob rounded-full bg-brand-300/40 blur-3xl dark:bg-brand-600/20" />
        <div
          className="absolute right-0 top-10 h-80 w-80 animate-blob rounded-full bg-brand-400/30 blur-3xl dark:bg-brand-500/20"
          style={{ animationDelay: "-6s" }}
        />
      </div>

      <div className="mb-6 text-center">
        <div className="mb-3 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-brand-400 text-white shadow-xl shadow-brand-500/30">
          <LogoIcon size={32} />
        </div>
        <h1 className="bg-gradient-to-br from-brand-600 to-brand-400 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent dark:from-brand-300 dark:to-brand-500 sm:text-4xl">
          eBookMine
        </h1>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Your personal eBook library & AI reading engine
        </p>
      </div>

      {/* Auth Card */}
      <div className="w-full max-w-md space-y-4 rounded-3xl border border-slate-200/80 bg-white/90 p-6 shadow-2xl backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-900/90">
        {/* Navigation Tabs */}
        <div className="grid grid-cols-3 gap-1 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800">
          <button
            onClick={() => handleTabChange("signin")}
            className={`rounded-xl py-2 text-xs font-bold transition-all ${
              tab === "signin"
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
                : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => handleTabChange("signup")}
            className={`rounded-xl py-2 text-xs font-bold transition-all ${
              tab === "signup"
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
                : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
            }`}
          >
            Sign Up (OTP)
          </button>
          <button
            onClick={() => handleTabChange("forgot")}
            className={`rounded-xl py-2 text-xs font-bold transition-all ${
              tab === "forgot"
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
                : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
            }`}
          >
            Forgot Password
          </button>
        </div>

        {/* Feedback Messages */}
        {errorMsg && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-600 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
            {successMsg}
          </div>
        )}
        {devOtpHint && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-center text-xs font-bold text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">
            🔑 Dev Verification OTP Code: <span className="font-black underline tracking-widest">{devOtpHint}</span>
          </div>
        )}

        {/* TAB 1: SIGN IN */}
        {tab === "signin" && (
          <form onSubmit={handleSignIn} className="space-y-3 pt-1">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <Button type="submit" className="w-full py-2.5 text-xs" disabled={loading}>
              {loading ? <Spinner size="sm" /> : "Sign In"}
            </Button>
          </form>
        )}

        {/* TAB 2: SIGN UP WITH OTP */}
        {tab === "signup" && (
          <form onSubmit={handleRegister} className="space-y-3 pt-1">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Email Address</label>
              <div className="mt-1 flex gap-2">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => handleSendOtp("VERIFY_EMAIL")}
                  disabled={loading || !email.trim()}
                  className="shrink-0 text-[11px]"
                >
                  {otpSent ? "Resend Code" : "Send OTP"}
                </Button>
              </div>
            </div>

            {otpSent && (
              <div>
                <label className="block text-xs font-semibold text-brand-600 dark:text-brand-400">
                  6-Digit OTP Verification Code
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="123456"
                  className="mt-1 w-full tracking-widest text-center font-mono font-bold rounded-xl border border-brand-300 bg-brand-50/50 p-2.5 text-sm outline-none focus:border-brand-500 dark:border-brand-800 dark:bg-brand-950/40 dark:text-white"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <Button type="submit" className="w-full py-2.5 text-xs" disabled={loading || !otpSent}>
              {loading ? <Spinner size="sm" /> : "Verify OTP & Create Account"}
            </Button>
          </form>
        )}

        {/* TAB 3: FORGOT PASSWORD WITH OTP */}
        {tab === "forgot" && (
          <form onSubmit={handleResetPassword} className="space-y-3 pt-1">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Registered Email</label>
              <div className="mt-1 flex gap-2">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => handleSendOtp("FORGOT_PASSWORD")}
                  disabled={loading || !email.trim()}
                  className="shrink-0 text-[11px]"
                >
                  {otpSent ? "Resend Code" : "Send OTP"}
                </Button>
              </div>
            </div>

            {otpSent && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-brand-600 dark:text-brand-400">
                    6-Digit Reset Code
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="123456"
                    className="mt-1 w-full tracking-widest text-center font-mono font-bold rounded-xl border border-brand-300 bg-brand-50/50 p-2.5 text-sm outline-none focus:border-brand-500 dark:border-brand-800 dark:bg-brand-950/40 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">New Password</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </>
            )}

            <Button type="submit" className="w-full py-2.5 text-xs" disabled={loading || !otpSent}>
              {loading ? <Spinner size="sm" /> : "Verify OTP & Reset Password"}
            </Button>
          </form>
        )}
      </div>

      <div className="mt-8 grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, desc }) => (
          <div
            key={title}
            className="rounded-2xl border border-slate-200/70 bg-white/60 p-4 text-center backdrop-blur dark:border-slate-800 dark:bg-slate-900/60"
          >
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
              <Icon size={20} />
            </div>
            <div className="mt-2 text-xs font-bold">{title}</div>
            <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              {desc}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
