import { divIcon, type DivIcon } from "leaflet";
import { formatINR } from "@/lib/formatters";
import type { Property } from "@/types/property";

export function createPropertyIcon(property: Property, selected: boolean): DivIcon {
  return divIcon({
    className: `sat-map-marker${selected ? " is-selected" : ""}`,
    html: `<span>${formatINR(property.price, property.listingIntent)}</span>`,
    iconAnchor: [32, 20],
    iconSize: [64, 40],
  });
}

export function createClusterIcon(cluster: { getChildCount: () => number }): DivIcon {
  return divIcon({
    className: "sat-map-cluster",
    html: `<span>${cluster.getChildCount()}</span>`,
    iconAnchor: [24, 24],
    iconSize: [48, 48],
  });
}
