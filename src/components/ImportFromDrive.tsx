"use client";

import { useCallback, useState } from "react";
import { useSession } from "next-auth/react";

declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
const APP_ID = process.env.NEXT_PUBLIC_GOOGLE_APP_ID; // Google Cloud project number (optional)

let pickerLoading: Promise<void> | null = null;

/** Load the gapi loader script and the picker module exactly once. */
function loadPicker(): Promise<void> {
  if (typeof window !== "undefined" && window.google?.picker) return Promise.resolve();
  if (pickerLoading) return pickerLoading;

  pickerLoading = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://apis.google.com/js/api.js";
    script.onload = () => {
      window.gapi.load("picker", { callback: () => resolve() });
    };
    script.onerror = () => reject(new Error("Failed to load Google API script"));
    document.body.appendChild(script);
  });
  return pickerLoading;
}

export default function ImportFromDrive({
  onImported,
}: {
  onImported: (ids: string[]) => void | Promise<void>;
}) {
  const { data: session } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const token = (session as any)?.accessToken as string | undefined;

  const openPicker = useCallback(async () => {
    setError(null);
    if (!API_KEY) {
      setError("Missing NEXT_PUBLIC_GOOGLE_API_KEY");
      return;
    }
    if (!token) {
      setError("No Google access token in session — sign out and back in.");
      return;
    }

    setBusy(true);
    try {
      await loadPicker();
      const google = window.google;

      // Show the user's own Drive files, filtered to PDFs, multi-select.
      const view = new google.picker.DocsView(google.picker.ViewId.DOCS)
        .setMimeTypes("application/pdf")
        .setOwnedByMe(true)
        .setSelectFolderEnabled(false);

      const builder = new google.picker.PickerBuilder()
        .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
        .setOAuthToken(token)
        .setDeveloperKey(API_KEY)
        .addView(view)
        .setTitle("Select PDFs to add to eBookMine")
        .setCallback((data: any) => {
          if (data.action === google.picker.Action.PICKED) {
            const ids = (data.docs ?? []).map((d: any) => d.id);
            if (ids.length) onImported(ids);
          }
        });

      if (APP_ID) builder.setAppId(APP_ID);

      builder.build().setVisible(true);
    } catch (err: any) {
      setError(err?.message ?? "Could not open the picker");
    } finally {
      setBusy(false);
    }
  }, [token, onImported]);

  return (
    <div className="flex flex-col items-end">
      <button
        onClick={openPicker}
        disabled={busy}
        className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
        title="Import existing PDFs from your Google Drive"
      >
        {busy ? "Opening…" : "⬇️ Import from Drive"}
      </button>
      {error && <span className="mt-1 text-xs text-red-500">{error}</span>}
    </div>
  );
}
