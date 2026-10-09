import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { Header } from "@/components/layout/Header";
import { DEFAULT_FILTERS } from "@/hooks/useFilteredProperties";
import type { PropertyFiltersState } from "@/types/property";
import { PropertyFilters } from "./PropertyFilters";

function FilterHarness() {
  const [filters, setFilters] = useState<PropertyFiltersState>(DEFAULT_FILTERS);
  return (
    <>
      <PropertyFilters value={filters} onChange={setFilters} onSearch={() => undefined} />
      <output role="status">{JSON.stringify(filters)}</output>
    </>
  );
}

describe("PropertyFilters", () => {
  it("updates query and property type in controlled state", async () => {
    const user = userEvent.setup();
    render(<FilterHarness />);

    await user.type(screen.getByRole("searchbox", { name: /search location/i }), "Dharampeth");
    await user.selectOptions(screen.getByRole("combobox", { name: /property type/i }), "Villa");

    expect(screen.getByRole("status")).toHaveTextContent('"query":"Dharampeth"');
    expect(screen.getByRole("status")).toHaveTextContent('"propertyType":"Villa"');
  });

  it("restores the default filters", async () => {
    const user = userEvent.setup();
    render(<FilterHarness />);

    await user.selectOptions(screen.getByRole("combobox", { name: /intent/i }), "Rent");
    const clearButton = screen.getByRole("button", { name: /clear filters/i });
    expect(clearButton).toHaveTextContent("Clear filters");
    await user.click(clearButton);

    expect(screen.getByRole("status")).toHaveTextContent(JSON.stringify(DEFAULT_FILTERS));
  });
});

it("renders the primary SAT12 navigation", () => {
  render(<Header currentIntent="Buy" onIntentChange={() => undefined} />);
  const navigation = screen.getByRole("navigation", { name: /primary/i });
  for (const label of ["Buy", "Rent", "New Projects", "Builders", "Locations", "Insights"]) {
    expect(navigation).toHaveTextContent(label);
  }
});
