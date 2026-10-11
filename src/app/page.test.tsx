import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import Home from "./page";

const mapHarness = vi.hoisted(() => ({
  props: null as null | Record<string, unknown>,
  isDesktop: true,
}));

vi.mock("@/hooks/useMediaQuery", () => ({ useMediaQuery: () => mapHarness.isDesktop }));
vi.mock("@/components/map/PropertyMap", () => ({
  PropertyMap: (props: Record<string, unknown>) => {
    mapHarness.props = props;
    const properties = props.properties as { id: string }[];
    return <div data-testid="property-map" data-property-ids={properties.map(({ id }) => id).join(",")}><label><input checked={Boolean(props.searchAsMapMoves)} onChange={(event) => (props.onSearchAsMapMovesChange as (enabled: boolean) => void)(event.target.checked)} type="checkbox" />Search as I move the map</label><button onClick={() => (props.onBoundsChange as (bounds: object) => void)({ north: 21.16, south: 21.12, east: 79.1, west: 79.04 })}>Emit map bounds</button><button onClick={() => (props.onSelect as (id: string) => void)(properties[0]?.id)}>Select first marker</button><button onClick={() => (props.onSearchAsMapMovesChange as (enabled: boolean) => void)(false)}>Disable map search</button></div>;
  },
}));

beforeEach(() => {
  mapHarness.props = null;
  mapHarness.isDesktop = true;
});

it("exposes the SAT12 property results landmark", () => {
  render(<Home />);
  expect(
    screen.getByRole("main", { name: /nagpur property results/i }),
  ).toBeInTheDocument();
});

it("changes the real listing intent from the header navigation", async () => {
  const user = userEvent.setup();
  render(<Home />);

  await user.click(screen.getByRole("button", { name: "Rent" }));

  expect(screen.getByRole("combobox", { name: "Intent" })).toHaveValue("Rent");
  expect(screen.getByRole("status")).toHaveTextContent("2 properties found");
});

it("keeps all ordinary-filter markers while map bounds narrow listings", async () => {
  const user = userEvent.setup();
  render(<Home />);
  const initialMarkerIds = screen.getByTestId("property-map").getAttribute("data-property-ids");
  expect(initialMarkerIds?.split(",")).toHaveLength(7);
  await user.click(screen.getByRole("checkbox", { name: "Search as I move the map" }));
  await user.click(screen.getByRole("button", { name: "Emit map bounds" }));
  expect(screen.getByTestId("property-map")).toHaveAttribute("data-property-ids", initialMarkerIds);
  expect(screen.getByRole("status")).not.toHaveTextContent("7 properties found");
});

it("synchronizes card and marker selection", async () => {
  const user = userEvent.setup();
  render(<Home />);
  await user.click(screen.getByRole("button", { name: "Select first marker" }));
  expect(screen.getAllByTestId("property-card")[0].querySelector("button[aria-pressed='true']")).not.toBeNull();
  const secondCard = screen.getAllByTestId("property-card")[1];
  await user.click(secondCard.querySelector("button")!);
  expect(mapHarness.props?.selectedPropertyId).toBeTruthy();
});

it("defers the map in mobile list view and mounts it after switching", async () => {
  mapHarness.isDesktop = false;
  const user = userEvent.setup();
  render(<Home />);
  expect(screen.queryByTestId("property-map")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Map" }));
  expect(screen.getByTestId("property-map")).toBeInTheDocument();
});
