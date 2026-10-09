import type { Property } from "@/types/property";
import { PropertyCard } from "./PropertyCard";

interface PropertyGridProps {
  properties: readonly Property[];
  view: "grid" | "list";
  selectedPropertyId: string | null;
  favoriteIds: ReadonlySet<string>;
  onSelect: (id: string) => void;
  onToggleFavorite: (id: string) => void;
}

export function PropertyGrid(props: PropertyGridProps) {
  return <div className="property-grid" data-testid="property-list" data-view={props.view}>{props.properties.map((property) => <PropertyCard favorite={props.favoriteIds.has(property.id)} key={property.id} onSelect={props.onSelect} onToggleFavorite={props.onToggleFavorite} property={property} selected={props.selectedPropertyId === property.id} view={props.view} />)}</div>;
}
