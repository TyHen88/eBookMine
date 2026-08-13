"use client";

import { useEffect, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import ThemeToggle from "./ThemeToggle";
import { Button, Spinner } from "./ui";
import { useToast } from "./ui/Toast";
import {
  BookmarkIcon,
  CloudIcon,
  LogoIcon,
  TagIcon,
  LockIcon,
  SparklesIcon,
  GoogleIcon,
  CheckIcon,
  ArrowLeftIcon,
  EyeIcon,
  EyeOffIcon,
} from "./ui/icons";

type AuthTab = "signin" | "signup" | "forgot";

const SHOWCASE_ITEMS = [
  {
    icon: CloudIcon,
    title: "PostgreSQL & Google Drive",
    desc: "Your eBooks stay in your private Google Drive while metadata is synced with Neon PostgreSQL.",
  },
  {
    icon: BookmarkIcon,
    title: "Reading Progress & Highlights",
    desc: "Automatic page tracking, bookmarks, highlights, and note organization across device.",
  },
  {
    icon: SparklesIcon,
    title: "AI RAG Assistant & Tutor",
    desc: "Chat with books using vector search, generate chapter quizzes, and practice flashcards.",
  },
];

export default function SignIn({ initialTab = "signin" }: { initialTab?: AuthTab }) {
  const [tab, setTab] = useState<AuthTab>(initialTab);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Form inputs
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);

  const { status } = useSession();
  const { showToast } = useToast();

  useEffect(() => {
    if (status === "authenticated") {
      window.location.href = "/";
    }
  }, [status]);

  const clearState = () => {
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
      showToast("Please enter both email and password.", "error");
      return;
    }

    setLoading(true);
    try {
      const res = await signIn("credentials", {
        email: email.trim(),
        password: password.trim(),
        redirect: false,
      });

      if (res?.error) {
        showToast("Invalid email or password credentials.", "error");
      } else {
        showToast("Signed in successfully! Redirecting...", "success");
        window.location.href = "/";
      }
    } catch {
      showToast("Sign in failed. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  // Send OTP Handler for Sign Up / Forgot Password
  const handleSendOtp = async (type: "VERIFY_EMAIL" | "FORGOT_PASSWORD") => {
    if (!email.trim()) {
      showToast("Please enter your email address.", "error");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), type }),
      });

      const d = await res.json();
      if (!res.ok) {
        showToast(d.error || "Failed to send verification code.", "error");
      } else {
        setOtpSent(true);
        showToast(`Verification code sent to ${email.trim()} 📬`, "success");
        if (d.otpCode) setDevOtpHint(d.otpCode);
      }
    } catch {
      showToast("Failed to send OTP code. Network error.", "error");
    } finally {
      setLoading(false);
    }
  };

  // Register Handler
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim() || !otpCode.trim()) {
      showToast("Email, password, and 6-digit OTP code are required.", "error");
      return;
    }

    setLoading(true);
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
        showToast(d.error || "Registration failed.", "error");
      } else {
        showToast("Account created successfully! Logging you in...", "success");
        await signIn("credentials", {
          email: email.trim(),
          password: password.trim(),
          redirect: false,
        });
        window.location.href = "/";
      }
    } catch {
      showToast("Registration failed. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  // Reset Password Handler
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim() || !otpCode.trim()) {
      showToast("Email, new password, and 6-digit OTP code are required.", "error");
      return;
    }

    setLoading(true);
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
        showToast(d.error || "Password reset failed.", "error");
      } else {
        showToast("Password reset successfully! You can now sign in.", "success");
        setTab("signin");
        setOtpSent(false);
        setPassword("");
      }
    } catch {
      showToast("Password reset failed. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center p-4 sm:p-6 md:p-10 overflow-hidden">
      {/* Theme Toggle Top Bar */}
      <div className="absolute right-6 top-6 z-20">
        <ThemeToggle />
      </div>

      {/* Ambient Gradient Background Canvas */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-brand-50/40 to-indigo-100/50 dark:from-slate-950 dark:via-slate-950 dark:to-brand-950/60" />
        <div className="absolute -left-32 top-1/4 h-96 w-96 animate-blob rounded-full bg-brand-400/20 blur-3xl dark:bg-brand-600/15" />
        <div
          className="absolute -right-32 bottom-1/4 h-96 w-96 animate-blob rounded-full bg-indigo-500/20 blur-3xl dark:bg-indigo-600/15"
          style={{ animationDelay: "-5s" }}
        />
      </div>

      {/* Main Glassmorphic Auth Container Card */}
      <div className="w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200/80 bg-white/80 shadow-2xl backdrop-blur-2xl dark:border-slate-800/80 dark:bg-slate-900/80 grid grid-cols-1 md:grid-cols-12">
        {/* Left Side: Creative Brand Showcase Panel */}
        <div className="relative hidden md:flex md:col-span-5 flex-col justify-between p-8 bg-gradient-to-br from-brand-600 via-brand-500 to-indigo-700 text-white overflow-hidden">
          <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-2xl pointer-events-none" />
          <div className="absolute -left-16 -bottom-16 h-64 w-64 rounded-full bg-indigo-400/20 blur-2xl pointer-events-none" />

          {/* Header */}
          <div className="relative z-10">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/20 shadow-inner backdrop-blur-md ring-1 ring-white/30">
                <LogoIcon size={24} />
              </div>
              <div>
                <span className="text-xl font-black tracking-tight text-white">eBookMine</span>
                <span className="block text-[10px] font-medium text-brand-100">Personal AI Library Engine</span>
              </div>
            </div>

            <div className="mt-10 space-y-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur-md">
                <SparklesIcon size={13} className="text-amber-300" />
                <span>Next-Gen Reading & Study Workspace</span>
              </span>
              <h2 className="text-2xl font-black leading-tight text-white sm:text-3xl">
                Read Deeply. Learn Faster.
              </h2>
            </div>
          </div>

          {/* Feature Rotator Showcase */}
          <div className="relative z-10 my-8 space-y-4">
            {SHOWCASE_ITEMS.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="group flex items-start gap-3 rounded-2xl bg-white/10 p-3.5 backdrop-blur-md ring-1 ring-white/15 transition-all duration-300 hover:bg-white/20 hover:scale-[1.02]"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/20 text-white shadow-sm">
                  <Icon size={18} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">{title}</h4>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-brand-100/90">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Footer Badge */}
          <div className="relative z-10 border-t border-white/15 pt-4 text-[11px] text-brand-100/80 flex items-center justify-between">
            <span>Powered by Next.js & Neon PostgreSQL</span>
            <span>v2.0</span>
          </div>
        </div>

        {/* Right Side: Creative Animated Auth Form (No Tabs) */}
        <div className="md:col-span-7 p-6 sm:p-10 flex flex-col justify-between">
          <div key={tab} className="animate-smooth-switch">
            {/* Header Title */}
            <div className="mb-6">
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                {tab === "signin"
                  ? "Sign In to Your Workspace"
                  : tab === "signup"
                  ? "Create a New Account"
                  : "Reset Account Password"}
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {tab === "signin"
                  ? "Access your personal eBook library, reading goals, and AI tutor"
                  : tab === "signup"
                  ? "Enter your details to receive a 6-digit email verification code"
                  : "We'll send a 6-digit OTP code to verify and update your password"}
              </p>
            </div>



            {/* Dev OTP Hint Notice */}
            {devOtpHint && (
              <div className="my-3 rounded-2xl border border-amber-300 bg-amber-50/90 p-3 text-center text-xs font-bold text-amber-800 dark:border-amber-800/80 dark:bg-amber-950/60 dark:text-amber-200">
                🔑 Dev Verification Code: <span className="font-mono text-sm font-black underline tracking-widest">{devOtpHint}</span>
              </div>
            )}

            {/* FORM 1: SIGN IN */}
            {tab === "signin" && (
              <form onSubmit={handleSignIn} className="space-y-4 mt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="mt-1.5 w-full rounded-2xl border border-slate-200/90 bg-slate-50/50 p-3 text-xs outline-none transition-colors focus:border-brand-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800/50 dark:text-white dark:focus:border-brand-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => handleTabChange("forgot")}
                      className="text-[11px] font-bold text-brand-600 hover:underline dark:text-brand-400"
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <div className="relative mt-1.5">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-2xl border border-slate-200/90 bg-slate-50/50 p-3 pr-10 text-xs outline-none transition-colors focus:border-brand-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800/50 dark:text-white dark:focus:border-brand-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      {showPassword ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full py-3 text-xs font-extrabold rounded-2xl shadow-md shadow-brand-500/25"
                  disabled={loading}
                >
                  {loading ? <Spinner size="sm" /> : "Sign In to Workspace"}
                </Button>
              </form>
            )}

            {/* FORM 2: SIGN UP WITH OTP */}
            {tab === "signup" && (
              <form onSubmit={handleRegister} className="space-y-4 mt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Doe"
                    className="mt-1.5 w-full rounded-2xl border border-slate-200/90 bg-slate-50/50 p-3 text-xs outline-none transition-colors focus:border-brand-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800/50 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Email Address
                  </label>
                  <div className="mt-1.5 flex gap-2">
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full rounded-2xl border border-slate-200/90 bg-slate-50/50 p-3 text-xs outline-none transition-colors focus:border-brand-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800/50 dark:text-white"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => handleSendOtp("VERIFY_EMAIL")}
                      disabled={loading || !email.trim()}
                      className="shrink-0 rounded-2xl text-[11px] font-bold px-3.5"
                    >
                      {otpSent ? "Resend OTP" : "Send OTP"}
                    </Button>
                  </div>
                </div>

                {otpSent && (
                  <div>
                    <label className="block text-xs font-bold text-brand-600 dark:text-brand-400">
                      6-Digit OTP Verification Code
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      placeholder="123456"
                      className="mt-1.5 w-full tracking-widest text-center font-mono font-black rounded-2xl border border-brand-300 bg-brand-50/50 p-3 text-base outline-none focus:border-brand-500 dark:border-brand-800 dark:bg-brand-950/40 dark:text-white"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="mt-1.5 w-full rounded-2xl border border-slate-200/90 bg-slate-50/50 p-3 text-xs outline-none transition-colors focus:border-brand-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800/50 dark:text-white"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full py-3 text-xs font-extrabold rounded-2xl shadow-md shadow-brand-500/25"
                  disabled={loading || !otpSent}
                >
                  {loading ? <Spinner size="sm" /> : "Verify OTP & Create Account"}
                </Button>
              </form>
            )}

            {/* FORM 3: FORGOT PASSWORD WITH OTP */}
            {tab === "forgot" && (
              <form onSubmit={handleResetPassword} className="space-y-4 mt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Registered Email Address
                  </label>
                  <div className="mt-1.5 flex gap-2">
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full rounded-2xl border border-slate-200/90 bg-slate-50/50 p-3 text-xs outline-none transition-colors focus:border-brand-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800/50 dark:text-white"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => handleSendOtp("FORGOT_PASSWORD")}
                      disabled={loading || !email.trim()}
                      className="shrink-0 rounded-2xl text-[11px] font-bold px-3.5"
                    >
                      {otpSent ? "Resend OTP" : "Send OTP"}
                    </Button>
                  </div>
                </div>

                {otpSent && (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-brand-600 dark:text-brand-400">
                        6-Digit Password Reset OTP Code
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={6}
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value)}
                        placeholder="123456"
                        className="mt-1.5 w-full tracking-widest text-center font-mono font-black rounded-2xl border border-brand-300 bg-brand-50/50 p-3 text-base outline-none focus:border-brand-500 dark:border-brand-800 dark:bg-brand-950/40 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                        New Password
                      </label>
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter new password"
                        className="mt-1.5 w-full rounded-2xl border border-slate-200/90 bg-slate-50/50 p-3 text-xs outline-none transition-colors focus:border-brand-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800/50 dark:text-white"
                      />
                    </div>
                  </>
                )}

                <Button
                  type="submit"
                  className="w-full py-3 text-xs font-extrabold rounded-2xl shadow-md shadow-brand-500/25"
                  disabled={loading || !otpSent}
                >
                  {loading ? <Spinner size="sm" /> : "Verify OTP & Reset Password"}
                </Button>
              </form>
            )}
          </div>

          {/* Seamless Contextual Switcher Links (No Tabs) */}
          <div className="mt-8 text-center text-xs text-slate-500 dark:text-slate-400 pt-4 border-t border-slate-100 dark:border-slate-800">
            {tab === "signin" ? (
              <div className="space-y-2">
                <p>
                  Don&apos;t have an account yet?{" "}
                  <button
                    type="button"
                    onClick={() => handleTabChange("signup")}
                    className="font-extrabold text-brand-600 hover:underline dark:text-brand-400 transition-all hover:scale-105"
                  >
                    Create a Free Account
                  </button>
                </p>
              </div>
            ) : tab === "signup" ? (
              <p>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => handleTabChange("signin")}
                  className="font-extrabold text-brand-600 hover:underline dark:text-brand-400 transition-all hover:scale-105"
                >
                  Sign In to Workspace
                </button>
              </p>
            ) : (
              <p>
                Remembered your password?{" "}
                <button
                  type="button"
                  onClick={() => handleTabChange("signin")}
                  className="font-extrabold text-brand-600 hover:underline dark:text-brand-400 transition-all hover:scale-105"
                >
                  Back to Sign In
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
