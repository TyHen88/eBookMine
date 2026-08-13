"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button, Spinner } from "./ui";
import { useToast } from "./ui/Toast";
import { LockIcon, XIcon, GoogleIcon } from "./ui/icons";

interface AuthPromptModalProps {
  onClose: () => void;
}

type AuthMode = "signin" | "signup" | "forgot";

export default function AuthPromptModal({ onClose }: AuthPromptModalProps) {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);

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
      showToast("Failed to send OTP code.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await signIn("credentials", {
        email: email.trim(),
        password: password.trim(),
        redirect: false,
      });

      if (res?.error) {
        showToast("Invalid email or password.", "error");
      } else {
        showToast("Signed in successfully!", "success");
        window.location.reload();
      }
    } catch {
      showToast("Sign in failed.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
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
        showToast("Account created successfully!", "success");
        await signIn("credentials", {
          email: email.trim(),
          password: password.trim(),
          redirect: false,
        });
        window.location.reload();
      }
    } catch {
      showToast("Registration failed.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
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
        showToast("Password reset successfully! Please sign in.", "success");
        setMode("signin");
        setOtpSent(false);
        setPassword("");
      }
    } catch {
      showToast("Password reset failed.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        {/* Header Bar */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-tr from-brand-600 to-brand-400 text-white shadow-md">
              <LockIcon size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {mode === "signin" ? "Sign In Required" : mode === "signup" ? "Create Account" : "Reset Password"}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Access your eBookMine library features
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <XIcon size={18} />
          </button>
        </div>



        {devOtpHint && (
          <div className="mb-3 rounded-2xl border border-amber-300 bg-amber-50 p-2.5 text-center text-xs font-bold text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
            🔑 Dev Code: <span className="font-mono underline font-black">{devOtpHint}</span>
          </div>
        )}

        {/* Animated Container (No Tabs) */}
        <div key={mode} className="animate-smooth-switch">
          {mode === "signin" && (
            <form onSubmit={handleSignIn} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs outline-none focus:border-brand-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">Password</label>
                  <button
                    type="button"
                    onClick={() => setMode("forgot")}
                    className="text-[10px] font-semibold text-brand-600 hover:underline dark:text-brand-400"
                  >
                    Forgot?
                  </button>
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs outline-none focus:border-brand-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <Button type="submit" className="w-full py-2.5 text-xs font-extrabold rounded-2xl" disabled={loading}>
                {loading ? <Spinner size="sm" /> : "Sign In"}
              </Button>
            </form>
          )}

          {mode === "signup" && (
            <form onSubmit={handleRegister} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs outline-none focus:border-brand-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">Email Address</label>
                <div className="mt-1 flex gap-2">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs outline-none focus:border-brand-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => handleSendOtp("VERIFY_EMAIL")}
                    disabled={loading || !email.trim()}
                    className="shrink-0 text-[10px] rounded-2xl px-3"
                  >
                    {otpSent ? "Resend" : "Send OTP"}
                  </Button>
                </div>
              </div>

              {otpSent && (
                <div>
                  <label className="block text-[11px] font-bold text-brand-600 dark:text-brand-400">6-Digit OTP Code</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="123456"
                    className="mt-1 w-full text-center font-mono font-black rounded-2xl border border-brand-300 bg-brand-50/50 p-2.5 text-sm outline-none dark:border-brand-800 dark:bg-brand-950/40 dark:text-white"
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs outline-none focus:border-brand-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <Button type="submit" className="w-full py-2.5 text-xs font-extrabold rounded-2xl" disabled={loading || !otpSent}>
                {loading ? <Spinner size="sm" /> : "Create Account"}
              </Button>
            </form>
          )}

          {mode === "forgot" && (
            <form onSubmit={handleResetPassword} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">Email Address</label>
                <div className="mt-1 flex gap-2">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs outline-none focus:border-brand-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => handleSendOtp("FORGOT_PASSWORD")}
                    disabled={loading || !email.trim()}
                    className="shrink-0 text-[10px] rounded-2xl px-3"
                  >
                    {otpSent ? "Resend" : "Send OTP"}
                  </Button>
                </div>
              </div>

              {otpSent && (
                <>
                  <div>
                    <label className="block text-[11px] font-bold text-brand-600 dark:text-brand-400">6-Digit Reset Code</label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      placeholder="123456"
                      className="mt-1 w-full text-center font-mono font-black rounded-2xl border border-brand-300 bg-brand-50/50 p-2.5 text-sm outline-none dark:border-brand-800 dark:bg-brand-950/40 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">New Password</label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter new password"
                      className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs outline-none focus:border-brand-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                </>
              )}

              <Button type="submit" className="w-full py-2.5 text-xs font-extrabold rounded-2xl" disabled={loading || !otpSent}>
                {loading ? <Spinner size="sm" /> : "Reset Password"}
              </Button>
            </form>
          )}
        </div>

        {/* Footer Contextual Links */}
        <div className="mt-4 text-center text-xs text-slate-500 dark:text-slate-400 pt-3 border-t border-slate-100 dark:border-slate-800">
          {mode === "signin" ? (
            <p>
              Don&apos;t have an account?{" "}
              <button
                type="button"
                onClick={() => setMode("signup")}
                className="font-bold text-brand-600 hover:underline dark:text-brand-400"
              >
                Create Account
              </button>
            </p>
          ) : mode === "signup" ? (
            <p>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => setMode("signin")}
                className="font-bold text-brand-600 hover:underline dark:text-brand-400"
              >
                Sign In
              </button>
            </p>
          ) : (
            <p>
              Remembered your password?{" "}
              <button
                type="button"
                onClick={() => setMode("signin")}
                className="font-bold text-brand-600 hover:underline dark:text-brand-400"
              >
                Back to Sign In
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
