import { NAGPUR_PROPERTIES } from "@/data/properties";
import type { Property } from "@/types/property";

export type HomepageInventoryMode = "published" | "demo";

export interface HomepageInventory {
  readonly mode: HomepageInventoryMode;
  readonly properties: readonly Property[];
}

const DEVELOPMENT_DEMO_PROPERTIES = Object.freeze(NAGPUR_PROPERTIES.slice(0, 7));

export function selectHomepageInventory(
  publishedProperties: readonly Property[],
  environment: string | undefined,
): HomepageInventory {
  if (environment === "development" && publishedProperties.length === 0) {
    return { mode: "demo", properties: DEVELOPMENT_DEMO_PROPERTIES };
  }
  return { mode: "published", properties: publishedProperties };
}
