"use client";

import { SearchX } from "lucide-react";
import { useMemo, useState } from "react";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";
import type { Property } from "@/types/property";
import { ListingsHeader, type PropertySort, type PropertyView } from "./ListingsHeader";
import { PropertyList } from "./PropertyList";

interface PropertyResultsProps {
  properties: readonly Property[];
  isLoading: boolean;
  selectedPropertyId: string | null;
  onSelect: (id: string) => void;
  onClearFilters: () => void;
  intent?: "Buy" | "Rent";
}

export function PropertyResults({ properties, isLoading, selectedPropertyId, onSelect, onClearFilters, intent = "Buy" }: PropertyResultsProps) {
  const [sort, setSort] = useState<PropertySort>("relevance");
  const [view, setView] = useState<PropertyView>("grid");
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => new Set());
  const sortedProperties = useMemo(() => {
    const next = [...properties];
    if (sort === "price-low") next.sort((a, b) => a.price - b.price);
    if (sort === "price-high") next.sort((a, b) => b.price - a.price);
    if (sort === "area-high") next.sort((a, b) => b.areaSqFt - a.areaSqFt);
    return next;
  }, [properties, sort]);
  const toggleFavorite = (id: string) => setFavoriteIds((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  if (isLoading) return <LoadingSkeleton />;
  if (properties.length === 0) return <div aria-live="polite" className="grid min-h-[420px] place-items-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-6 text-center" role="status"><div><SearchX className="mx-auto text-zinc-400" size={36} /><h2 className="mt-4 text-xl font-semibold">No properties found</h2><p className="mt-2 text-sm text-zinc-500">Try changing your location, budget, or property type.</p><button className="mt-5 rounded-lg bg-[var(--sat-red)] px-5 py-3 text-sm font-semibold text-white" onClick={onClearFilters} type="button">Clear all filters</button></div></div>;

  return (
    <>
      <ListingsHeader count={properties.length} intent={intent} onSortChange={setSort} onViewChange={setView} sort={sort} view={view} />
      <PropertyList favoriteIds={favoriteIds} onSelect={onSelect} onToggleFavorite={toggleFavorite} properties={sortedProperties} selectedPropertyId={selectedPropertyId} view={view} />
    </>
  );
}
