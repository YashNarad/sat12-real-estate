"use client";

import { AlertTriangle } from "lucide-react";

export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="grid min-h-[60vh] place-items-center px-6 text-center"><div className="max-w-md rounded-2xl border border-zinc-200 bg-white p-8" role="alert"><AlertTriangle className="mx-auto text-[var(--sat-red)]" size={36} /><h1 className="mt-4 text-2xl font-bold">This workspace is temporarily unavailable</h1><p className="mt-2 text-sm leading-6 text-zinc-600">The current management page could not be loaded. No account or property changes were assumed.</p><button className="mt-6 rounded-lg bg-[var(--sat-red)] px-5 py-3 text-sm font-semibold text-white" onClick={reset} type="button">Try again</button></div></main>;
}
