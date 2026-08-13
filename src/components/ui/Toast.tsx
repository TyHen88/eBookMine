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
      {/* Toast Notification Container */}
      <div className="fixed top-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center justify-between gap-3 p-3.5 rounded-2xl shadow-xl border backdrop-blur-xl transition-all duration-300 animate-slide-in ${
              toast.type === "success"
                ? "bg-emerald-50/95 border-emerald-200 text-emerald-900 dark:bg-emerald-950/90 dark:border-emerald-800 dark:text-emerald-100"
                : toast.type === "error"
                ? "bg-rose-50/95 border-rose-200 text-rose-900 dark:bg-rose-950/90 dark:border-rose-800 dark:text-rose-100"
                : "bg-brand-50/95 border-brand-200 text-brand-900 dark:bg-brand-950/90 dark:border-brand-800 dark:text-brand-100"
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="shrink-0">
                {toast.type === "success" ? (
                  <CheckIcon size={18} className="text-emerald-600 dark:text-emerald-400" />
                ) : toast.type === "error" ? (
                  <AlertTriangleIcon size={18} className="text-rose-600 dark:text-rose-400" />
                ) : (
                  <InfoIcon size={18} className="text-brand-600 dark:text-brand-400" />
                )}
              </span>
              <p className="text-xs font-semibold truncate">{toast.message}</p>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <XIcon size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
