"use client";

import { AlertTriangle } from "lucide-react";

export default function AdminError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="grid min-h-[70vh] place-items-center px-6 text-center">
      <div
        className="max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm"
        role="alert"
      >
        <AlertTriangle className="mx-auto text-[var(--sat-red)]" size={38} />
        <h1 className="mt-4 text-2xl font-bold text-zinc-900">
          Admin tools are temporarily unavailable
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          Your request could not be completed. No account role was assumed to have changed.
        </p>
        <button
          className="mt-6 rounded-lg bg-[var(--sat-red)] px-5 py-3 text-sm font-semibold text-white hover:bg-[var(--sat-red-dark)]"
          onClick={reset}
          type="button"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
