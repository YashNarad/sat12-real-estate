import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Property } from "@/types/property";
import { PropertyResults } from "./PropertyResults";

const properties: Property[] = [
  { id: "high", title: "4 BHK Villa", listingIntent: "Buy", propertyType: "Villa", price: 18_000_000, locality: "Manish Nagar", city: "Nagpur", latitude: 21.09, longitude: 79.07, image: { src: "/images/properties/property-02.svg", alt: "Villa", license: "SAT12 placeholder" }, bedrooms: 4, bathrooms: 4, areaSqFt: 2800, status: "Under Construction", reraApproved: true },
  { id: "low", title: "3 BHK Apartment", listingIntent: "Buy", propertyType: "Apartment", price: 8_500_000, locality: "Dharampeth", city: "Nagpur", latitude: 21.14, longitude: 79.05, image: { src: "/images/properties/property-01.svg", alt: "Apartment", license: "SAT12 placeholder" }, bedrooms: 3, bathrooms: 2, areaSqFt: 1450, status: "Ready to Move", reraApproved: true },
];

describe("PropertyResults", () => {
  it("shows loading without a false empty state", () => {
    render(<PropertyResults properties={[]} isLoading selectedPropertyId={null} onSelect={() => undefined} onClearFilters={() => undefined} />);
    expect(screen.getByRole("status", { name: /loading properties/i })).toBeInTheDocument();
    expect(screen.queryByText(/no properties found/i)).not.toBeInTheDocument();
  });

  it("offers a working reset for empty results", async () => {
    const user = userEvent.setup();
    const onClearFilters = vi.fn();
    render(<PropertyResults properties={[]} isLoading={false} selectedPropertyId={null} onSelect={() => undefined} onClearFilters={onClearFilters} />);
    expect(screen.getByText(/no properties found/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /clear all filters/i }));
    expect(onClearFilters).toHaveBeenCalledOnce();
  });

  it("sorts properties by price and switches presentation", async () => {
    const user = userEvent.setup();
    render(<PropertyResults properties={properties} isLoading={false} selectedPropertyId={null} onSelect={() => undefined} onClearFilters={() => undefined} />);
    await user.selectOptions(screen.getByRole("combobox", { name: /sort properties/i }), "price-low");
    const cards = screen.getAllByTestId("property-card");
    expect(within(cards[0]).getByText("3 BHK Apartment")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /list view/i }));
    expect(screen.getByTestId("property-list")).toHaveAttribute("data-view", "list");
  });

  it("announces the loaded result count", () => {
    render(<PropertyResults properties={properties} isLoading={false} selectedPropertyId={null} onSelect={() => undefined} onClearFilters={() => undefined} />);
    expect(screen.getByRole("status")).toHaveTextContent("2 properties found");
  });

  it("eagerly loads the first above-the-fold property image", () => {
    render(<PropertyResults properties={properties} isLoading={false} selectedPropertyId={null} onSelect={() => undefined} onClearFilters={() => undefined} />);
    expect(screen.getByRole("img", { name: "Villa" })).toHaveAttribute("loading", "eager");
  });

  it("selects cards while favorite controls remain independent and keyboard accessible", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<PropertyResults properties={properties} isLoading={false} selectedPropertyId={null} onSelect={onSelect} onClearFilters={() => undefined} />);

    const favorite = screen.getByRole("button", { name: /save 4 bhk villa/i });
    favorite.focus();
    await user.keyboard("{Enter}");
    expect(favorite).toHaveAttribute("aria-pressed", "true");
    expect(onSelect).not.toHaveBeenCalled();

    const cardAction = screen.getByRole("button", { name: /view 4 bhk villa in manish nagar/i });
    cardAction.focus();
    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledWith("high");
    expect(cardAction.closest("button")?.querySelector("button")).toBeNull();
  });
});
