import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { NAGPUR_PROPERTIES } from "@/data/properties";
import { PropertyMapClient } from "./PropertyMapClient";

vi.mock("react-leaflet", () => ({
  MapContainer: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <div data-testid="map-container" {...props}>{children}</div>,
  TileLayer: ({ attribution, eventHandlers }: { attribution: string; eventHandlers?: { tileerror?: () => void; tileload?: () => void } }) => <><button data-testid="tiles" onClick={() => eventHandlers?.tileerror?.()}>{attribution}</button><button data-testid="tile-recovered" onClick={() => eventHandlers?.tileload?.()}>Tile loaded</button></>,
}));
vi.mock("react-leaflet-cluster", () => ({ default: ({ children }: React.PropsWithChildren) => <div data-testid="cluster">{children}</div> }));
vi.mock("./PropertyMarker", () => ({ PropertyMarker: ({ property }: { property: { id: string } }) => <span data-testid={`marker-${property.id}`} /> }));
vi.mock("./MapEventBridge", () => ({ MapEventBridge: () => null }));

it("renders clustered markers, controls, preview, and attribution", () => {
  const properties = NAGPUR_PROPERTIES.slice(0, 2);
  render(<PropertyMapClient properties={properties} selectedPropertyId={properties[0].id} searchAsMapMoves={false} visible onSelect={() => undefined} onClearSelection={() => undefined} onSearchAsMapMovesChange={() => undefined} onBoundsChange={() => undefined} onViewProperty={() => undefined} />);
  expect(screen.getByTestId("cluster")).toBeInTheDocument();
  expect(screen.getAllByTestId(/marker-/)).toHaveLength(2);
  expect(screen.getByText(/OpenStreetMap contributors/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Zoom in" })).toBeInTheDocument();
  expect(screen.getByRole("region", { name: "Selected property preview" })).toBeInTheDocument();
});

it("announces tile failure without removing map overlays", async () => {
  const user = userEvent.setup();
  render(<PropertyMapClient properties={NAGPUR_PROPERTIES.slice(0, 1)} selectedPropertyId={null} searchAsMapMoves={false} visible onSelect={() => undefined} onClearSelection={() => undefined} onSearchAsMapMovesChange={() => undefined} onBoundsChange={() => undefined} onViewProperty={() => undefined} />);
  await user.click(screen.getByTestId("tiles"));
  expect(screen.getByRole("status")).toHaveTextContent(/background map could not load/i);
  expect(screen.getByTestId("cluster")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Zoom in" })).toBeInTheDocument();
  expect(screen.getByText(/OpenStreetMap contributors/)).toBeInTheDocument();
});

it("removes the tile warning when tiles recover", async () => {
  const user = userEvent.setup();
  render(<PropertyMapClient properties={[]} selectedPropertyId={null} searchAsMapMoves={false} visible onSelect={() => undefined} onClearSelection={() => undefined} onSearchAsMapMovesChange={() => undefined} onBoundsChange={() => undefined} onViewProperty={() => undefined} />);
  await user.click(screen.getByTestId("tiles"));
  expect(screen.getByRole("status")).toBeInTheDocument();
  await user.click(screen.getByTestId("tile-recovered"));
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});
