export function LoadingSkeleton() {
  return (
    <div aria-label="Loading properties" className="grid animate-pulse gap-4 sm:grid-cols-2 xl:grid-cols-3" role="status">
      {Array.from({ length: 6 }, (_, index) => (
        <div className="overflow-hidden rounded-xl border border-[var(--sat-border)] bg-white" key={index}>
          <div className="aspect-[16/9] bg-zinc-200" />
          <div className="space-y-3 p-4"><div className="h-4 w-2/3 rounded bg-zinc-200" /><div className="h-5 w-1/2 rounded bg-zinc-200" /><div className="h-3 w-3/4 rounded bg-zinc-100" /></div>
        </div>
      ))}
      <span className="sr-only">Loading properties</span>
    </div>
  );
}
