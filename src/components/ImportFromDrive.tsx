"use client";

import { useCallback, useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "./ui";
import { FolderIcon } from "./ui/icons";

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

import SyncProgressModal from "./SyncProgressModal";

export default function ImportFromDrive({
  onImported,
}: {
  onImported: (ids?: string[]) => void | Promise<void>;
}) {
  const { data: session } = useSession();
  const [busy, setBusy] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const token = (session as any)?.accessToken as string | undefined;

  const openPicker = useCallback(async () => {
    setError(null);
    if (!API_KEY) {
      setError("Missing NEXT_PUBLIC_GOOGLE_API_KEY");
      return;
    }
    if (!token) {
      // If no Google OAuth token, open smooth sync modal
      setShowSyncModal(true);
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
        .setCallback(async (data: any) => {
          if (data.action === google.picker.Action.PICKED) {
            const ids = (data.docs ?? []).map((d: any) => d.id);
            if (ids.length) {
              setBusy(true);
              try {
                const res = await fetch("/api/import", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ ids }),
                });
                const resData = await res.json();
                if (!res.ok) throw new Error(resData.error || "Import failed");
                await onImported(ids);
              } catch (err: any) {
                setError(err?.message || "Import failed");
              } finally {
                setBusy(false);
              }
            }
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
    <div className="flex items-center gap-2">
      {/* Animated Sync Progress Modal */}
      <SyncProgressModal
        isOpen={showSyncModal}
        onClose={() => setShowSyncModal(false)}
        onFinished={() => onImported()}
      />

      <Button
        variant="secondary"
        size="sm"
        onClick={() => setShowSyncModal(true)}
        disabled={busy}
        title="Scan Google Drive folder and sync newly added PDFs into database"
      >
        <FolderIcon size={15} />
        <span>Sync Drive</span>
      </Button>

      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}
