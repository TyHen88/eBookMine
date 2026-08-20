"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { CheckIcon, AlertTriangleIcon, InfoIcon, XIcon } from "./icons";

export type ToastType = "success" | "error" | "info";

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType>({
  showToast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, type: ToastType = "success") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast Notification Container - Top Center */}
      <div className="fixed top-14 sm:top-5 inset-x-0 mx-auto z-50 flex flex-col items-center gap-2 max-w-sm sm:max-w-md w-full pointer-events-none px-4">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center justify-between gap-3 px-4 py-2.5 rounded-full shadow-2xl border backdrop-blur-xl transition-all duration-300 animate-slideDown max-w-full ${
              toast.type === "success"
                ? "bg-slate-900/95 border-emerald-500/50 text-white shadow-emerald-950/40"
                : toast.type === "error"
                ? "bg-slate-900/95 border-rose-500/50 text-white shadow-rose-950/40"
                : "bg-slate-900/95 border-slate-700/80 text-white shadow-black/50"
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="shrink-0">
                {toast.type === "success" ? (
                  <CheckIcon size={16} className="text-emerald-400" />
                ) : toast.type === "error" ? (
                  <AlertTriangleIcon size={16} className="text-rose-400" />
                ) : (
                  <InfoIcon size={16} className="text-brand-400" />
                )}
              </span>
              <p className="text-xs font-semibold truncate">{toast.message}</p>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="shrink-0 rounded-full p-0.5 text-slate-400 hover:bg-white/10 hover:text-white transition"
              aria-label="Dismiss notification"
            >
              <XIcon size={13} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
