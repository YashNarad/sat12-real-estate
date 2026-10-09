"use client";

import { ArrowRight, X } from "lucide-react";
import { DEFAULT_FILTERS } from "@/hooks/useFilteredProperties";
import type { PropertyFiltersState } from "@/types/property";
import { FilterButton } from "./FilterButton";
import { SearchBar } from "./SearchBar";

interface PropertyFiltersProps {
  value: PropertyFiltersState;
  onChange: (value: PropertyFiltersState) => void;
  onSearch: () => void;
}

export function PropertyFilters({ value, onChange, onSearch }: PropertyFiltersProps) {
  const update = <Key extends keyof PropertyFiltersState>(key: Key, next: PropertyFiltersState[Key]) => onChange({ ...value, [key]: next });
  const budgetOptions = value.intent === "Buy"
    ? [["50 Lakh", 5_000_000], ["75 Lakh", 7_500_000], ["1 Crore", 10_000_000], ["2 Crore", 20_000_000]] as const
    : [["₹25,000 / month", 25_000], ["₹50,000 / month", 50_000], ["₹75,000 / month", 75_000]] as const;

  return (
    <section aria-label="Property search filters" className="border-b border-[var(--sat-border)] bg-[var(--sat-canvas)] px-4 py-5 sm:px-8 lg:px-14">
      <form className="mx-auto flex max-w-[1424px] items-center gap-2 overflow-x-auto rounded-xl border border-zinc-200 bg-white p-2 shadow-[0_8px_24px_rgba(24,24,27,0.04)]" onSubmit={(event) => { event.preventDefault(); onSearch(); }}>
        <SearchBar onChange={(query) => update("query", query)} value={value.query} />
        <FilterButton label="Intent" onChange={(event) => onChange({ ...value, intent: event.target.value as PropertyFiltersState["intent"], maxPrice: null })} value={value.intent}><option>Buy</option><option>Rent</option></FilterButton>
        <FilterButton label="Property type" onChange={(event) => update("propertyType", event.target.value as PropertyFiltersState["propertyType"])} value={value.propertyType}><option value="All">Property Type</option><option>Apartment</option><option>Villa</option><option>Independent House</option><option>Plot</option></FilterButton>
        <FilterButton label="Budget" onChange={(event) => update("maxPrice", event.target.value ? Number(event.target.value) : null)} value={value.maxPrice ?? ""}><option value="">Budget</option>{budgetOptions.map(([label, amount]) => <option key={amount} value={amount}>{label}</option>)}</FilterButton>
        <FilterButton label="Bedrooms" onChange={(event) => update("bedrooms", event.target.value ? Number(event.target.value) : null)} value={value.bedrooms ?? ""}><option value="">BHK</option><option value="1">1 BHK</option><option value="2">2 BHK</option><option value="3">3 BHK</option><option value="4">4+ BHK</option></FilterButton>
        <button aria-label="Clear filters" className="flex h-12 shrink-0 items-center gap-2 rounded-lg border border-[var(--sat-border)] px-4 text-sm font-medium text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50" onClick={() => onChange(DEFAULT_FILTERS)} type="button">
          <X size={17} /><span>Clear filters</span>
        </button>
        <button className="flex h-12 shrink-0 items-center gap-5 rounded-lg bg-[var(--sat-red)] px-7 text-sm font-semibold text-white hover:bg-[var(--sat-red-dark)]" type="submit">Search Properties<ArrowRight size={18} /></button>
      </form>
    </section>
  );
}
