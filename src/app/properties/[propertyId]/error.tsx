"use client";

import Link from "next/link";

export default function PropertyDetailsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[var(--sat-canvas)] px-4">
      <section className="max-w-lg rounded-2xl border border-[var(--sat-border)] bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-bold uppercase tracking-wider text-[var(--sat-red)]">Property unavailable</p>
        <h1 className="mt-3 text-2xl font-bold">We could not load this property</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">Please try again. No private listing information was exposed.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button className="rounded-lg bg-[var(--sat-red)] px-5 py-3 text-sm font-bold text-white" onClick={reset} type="button">Try again</button>
          <Link className="rounded-lg border border-zinc-300 px-5 py-3 text-sm font-bold" href="/">Back to properties</Link>
        </div>
      </section>
    </main>
  );
}
