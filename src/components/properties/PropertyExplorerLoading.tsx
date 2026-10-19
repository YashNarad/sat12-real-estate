export function PropertyExplorerLoading() {
  return <div aria-label="Loading published properties" className="min-h-screen animate-pulse bg-zinc-50"><div className="h-[76px] border-b border-zinc-200 bg-white" /><div className="mx-auto mt-7 grid max-w-[1536px] gap-3 px-4 lg:grid-cols-[30%_70%]"><div className="min-h-[560px] rounded-xl bg-zinc-200" /><div className="grid content-start gap-4 lg:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <div className="h-72 rounded-xl bg-white shadow-sm" key={index} />)}</div></div></div>;
}
