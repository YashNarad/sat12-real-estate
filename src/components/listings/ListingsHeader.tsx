import { Grid2X2, List } from "lucide-react";

export type PropertySort = "relevance" | "price-low" | "price-high" | "area-high";
export type PropertyView = "grid" | "list";

interface ListingsHeaderProps {
  count: number;
  intent: "Buy" | "Rent";
  sort: PropertySort;
  view: PropertyView;
  onSortChange: (sort: PropertySort) => void;
  onViewChange: (view: PropertyView) => void;
}

export function ListingsHeader({ count, intent, sort, view, onSortChange, onViewChange }: ListingsHeaderProps) {
  return (
    <div className="mb-5">
      <p aria-live="polite" className="sr-only" role="status">{count} {count === 1 ? "property" : "properties"} found</p>
      <nav aria-label="Breadcrumb" className="text-xs text-zinc-500">Home <span className="mx-2">›</span> {intent} Properties <span className="mx-2">›</span> Nagpur</nav>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold leading-tight tracking-[-0.03em] text-[var(--sat-charcoal)]">Properties in <span className="text-[var(--sat-red)]">Nagpur</span></h1>
          <p className="mt-1 text-sm text-[var(--sat-muted)]">Find your next home, office or investment in Nagpur.</p>
        </div>
        <div className="flex items-center gap-3">
          <strong className="hidden text-sm text-zinc-800 xl:block">{count.toLocaleString("en-IN")} Properties</strong>
          <label className="relative">
            <span className="sr-only">Sort properties</span>
            <select aria-label="Sort properties" className="h-11 rounded-lg border border-[var(--sat-border)] bg-white px-4 text-sm text-zinc-700 focus:border-[var(--sat-red)] focus:outline-none" onChange={(event) => onSortChange(event.target.value as PropertySort)} value={sort}>
              <option value="relevance">Sort by: Relevance</option><option value="price-low">Price: Low to High</option><option value="price-high">Price: High to Low</option><option value="area-high">Area: Largest first</option>
            </select>
          </label>
          <div aria-label="Property layout" className="hidden gap-2 sm:flex" role="group">
            <button aria-label="Grid view" aria-pressed={view === "grid"} className={`grid size-11 place-items-center rounded-lg border ${view === "grid" ? "border-[var(--sat-red)] text-[var(--sat-red)]" : "border-[var(--sat-border)] text-zinc-600"}`} onClick={() => onViewChange("grid")} type="button"><Grid2X2 size={19} /></button>
            <button aria-label="List view" aria-pressed={view === "list"} className={`grid size-11 place-items-center rounded-lg border ${view === "list" ? "border-[var(--sat-red)] text-[var(--sat-red)]" : "border-[var(--sat-border)] text-zinc-600"}`} onClick={() => onViewChange("list")} type="button"><List size={20} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
