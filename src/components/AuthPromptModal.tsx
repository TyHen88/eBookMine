"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button, Spinner } from "./ui";
import { LockIcon, XIcon } from "./ui/icons";

interface AuthPromptModalProps {
  onClose: () => void;
}

type AuthMode = "signin" | "signup" | "forgot";

export default function AuthPromptModal({ onClose }: AuthPromptModalProps) {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);

  const handleSendOtp = async (type: "VERIFY_EMAIL" | "FORGOT_PASSWORD") => {
    if (!email.trim()) {
      setErrorMsg("Please enter your email.");
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), type }),
      });
      const d = await res.json();
      if (!res.ok) {
        setErrorMsg(d.error || "Failed to send OTP.");
      } else {
        setOtpSent(true);
        setSuccessMsg(`OTP sent to ${email.trim()}`);
        if (d.otpCode) setDevOtpHint(d.otpCode);
      }
    } catch {
      setErrorMsg("Failed to send OTP.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
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
      setErrorMsg("Sign in failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
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
        await signIn("credentials", {
          email: email.trim(),
          password: password.trim(),
          redirect: false,
        });
        window.location.reload();
      }
    } catch {
      setErrorMsg("Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
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
        setSuccessMsg("Password reset successfully! Please sign in.");
        setMode("signin");
        setOtpSent(false);
        setPassword("");
      }
    } catch {
      setErrorMsg("Password reset failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
              <LockIcon size={16} />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {mode === "signin" ? "Sign In Required" : mode === "signup" ? "Sign Up with OTP" : "Reset Password"}
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <XIcon size={18} />
          </button>
        </div>

        {/* Mode Selector */}
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800 mb-4">
          <button
            onClick={() => { setMode("signin"); setErrorMsg(null); setSuccessMsg(null); }}
            className={`rounded-lg py-1.5 text-[11px] font-bold ${mode === "signin" ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white" : "text-slate-500"}`}
          >
            Sign In
          </button>
          <button
            onClick={() => { setMode("signup"); setErrorMsg(null); setSuccessMsg(null); }}
            className={`rounded-lg py-1.5 text-[11px] font-bold ${mode === "signup" ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white" : "text-slate-500"}`}
          >
            Sign Up
          </button>
          <button
            onClick={() => { setMode("forgot"); setErrorMsg(null); setSuccessMsg(null); }}
            className={`rounded-lg py-1.5 text-[11px] font-bold ${mode === "forgot" ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white" : "text-slate-500"}`}
          >
            Forgot
          </button>
        </div>

        {errorMsg && (
          <div className="mb-3 rounded-lg bg-red-50 p-2 text-center text-xs font-medium text-red-600 dark:bg-red-950/40 dark:text-red-300">
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="mb-3 rounded-lg bg-emerald-50 p-2 text-center text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            {successMsg}
          </div>
        )}
        {devOtpHint && (
          <div className="mb-3 rounded-lg bg-amber-50 p-2 text-center text-xs font-bold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
            🔑 Dev OTP Code: <span className="font-mono underline">{devOtpHint}</span>
          </div>
        )}

        {mode === "signin" && (
          <form onSubmit={handleSignIn} className="space-y-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-xs outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-xs outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <Button type="submit" className="w-full py-2 text-xs" disabled={loading}>
              {loading ? <Spinner size="sm" /> : "Sign In"}
            </Button>
          </form>
        )}

        {mode === "signup" && (
          <form onSubmit={handleRegister} className="space-y-2.5">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-xs outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Email</label>
              <div className="mt-1 flex gap-1.5">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2 text-xs outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => handleSendOtp("VERIFY_EMAIL")}
                  disabled={loading || !email.trim()}
                  className="shrink-0 text-[10px]"
                >
                  {otpSent ? "Resend" : "Send OTP"}
                </Button>
              </div>
            </div>

            {otpSent && (
              <div>
                <label className="block text-[11px] font-semibold text-brand-600 dark:text-brand-400">6-Digit OTP Code</label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  className="mt-1 w-full text-center font-mono font-bold rounded-xl border border-brand-300 bg-brand-50/50 p-2 text-xs outline-none dark:border-brand-800 dark:bg-brand-950/40 dark:text-white"
                />
              </div>
            )}

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-xs outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <Button type="submit" className="w-full py-2 text-xs" disabled={loading || !otpSent}>
              {loading ? <Spinner size="sm" /> : "Create Account"}
            </Button>
          </form>
        )}

        {mode === "forgot" && (
          <form onSubmit={handleResetPassword} className="space-y-2.5">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Email</label>
              <div className="mt-1 flex gap-1.5">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2 text-xs outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => handleSendOtp("FORGOT_PASSWORD")}
                  disabled={loading || !email.trim()}
                  className="shrink-0 text-[10px]"
                >
                  {otpSent ? "Resend" : "Send OTP"}
                </Button>
              </div>
            </div>

            {otpSent && (
              <>
                <div>
                  <label className="block text-[11px] font-semibold text-brand-600 dark:text-brand-400">6-Digit Reset Code</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    className="mt-1 w-full text-center font-mono font-bold rounded-xl border border-brand-300 bg-brand-50/50 p-2 text-xs outline-none dark:border-brand-800 dark:bg-brand-950/40 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">New Password</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-xs outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </>
            )}

            <Button type="submit" className="w-full py-2 text-xs" disabled={loading || !otpSent}>
              {loading ? <Spinner size="sm" /> : "Reset Password"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
