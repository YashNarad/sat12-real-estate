import { describe, expect, it } from "vitest";

import { NAGPUR_PROPERTIES } from "@/data/properties";
import { selectHomepageInventory } from "./homepage-inventory";

describe("selectHomepageInventory", () => {
  it("uses exactly seven illustrative demo listings after a successful empty development query", () => {
    const result = selectHomepageInventory([], "development");
    expect(result.mode).toBe("demo");
    expect(result.properties).toEqual(NAGPUR_PROPERTIES.slice(0, 7));
    expect(result.properties).toHaveLength(7);
    expect(result.properties.every(({ image }) => image.kind === "illustrative")).toBe(true);
  });

  it("uses published inventory without mixing in demo properties", () => {
    const published = [NAGPUR_PROPERTIES[8]];
    expect(selectHomepageInventory(published, "development")).toEqual({ mode: "published", properties: published });
  });

  it("keeps a genuine empty inventory in production and test environments", () => {
    expect(selectHomepageInventory([], "production")).toEqual({ mode: "published", properties: [] });
    expect(selectHomepageInventory([], "test")).toEqual({ mode: "published", properties: [] });
  });
});
