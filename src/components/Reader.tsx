"use client";

import React, { useSyncExternalStore } from "react";
import { ReaderTabProvider } from "./reader/context/ReaderTabContext";
import ReaderWorkspace from "./reader/ReaderWorkspace";
import { BookLoader } from "@/components/ui";

const noopSubscribe = () => () => {};

export default function Reader({ id }: { id?: string }) {
  const isClient = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );

  if (!isClient) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-950 text-white">
        <BookLoader label="Launching Reader..." />
      </div>
    );
  }

  return (
    <ReaderTabProvider initialBookId={id}>
      <ReaderWorkspace />
    </ReaderTabProvider>
  );
}
