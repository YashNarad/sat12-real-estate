"use client";

import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { PropertyFilters } from "@/components/search/PropertyFilters";
import { DEFAULT_FILTERS } from "@/hooks/useFilteredProperties";

export default function Home() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);

  return (
    <>
      <Header />
      <PropertyFilters onChange={setFilters} onSearch={() => undefined} value={filters} />
      <main aria-label="Nagpur property results" className="min-h-[calc(100vh-172px)] bg-white px-6 py-12">
        <div className="mx-auto max-w-[1424px]">
          <p className="text-sm text-zinc-500">Home / Buy Properties / Nagpur</p>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-[var(--sat-charcoal)]">Properties in <span className="text-[var(--sat-red)]">Nagpur</span></h1>
          <p className="mt-2 text-sm text-[var(--sat-muted)]">Find your next home, office or investment in Nagpur.</p>
        </div>
      </main>
    </>
  );
}
