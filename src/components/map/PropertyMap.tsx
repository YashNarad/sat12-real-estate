"use client";

import dynamic from "next/dynamic";
import type { Property } from "@/types/property";
import type { MapBounds } from "@/types/map";

export interface PropertyMapProps {
  properties: readonly Property[];
  selectedPropertyId: string | null;
  searchAsMapMoves: boolean;
  visible: boolean;
  onSelect: (id: string) => void;
  onClearSelection: () => void;
  onSearchAsMapMovesChange: (enabled: boolean) => void;
  onBoundsChange: (bounds: MapBounds) => void;
  onViewProperty: (id: string) => void;
}

const DynamicPropertyMap = dynamic(
  () => import("./PropertyMapClient").then((module) => module.PropertyMapClient),
  {
    ssr: false,
    loading: () => (
      <div
        aria-label="Loading interactive map"
        className="map-placeholder grid h-full min-h-[520px] place-items-center"
        role="status"
      >
        Loading interactive map…
      </div>
    ),
  },
);

export function PropertyMap(props: PropertyMapProps) {
  return <DynamicPropertyMap {...props} />;
}
