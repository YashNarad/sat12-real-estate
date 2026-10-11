import { useMemo } from "react";
import type { Property } from "@/types/property";
import type { MapBounds } from "@/types/map";

const BOUNDS_TOLERANCE = 1e-6;

function isValidBounds(bounds: MapBounds): boolean {
  return (
    Object.values(bounds).every(Number.isFinite) &&
    bounds.north >= bounds.south &&
    bounds.east >= bounds.west
  );
}

export function propertyIsWithinBounds(property: Property, bounds: MapBounds): boolean {
  if (!isValidBounds(bounds)) return false;
  return (
    property.latitude >= bounds.south &&
    property.latitude <= bounds.north &&
    property.longitude >= bounds.west &&
    property.longitude <= bounds.east
  );
}

export function filterPropertiesByBounds(
  properties: readonly Property[],
  bounds: MapBounds | null,
  enabled: boolean,
): readonly Property[] {
  if (!enabled || bounds === null) return properties;
  return properties.filter((property) => propertyIsWithinBounds(property, bounds));
}

export function sameMapBounds(a: MapBounds | null, b: MapBounds | null): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  return (Object.keys(a) as (keyof MapBounds)[]).every(
    (key) => Math.abs(a[key] - b[key]) <= BOUNDS_TOLERANCE,
  );
}

export function useMapBoundsFilter(
  properties: readonly Property[],
  bounds: MapBounds | null,
  enabled: boolean,
): readonly Property[] {
  return useMemo(
    () => filterPropertiesByBounds(properties, bounds, enabled),
    [bounds, enabled, properties],
  );
}
