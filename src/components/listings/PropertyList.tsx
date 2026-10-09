import type { Property } from "@/types/property";
import { PropertyGrid } from "./PropertyGrid";

interface PropertyListProps {
  properties: readonly Property[];
  view: "grid" | "list";
  selectedPropertyId: string | null;
  favoriteIds: ReadonlySet<string>;
  onSelect: (id: string) => void;
  onToggleFavorite: (id: string) => void;
}

export function PropertyList(props: PropertyListProps) {
  return <PropertyGrid {...props} />;
}
