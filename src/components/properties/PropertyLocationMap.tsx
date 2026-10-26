"use client";

import { PropertyMap } from "@/components/map/PropertyMap";
import type { Property } from "@/types/property";

export function PropertyLocationMap({ property }: { property: Property }) {
  return (
    <div aria-label={`Map showing ${property.title}`} className="h-[360px] overflow-hidden rounded-2xl border border-[var(--sat-border)]" role="region">
      <PropertyMap
        onBoundsChange={() => undefined}
        onClearSelection={() => undefined}
        onSearchAsMapMovesChange={() => undefined}
        onSelect={() => undefined}
        onViewProperty={() => undefined}
        properties={[property]}
        searchAsMapMoves={false}
        selectedPropertyId={property.id}
        visible
      />
    </div>
  );
}
