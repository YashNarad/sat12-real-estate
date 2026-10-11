import { act, renderHook } from "@testing-library/react";
import { expect, it } from "vitest";
import { NAGPUR_PROPERTIES } from "@/data/properties";
import { usePropertySelection } from "./usePropertySelection";

it("selects known property IDs and ignores unknown IDs", () => {
  const properties = NAGPUR_PROPERTIES.slice(0, 2);
  const { result } = renderHook(() => usePropertySelection(properties));

  act(() => result.current.selectProperty(properties[0].id));
  expect(result.current.selectedPropertyId).toBe(properties[0].id);
  expect(result.current.selectedProperty).toBe(properties[0]);

  act(() => result.current.selectProperty("missing-property"));
  expect(result.current.selectedPropertyId).toBe(properties[0].id);
});

it("clears selection when the selected property leaves the collection", () => {
  const selected = NAGPUR_PROPERTIES[0];
  const { result, rerender } = renderHook(
    ({ properties }) => usePropertySelection(properties),
    { initialProps: { properties: NAGPUR_PROPERTIES.slice(0, 2) } },
  );

  act(() => result.current.selectProperty(selected.id));
  rerender({ properties: NAGPUR_PROPERTIES.slice(1, 2) });

  expect(result.current.selectedPropertyId).toBeNull();
  expect(result.current.selectedProperty).toBeNull();
});

it("clears selection explicitly", () => {
  const { result } = renderHook(() => usePropertySelection(NAGPUR_PROPERTIES));
  act(() => result.current.selectProperty(NAGPUR_PROPERTIES[0].id));
  act(() => result.current.clearSelection());
  expect(result.current.selectedPropertyId).toBeNull();
});
