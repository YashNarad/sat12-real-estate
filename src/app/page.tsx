"use client";

import { LocateFixed, MapPinned, Minus, Plus } from "lucide-react";
import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { PropertyResults } from "@/components/listings/PropertyResults";
import { PropertyFilters } from "@/components/search/PropertyFilters";
import { NAGPUR_PROPERTIES } from "@/data/properties";
import { DEFAULT_FILTERS, useFilteredProperties } from "@/hooks/useFilteredProperties";

export default function Home() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const properties = useFilteredProperties(NAGPUR_PROPERTIES, filters);
  const visibleSelectedId = properties.some((property) => property.id === selectedPropertyId) ? selectedPropertyId : null;

  return (
    <>
      <Header currentIntent={filters.intent} onIntentChange={(intent) => setFilters((current) => ({ ...current, intent, maxPrice: null }))} />
      <PropertyFilters onChange={setFilters} onSearch={() => undefined} value={filters} />
      <main aria-label="Nagpur property results" className="bg-white lg:p-3">
        <div className="mx-auto grid max-w-[1536px] lg:min-h-[calc(100vh-183px)] lg:grid-cols-[30%_70%]">
          <aside aria-label="Map preview" className="map-placeholder relative hidden min-h-[720px] overflow-hidden rounded-l-xl border border-r-0 border-[var(--sat-border)] lg:block">
            <div className="absolute left-5 top-5 flex items-center gap-2 rounded-lg bg-white px-4 py-3 text-xs font-medium shadow-md"><span className="grid size-5 place-items-center rounded bg-zinc-200 text-zinc-500">✓</span>Search as I move the map <span className="sr-only">is disabled until Stage 2</span></div>
            <div className="absolute right-4 top-5 grid gap-2"><button aria-label="Zoom in — available in Stage 2" className="grid size-10 place-items-center rounded-lg bg-white text-zinc-400 shadow" disabled type="button"><Plus /></button><button aria-label="Zoom out — available in Stage 2" className="grid size-10 place-items-center rounded-lg bg-white text-zinc-400 shadow" disabled type="button"><Minus /></button><button aria-label="Reset map — available in Stage 2" className="mt-2 grid size-10 place-items-center rounded-lg bg-white text-zinc-400 shadow" disabled type="button"><LocateFixed size={18} /></button></div>
            {[[32,34,"56"],[64,29,"24"],[22,58,"12"],[69,69,"12"]].map(([left, top, label]) => <span className="absolute grid size-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-4 border-white bg-[var(--sat-red)] text-sm font-bold text-white shadow-lg" key={`${left}-${top}`} style={{ left: `${left}%`, top: `${top}%` }}>{label}</span>)}
            <div className="absolute bottom-6 left-5 right-5 rounded-xl border border-zinc-200 bg-white p-4 shadow-xl"><div className="flex items-start gap-3"><span className="grid size-12 shrink-0 place-items-center rounded-lg bg-red-50 text-[var(--sat-red)]"><MapPinned /></span><div><strong className="text-sm">Interactive Nagpur map</strong><p className="mt-1 text-xs leading-5 text-zinc-500">Marker clustering, previews, and synchronized selection arrive in Stage 2.</p></div></div></div>
          </aside>
          <section className="results-pane min-w-0 border-[var(--sat-border)] bg-white px-4 py-6 sm:px-6 lg:rounded-r-xl lg:border lg:p-8" id="results">
            <PropertyResults intent={filters.intent} isLoading={false} onClearFilters={() => setFilters(DEFAULT_FILTERS)} onSelect={setSelectedPropertyId} properties={properties} selectedPropertyId={visibleSelectedId} />
          </section>
        </div>
      </main>
    </>
  );
}
