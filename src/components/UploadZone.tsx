"use client";

import { useCallback, useRef, useState } from "react";
import { extractPdfInfo } from "@/lib/pdf";
import { BookMeta } from "@/lib/types";
import { Spinner } from "./ui";
import {
  AlertTriangleIcon,
  CheckIcon,
  UploadCloudIcon,
} from "./ui/icons";

interface UploadItem {
  name: string;
  status: "parsing" | "uploading" | "done" | "error";
  error?: string;
}

export default function UploadZone({
  onUploaded,
}: {
  onUploaded: (book: BookMeta) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [items, setItems] = useState<UploadItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const pdfs = Array.from(files).filter(
        (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")
      );
      if (pdfs.length === 0) return;

      for (const file of pdfs) {
        const update = (patch: Partial<UploadItem>) =>
          setItems((prev) =>
            prev.map((it) => (it.name === file.name ? { ...it, ...patch } : it))
          );

        setItems((prev) => [...prev, { name: file.name, status: "parsing" }]);

        try {
          const info = await extractPdfInfo(file);
          update({ status: "uploading" });

          const meta = {
            title: info.title || file.name.replace(/\.pdf$/i, ""),
            author: info.author || "Unknown",
            pageCount: info.pageCount,
            cover: info.cover,
            tags: [],
          };

          const form = new FormData();
          form.append("file", file);
          form.append("meta", JSON.stringify(meta));

          const res = await fetch("/api/books", { method: "POST", body: form });
          if (!res.ok) throw new Error(await res.text());
          const { book } = await res.json();
          onUploaded(book);
          update({ status: "done" });
        } catch (err: any) {
          update({ status: "error", error: err?.message ?? "Failed" });
        }
      }

      // Clear finished items after a moment.
      setTimeout(() => {
        setItems((prev) => prev.filter((it) => it.status !== "done"));
      }, 2500);
    },
    [onUploaded]
  );

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`group flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition-all duration-300 ${
          dragOver
            ? "scale-[1.01] border-brand-500 bg-brand-50 shadow-lg shadow-brand-500/10 dark:bg-brand-900/20"
            : "border-slate-300 hover:border-brand-400 hover:bg-brand-50/40 dark:border-slate-700 dark:hover:bg-brand-900/10"
        }`}
      >
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 transition-transform duration-300 group-hover:-translate-y-1 dark:bg-brand-900/40 dark:text-brand-300 ${dragOver ? "animate-float" : ""}`}
        >
          <UploadCloudIcon size={26} />
        </div>
        <p className="mt-3 font-medium">Drop PDFs here or click to upload</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Covers &amp; metadata are extracted automatically
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
      </div>

      {items.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm">
          {items.map((it) => (
            <li
              key={it.name}
              className="flex animate-fade-in-up items-center justify-between rounded-lg bg-slate-100 px-3 py-1.5 dark:bg-slate-800"
            >
              <span className="truncate">{it.name}</span>
              <span className="ml-2 flex shrink-0 items-center gap-1.5 text-xs font-medium">
                {it.status === "parsing" && (
                  <>
                    <Spinner size="sm" />
                    <span className="text-slate-500">reading…</span>
                  </>
                )}
                {it.status === "uploading" && (
                  <>
                    <Spinner size="sm" />
                    <span className="text-slate-500">uploading…</span>
                  </>
                )}
                {it.status === "done" && (
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                    <CheckIcon size={15} /> done
                  </span>
                )}
                {it.status === "error" && (
                  <span
                    className="flex items-center gap-1 text-red-500"
                    title={it.error}
                  >
                    <AlertTriangleIcon size={15} /> failed
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
