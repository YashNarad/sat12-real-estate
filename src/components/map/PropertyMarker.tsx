"use client";

import { useMemo } from "react";
import { Marker } from "react-leaflet";
import type { Property } from "@/types/property";
import { createPropertyIcon } from "./mapIcons";

interface PropertyMarkerProps {
  property: Property;
  selected: boolean;
  onSelect: (id: string) => void;
}

export function PropertyMarker({ property, selected, onSelect }: PropertyMarkerProps) {
  const icon = useMemo(() => createPropertyIcon(property, selected), [property, selected]);
  const label = `${property.title}, ${property.locality}, Nagpur`;
  return (
    <Marker
      alt={label}
      eventHandlers={{ click: () => onSelect(property.id) }}
      icon={icon}
      keyboard
      position={[property.latitude, property.longitude]}
      riseOnHover
      title={label}
      zIndexOffset={selected ? 1000 : 0}
    />
  );
}
