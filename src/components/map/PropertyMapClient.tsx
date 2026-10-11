"use client";

import { useCallback, useMemo, useState } from "react";
import { MapContainer, TileLayer } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import { MAP_MAX_ZOOM, MAP_MIN_ZOOM, NAGPUR_CENTER } from "@/lib/mapConfig";
import type { PropertyMapProps } from "./PropertyMap";
import { MapControls } from "./MapControls";
import { MapEventBridge, type MapControlsApi } from "./MapEventBridge";
import { MapPreviewCard } from "./MapPreviewCard";
import { PropertyMarker } from "./PropertyMarker";
import { createClusterIcon } from "./mapIcons";

const emptyControls: MapControlsApi = {
  zoomIn: () => undefined,
  zoomOut: () => undefined,
  reset: () => undefined,
  readBounds: () => ({ north: 21.25, south: 20.98, east: 79.2, west: 78.94 }),
};

export function PropertyMapClient({ properties, selectedPropertyId, searchAsMapMoves, visible, onSelect, onClearSelection, onSearchAsMapMovesChange, onBoundsChange, onViewProperty }: PropertyMapProps) {
  const [controls, setControls] = useState<MapControlsApi>(emptyControls);
  const [tileFailed, setTileFailed] = useState(false);
  const selectedProperty = useMemo(
    () => properties.find(({ id }) => id === selectedPropertyId) ?? null,
    [properties, selectedPropertyId],
  );

  const handleSearchChange = useCallback((enabled: boolean) => {
    if (enabled) onBoundsChange(controls.readBounds());
    onSearchAsMapMovesChange(enabled);
  }, [controls, onBoundsChange, onSearchAsMapMovesChange]);

  return (
    <section aria-label="Nagpur property map" className="relative h-full min-h-[520px] overflow-hidden rounded-2xl bg-zinc-100">
      <MapContainer center={[...NAGPUR_CENTER]} className="h-full min-h-[520px] w-full" maxZoom={MAP_MAX_ZOOM} minZoom={MAP_MIN_ZOOM} scrollWheelZoom zoom={11} zoomControl={false}>
        <TileLayer attribution="&copy; OpenStreetMap contributors" eventHandlers={{ tileerror: () => setTileFailed(true), tileload: () => setTileFailed(false) }} url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <MarkerClusterGroup chunkedLoading iconCreateFunction={createClusterIcon} showCoverageOnHover={false}>
          {properties.map((property) => <PropertyMarker key={property.id} property={property} selected={property.id === selectedPropertyId} onSelect={onSelect} />)}
        </MarkerClusterGroup>
        <MapEventBridge properties={properties} selectedProperty={selectedProperty} searchAsMapMoves={searchAsMapMoves} visible={visible} onBoundsChange={onBoundsChange} onMapReady={setControls} />
      </MapContainer>
      <MapControls searchAsMapMoves={searchAsMapMoves} onZoomIn={controls.zoomIn} onZoomOut={controls.zoomOut} onReset={controls.reset} onSearchAsMapMovesChange={handleSearchChange} />
      {tileFailed && <p className="absolute bottom-4 left-1/2 z-[450] -translate-x-1/2 rounded-lg border border-zinc-200 bg-white/95 px-3 py-2 text-center text-xs text-zinc-700 shadow" role="status">The background map could not load. Property markers and controls are still available.</p>}
      <MapPreviewCard property={selectedProperty} onClose={onClearSelection} onViewProperty={onViewProperty} />
    </section>
  );
}
