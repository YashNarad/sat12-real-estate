"use client";

import { useCallback, useState } from "react";
import { Header } from "@/components/layout/Header";
import { PropertyResults } from "@/components/listings/PropertyResults";
import { PropertyMap } from "@/components/map/PropertyMap";
import { ViewToggle } from "@/components/mobile/ViewToggle";
import { PropertyFilters } from "@/components/search/PropertyFilters";
import { NAGPUR_PROPERTIES } from "@/data/properties";
import { DEFAULT_FILTERS, useFilteredProperties } from "@/hooks/useFilteredProperties";
import { sameMapBounds, useMapBoundsFilter } from "@/hooks/useMapBoundsFilter";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { usePropertySelection } from "@/hooks/usePropertySelection";
import type { MapBounds, MobileResultsView } from "@/types/map";

export default function Home() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [searchAsMapMoves, setSearchAsMapMoves] = useState(false);
  const [mapBounds, setMapBounds] = useState<MapBounds | null>(null);
  const [mobileView, setMobileView] = useState<MobileResultsView>("list");
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const filterMatchedProperties = useFilteredProperties(NAGPUR_PROPERTIES, filters);
  const listingProperties = useMapBoundsFilter(filterMatchedProperties, mapBounds, searchAsMapMoves);
  const selection = usePropertySelection(filterMatchedProperties);

  const handleBoundsChange = useCallback((bounds: MapBounds) => {
    setMapBounds((current) => sameMapBounds(current, bounds) ? current : bounds);
  }, []);

  const handleSearchAsMapMovesChange = useCallback((enabled: boolean) => {
    setSearchAsMapMoves(enabled);
    if (!enabled) setMapBounds(null);
  }, []);

  const handleCardSelect = useCallback((id: string) => {
    selection.selectProperty(id);
    setMobileView("map");
  }, [selection]);

  const mapMounted = isDesktop || mobileView === "map";

  return (
    <>
      <Header currentIntent={filters.intent} onIntentChange={(intent) => setFilters((current) => ({ ...current, intent, maxPrice: null }))} />
      <PropertyFilters onChange={setFilters} onSearch={() => undefined} value={filters} />
      <main aria-label="Nagpur property results" className="bg-white lg:p-3">
        <div className="mx-auto max-w-[1536px] px-4 pt-3 lg:hidden"><ViewToggle onChange={setMobileView} value={mobileView} /></div>
        <div className="mx-auto grid max-w-[1536px] lg:min-h-[calc(100vh-183px)] lg:grid-cols-[30%_70%]">
          <aside aria-label="Interactive property map" className={`${mobileView === "map" ? "block" : "hidden"} relative min-h-[560px] overflow-hidden border-[var(--sat-border)] lg:sticky lg:top-0 lg:block lg:h-[calc(100vh-207px)] lg:min-h-[720px] lg:rounded-l-xl lg:border lg:border-r-0`}>
            {mapMounted && (
              <PropertyMap
                onBoundsChange={handleBoundsChange}
                onClearSelection={selection.clearSelection}
                onSearchAsMapMovesChange={handleSearchAsMapMovesChange}
                onSelect={selection.selectProperty}
                onViewProperty={() => setMobileView("list")}
                properties={filterMatchedProperties}
                searchAsMapMoves={searchAsMapMoves}
                selectedPropertyId={selection.selectedPropertyId}
                visible={isDesktop || mobileView === "map"}
              />
            )}
          </aside>
          <section className={`${mobileView === "list" ? "block" : "hidden"} results-pane min-w-0 border-[var(--sat-border)] bg-white px-4 py-6 sm:px-6 lg:block lg:rounded-r-xl lg:border lg:p-8`} id="results">
            <PropertyResults
              emptyReason={searchAsMapMoves && mapBounds !== null ? "map-bounds" : "filters"}
              intent={filters.intent}
              isLoading={false}
              onClearFilters={() => { setFilters(DEFAULT_FILTERS); setMapBounds(null); setSearchAsMapMoves(false); }}
              onSelect={handleCardSelect}
              properties={listingProperties}
              selectedPropertyId={selection.selectedPropertyId}
            />
          </section>
        </div>
      </main>
    </>
  );
}
