import { expect, it } from "vitest";
import { NAGPUR_PROPERTIES } from "@/data/properties";
import { createClusterIcon, createPropertyIcon } from "./mapIcons";

it("creates distinct compact price marker icons", () => {
  const property = NAGPUR_PROPERTIES[0];
  const normal = createPropertyIcon(property, false);
  const selected = createPropertyIcon(property, true);
  expect(normal.options.className).toContain("sat-map-marker");
  expect(normal.options.className).not.toContain("is-selected");
  expect(selected.options.className).toContain("is-selected");
  expect(String(normal.options.html)).toMatch(/₹/);
});

it("creates a counted SAT12 cluster icon", () => {
  const icon = createClusterIcon({ getChildCount: () => 12 });
  expect(icon.options.className).toContain("sat-map-cluster");
  expect(icon.options.html).toBe("<span>12</span>");
});
