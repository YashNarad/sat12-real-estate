import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { PropertyExplorer } from "@/components/properties/PropertyExplorer";
import { NAGPUR_PROPERTIES } from "@/data/properties";

const mapHarness = vi.hoisted(() => ({
  props: null as null | Record<string, unknown>,
  isDesktop: true,
}));

vi.mock("@/hooks/useMediaQuery", () => ({ useMediaQuery: () => mapHarness.isDesktop }));
vi.mock("@/components/map/PropertyMap", () => ({
  PropertyMap: (props: Record<string, unknown>) => {
    mapHarness.props = props;
    const properties = props.properties as { id: string }[];
    return <div data-testid="property-map" data-property-ids={properties.map(({ id }) => id).join(",")}><label><input checked={Boolean(props.searchAsMapMoves)} onChange={(event) => (props.onSearchAsMapMovesChange as (enabled: boolean) => void)(event.target.checked)} type="checkbox" />Search as I move the map</label><button onClick={() => (props.onBoundsChange as (bounds: object) => void)({ north: 21.16, south: 21.12, east: 79.1, west: 79.04 })}>Emit map bounds</button><button onClick={() => (props.onSelect as (id: string) => void)(properties[0]?.id)}>Select first marker</button><button onClick={() => (props.onViewProperty as (id: string) => void)(properties[1]?.id)}>View second property in list</button><button onClick={() => (props.onViewProperty as (id: string) => void)("missing-property")}>View missing property in list</button><button onClick={() => (props.onSearchAsMapMovesChange as (enabled: boolean) => void)(false)}>Disable map search</button></div>;
  },
}));

beforeEach(() => {
  mapHarness.props = null;
  mapHarness.isDesktop = true;
});

function renderHome() {
  return render(<PropertyExplorer accountControl={<span>Account</span>} initialProperties={NAGPUR_PROPERTIES} inventoryMode="published" />);
}

it("exposes the SAT12 property results landmark", () => {
  renderHome();
  expect(
    screen.getByRole("main", { name: /nagpur property results/i }),
  ).toBeInTheDocument();
});

it("changes the real listing intent from the header navigation", async () => {
  const user = userEvent.setup();
  renderHome();

  await user.click(screen.getByRole("button", { name: "Rent" }));

  expect(screen.getByRole("combobox", { name: "Intent" })).toHaveValue("Rent");
  expect(screen.getByRole("status")).toHaveTextContent("2 properties found");
});

it("keeps all ordinary-filter markers while map bounds narrow listings", async () => {
  const user = userEvent.setup();
  renderHome();
  const initialMarkerIds = screen.getByTestId("property-map").getAttribute("data-property-ids");
  expect(initialMarkerIds?.split(",")).toHaveLength(7);
  await user.click(screen.getByRole("checkbox", { name: "Search as I move the map" }));
  await user.click(screen.getByRole("button", { name: "Emit map bounds" }));
  expect(screen.getByTestId("property-map")).toHaveAttribute("data-property-ids", initialMarkerIds);
  expect(screen.getByRole("status")).not.toHaveTextContent("7 properties found");
});

it("synchronizes card and marker selection", async () => {
  const user = userEvent.setup();
  renderHome();
  await user.click(screen.getByRole("button", { name: "Select first marker" }));
  expect(screen.getAllByTestId("property-card")[0].querySelector("button[aria-pressed='true']")).not.toBeNull();
  const secondCard = screen.getAllByTestId("property-card")[1];
  await user.click(secondCard.querySelector("button")!);
  expect(mapHarness.props?.selectedPropertyId).toBeTruthy();
});

it("focuses and highlights the exact property requested by a map popup", async () => {
  const user = userEvent.setup();
  renderHome();
  const target = screen.getAllByTestId("property-card")[1];
  target.scrollIntoView = vi.fn();

  await user.click(screen.getByRole("button", { name: "View second property in list" }));

  expect(target).toHaveFocus();
  expect(target).toHaveAttribute("data-selected", "true");
  expect(target.scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });
  expect(screen.getByRole("status", { name: "Property navigation status" })).toHaveTextContent(/showing 4 bhk villa/i);
});

it("keeps map-to-card navigation working in list presentation", async () => {
  const user = userEvent.setup();
  renderHome();
  await user.click(screen.getByRole("button", { name: /list view/i }));
  await user.click(screen.getByRole("button", { name: "View second property in list" }));
  expect(screen.getByTestId("property-list")).toHaveAttribute("data-view", "list");
  expect(screen.getAllByTestId("property-card")[1]).toHaveFocus();
});

it("announces when a requested property is not present instead of failing silently", async () => {
  const user = userEvent.setup();
  renderHome();
  await user.click(screen.getByRole("button", { name: "View missing property in list" }));
  expect(screen.getByRole("status", { name: "Property navigation status" })).toHaveTextContent(/not visible with the current filters/i);
});

it("defers the map in mobile list view and mounts it after switching", async () => {
  mapHarness.isDesktop = false;
  const user = userEvent.setup();
  renderHome();
  expect(screen.queryByTestId("property-map")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Map" }));
  expect(screen.getByTestId("property-map")).toBeInTheDocument();
});

it("switches from the mobile map to the list before focusing a property", async () => {
  mapHarness.isDesktop = false;
  const user = userEvent.setup();
  renderHome();
  await user.click(screen.getByRole("button", { name: "Map" }));
  await user.click(screen.getByRole("button", { name: "View second property in list" }));
  expect(screen.getAllByTestId("property-card")[1]).toBeVisible();
  expect(screen.getAllByTestId("property-card")[1]).toHaveFocus();
});

it("shows a truthful inventory state instead of mock listings when Supabase returns no rows", () => {
  render(<PropertyExplorer accountControl={<span>Account</span>} initialProperties={[]} inventoryMode="published" />);
  expect(screen.getByRole("heading", { name: "No published properties yet" })).toBeInTheDocument();
  expect(screen.queryAllByTestId("property-card")).toHaveLength(0);
  expect(screen.queryByRole("button", { name: "Clear all filters" })).not.toBeInTheDocument();
});

it("labels seven development demos while preserving Buy and Rent filtering", async () => {
  const user = userEvent.setup();
  render(<PropertyExplorer accountControl={<span>Account</span>} initialProperties={NAGPUR_PROPERTIES.slice(0, 7)} inventoryMode="demo" />);
  expect(screen.getByRole("status", { name: "Demo listings notice" })).toHaveTextContent("sample listings for development");
  expect(screen.getAllByTestId("property-card")).toHaveLength(5);
  expect(screen.getByTestId("property-map")).toHaveAttribute("data-property-ids", NAGPUR_PROPERTIES.slice(0, 5).map(({ id }) => id).join(","));
  await user.click(screen.getByRole("button", { name: "Rent" }));
  expect(screen.getAllByTestId("property-card")).toHaveLength(2);
});

it("does not show the demo notice for published inventory", () => {
  renderHome();
  expect(screen.queryByRole("status", { name: "Demo listings notice" })).not.toBeInTheDocument();
});
