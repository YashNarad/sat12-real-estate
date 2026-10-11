import { useCallback, useMemo, useState } from "react";
import type { Property } from "@/types/property";

export interface PropertySelection {
  selectedPropertyId: string | null;
  selectedProperty: Property | null;
  selectProperty: (id: string) => void;
  clearSelection: () => void;
}

export function usePropertySelection(properties: readonly Property[]): PropertySelection {
  const [selectionState, setSelectionState] = useState<{
    propertyId: string | null;
    source: readonly Property[];
  }>({ propertyId: null, source: properties });

  if (selectionState.source !== properties) {
    const propertyId = properties.some(({ id }) => id === selectionState.propertyId)
      ? selectionState.propertyId
      : null;
    setSelectionState({ propertyId, source: properties });
  }

  const selectedPropertyId = selectionState.propertyId;

  const selectedProperty = useMemo(
    () => properties.find(({ id }) => id === selectedPropertyId) ?? null,
    [properties, selectedPropertyId],
  );

  const selectProperty = useCallback(
    (id: string) => {
      if (properties.some((property) => property.id === id)) {
        setSelectionState({ propertyId: id, source: properties });
      }
    },
    [properties],
  );

  const clearSelection = useCallback(
    () => setSelectionState({ propertyId: null, source: properties }),
    [properties],
  );

  return { selectedPropertyId, selectedProperty, selectProperty, clearSelection };
}
