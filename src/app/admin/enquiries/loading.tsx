export default function AdminEnquiriesLoading() {
  return (
    <main className="px-5 py-10 sm:px-8 lg:px-10">
      <div
        aria-live="polite"
        className="mx-auto max-w-6xl space-y-6"
        role="status"
      >
        <div className="space-y-3">
          <div className="h-3 w-24 animate-pulse rounded bg-red-100" />
          <div className="h-8 w-64 max-w-full animate-pulse rounded bg-zinc-200" />
          <div className="h-4 w-96 max-w-full animate-pulse rounded bg-zinc-100" />
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-8 w-20 animate-pulse rounded-full bg-zinc-200"
            />
          ))}
        </div>

        <div className="mt-8 grid gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div className="h-4 w-48 animate-pulse rounded bg-zinc-200" />
                <div className="h-6 w-20 animate-pulse rounded-full bg-zinc-100" />
              </div>
              <div className="mt-3 h-5 w-36 animate-pulse rounded bg-zinc-200" />
              <div className="mt-4 h-16 w-full animate-pulse rounded-xl bg-zinc-50" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

