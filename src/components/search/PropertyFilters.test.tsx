import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { DEFAULT_FILTERS } from "@/hooks/useFilteredProperties";
import type { PropertyFiltersState } from "@/types/property";
import { PropertyFilters } from "./PropertyFilters";

function FilterHarness() {
  const [filters, setFilters] = useState<PropertyFiltersState>(DEFAULT_FILTERS);
  return (
    <>
      <PropertyFilters value={filters} onChange={setFilters} />
      <output role="status">{JSON.stringify(filters)}</output>
    </>
  );
}

describe("PropertyFilters", () => {
  it("applies search text immediately without a redundant submit control", async () => {
    const user = userEvent.setup();
    render(<FilterHarness />);

    await user.type(screen.getByRole("searchbox", { name: /search location/i }), "Dharampeth");

    expect(screen.getByRole("status")).toHaveTextContent('"query":"Dharampeth"');
    expect(screen.queryByRole("button", { name: /search properties/i })).not.toBeInTheDocument();
  });

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
