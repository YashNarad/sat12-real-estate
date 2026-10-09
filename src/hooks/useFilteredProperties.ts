"use client";

import { useMemo } from "react";
import type { Property, PropertyFiltersState } from "@/types/property";

export const DEFAULT_FILTERS: PropertyFiltersState = {
  query: "",
  intent: "Buy",
  propertyType: "All",
  maxPrice: null,
  bedrooms: null,
};

export function filterProperties(
  properties: readonly Property[],
  filters: PropertyFiltersState,
): Property[] {
  const query = filters.query.trim().toLocaleLowerCase("en-IN");

  return properties.filter((property) => {
    const searchableText = `${property.title} ${property.locality} ${property.city}`.toLocaleLowerCase("en-IN");
    const matchesQuery = query.length === 0 || searchableText.includes(query);
    const matchesIntent = property.listingIntent === filters.intent;
    const matchesType = filters.propertyType === "All" || property.propertyType === filters.propertyType;
    const matchesBudget = filters.maxPrice === null || property.price <= filters.maxPrice;
    const matchesBedrooms = filters.bedrooms === null
      || (filters.bedrooms === 4 ? property.bedrooms >= 4 : property.bedrooms === filters.bedrooms);

    return matchesQuery && matchesIntent && matchesType && matchesBudget && matchesBedrooms;
  });
}

export function useFilteredProperties(
  properties: readonly Property[],
  filters: PropertyFiltersState,
): Property[] {
  return useMemo(() => filterProperties(properties, filters), [properties, filters]);
}
