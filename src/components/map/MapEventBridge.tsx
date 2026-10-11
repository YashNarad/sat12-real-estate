"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useMap, useMapEvents } from "react-leaflet";
import { MAP_FIT_PADDING, MAP_FOCUS_ZOOM, NAGPUR_DEFAULT_BOUNDS } from "@/lib/mapConfig";
import type { MapBounds } from "@/types/map";
import type { Property } from "@/types/property";

export interface MapControlsApi {
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
  readBounds: () => MapBounds;
}

interface MapEventBridgeProps {
  properties: readonly Property[];
  selectedProperty: Property | null;
  searchAsMapMoves: boolean;
  visible: boolean;
  onBoundsChange: (bounds: MapBounds) => void;
  onMapReady: (controls: MapControlsApi) => void;
}

function readPlainBounds(map: ReturnType<typeof useMap>): MapBounds {
  const bounds = map.getBounds();
  return { north: bounds.getNorth(), south: bounds.getSouth(), east: bounds.getEast(), west: bounds.getWest() };
}

export function MapEventBridge({ properties, selectedProperty, searchAsMapMoves, visible, onBoundsChange, onMapReady }: MapEventBridgeProps) {
  const map = useMap();
  const previousSelectedId = useRef<string | null>(null);
  const animationFrame = useRef<number | null>(null);

  const scheduleInvalidate = useCallback(() => {
    if (animationFrame.current !== null) cancelAnimationFrame(animationFrame.current);
    animationFrame.current = requestAnimationFrame(() => {
      map.invalidateSize();
      animationFrame.current = null;
    });
  }, [map]);

  useMapEvents({
    moveend: () => {
      if (searchAsMapMoves) onBoundsChange(readPlainBounds(map));
    },
  });

  useEffect(() => {
    const nextId = selectedProperty?.id ?? null;
    if (nextId !== null && nextId !== previousSelectedId.current) {
      const position: [number, number] = [selectedProperty!.latitude, selectedProperty!.longitude];
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) map.setView(position, MAP_FOCUS_ZOOM);
      else map.flyTo(position, MAP_FOCUS_ZOOM);
    }
    previousSelectedId.current = nextId;
  }, [map, selectedProperty]);

  useEffect(() => {
    scheduleInvalidate();
  }, [scheduleInvalidate, visible]);

  useEffect(() => {
    const observer = new ResizeObserver(scheduleInvalidate);
    observer.observe(map.getContainer());
    return () => {
      observer.disconnect();
      if (animationFrame.current !== null) cancelAnimationFrame(animationFrame.current);
    };
  }, [map, scheduleInvalidate]);

  const controls = useMemo<MapControlsApi>(() => ({
    zoomIn: () => map.zoomIn(),
    zoomOut: () => map.zoomOut(),
    reset: () => map.fitBounds(
      properties.length > 0
        ? properties.map(({ latitude, longitude }) => [latitude, longitude] as [number, number])
        : NAGPUR_DEFAULT_BOUNDS.map(([latitude, longitude]) => [latitude, longitude] as [number, number]),
      { padding: [...MAP_FIT_PADDING] },
    ),
    readBounds: () => readPlainBounds(map),
  }), [map, properties]);

  useEffect(() => onMapReady(controls), [controls, onMapReady]);
  return null;
}
