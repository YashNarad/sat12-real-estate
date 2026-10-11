import type { MapBounds } from "@/types/map";

export const NAGPUR_CENTER: readonly [number, number] = [21.1458, 79.0882];
export const NAGPUR_DEFAULT_BOUNDS: readonly [
  readonly [number, number],
  readonly [number, number],
] = [
  [20.98, 78.94],
  [21.25, 79.2],
];
export const NAGPUR_DEFAULT_MAP_BOUNDS: MapBounds = {
  south: NAGPUR_DEFAULT_BOUNDS[0][0],
  west: NAGPUR_DEFAULT_BOUNDS[0][1],
  north: NAGPUR_DEFAULT_BOUNDS[1][0],
  east: NAGPUR_DEFAULT_BOUNDS[1][1],
};
export const MAP_MIN_ZOOM = 10;
export const MAP_MAX_ZOOM = 18;
export const MAP_FOCUS_ZOOM = 15;
export const MAP_FIT_PADDING: readonly [number, number] = [28, 28];
