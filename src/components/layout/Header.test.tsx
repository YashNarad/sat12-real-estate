import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Header } from "./Header";

describe("Header", () => {
  it("shows only working primary navigation and the guarded listing destination", () => {
    render(<Header accountControl={<span>Account</span>} currentIntent="Buy" onIntentChange={() => undefined} />);

    expect(screen.getByRole("link", { name: "SAT12 home" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("button", { name: "Buy" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Rent" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("link", { name: "List Property" })).toHaveAttribute("href", "/dashboard/properties/new");

    for (const label of ["Saved", "Alerts", "Builders", "Insights", "New Projects", "Locations"]) {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    }
  });

  it("supports keyboard intent selection", async () => {
    const user = userEvent.setup();
    const onIntentChange = vi.fn();
    render(<Header accountControl={<span>Account</span>} currentIntent="Buy" onIntentChange={onIntentChange} />);

    const rent = screen.getByRole("button", { name: "Rent" });
    rent.focus();
    await user.keyboard("{Enter}");

    expect(onIntentChange).toHaveBeenCalledWith("Rent");
  });
});
