import { act, render } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { NAGPUR_PROPERTIES } from "@/data/properties";
import { MAP_FOCUS_ZOOM, NAGPUR_DEFAULT_BOUNDS } from "@/lib/mapConfig";
import { MapEventBridge, type MapControlsApi } from "./MapEventBridge";

let resizeCallback: ResizeObserverCallback | undefined;
const disconnectResizeObserver = vi.fn();

const mocks = vi.hoisted(() => {
  const map = {
    flyTo: vi.fn(), setView: vi.fn(), fitBounds: vi.fn(), zoomIn: vi.fn(), zoomOut: vi.fn(), invalidateSize: vi.fn(),
    getBounds: vi.fn(() => ({ getNorth: () => 21.2, getSouth: () => 21, getEast: () => 79.2, getWest: () => 79 })),
    getContainer: vi.fn(() => document.createElement("div")),
  };
  return { map, events: {} as Record<string, () => void> };
});

vi.mock("react-leaflet", () => ({
  useMap: () => mocks.map,
  useMapEvents: (events: Record<string, () => void>) => { mocks.events = events; return mocks.map; },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.events = {};
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callback(0); return 1; });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  resizeCallback = undefined;
  disconnectResizeObserver.mockClear();
  vi.stubGlobal("ResizeObserver", class {
    constructor(callback: ResizeObserverCallback) { resizeCallback = callback; }
    observe() {}
    disconnect() { disconnectResizeObserver(); }
  });
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
});

it("emits plain bounds on moveend only while map search is enabled", () => {
  const onBoundsChange = vi.fn();
  const props = { properties: NAGPUR_PROPERTIES, selectedProperty: null, visible: true, onBoundsChange, onMapReady: () => undefined };
  const { rerender } = render(<MapEventBridge {...props} searchAsMapMoves={false} />);
  act(() => mocks.events.moveend());
  expect(onBoundsChange).not.toHaveBeenCalled();
  rerender(<MapEventBridge {...props} searchAsMapMoves />);
  act(() => mocks.events.moveend());
  expect(onBoundsChange).toHaveBeenCalledWith({ north: 21.2, south: 21, east: 79.2, west: 79 });
});

it("focuses a newly selected property only once", () => {
  const selectedProperty = NAGPUR_PROPERTIES[0];
  const props = { properties: NAGPUR_PROPERTIES, selectedProperty, visible: true, searchAsMapMoves: false, onBoundsChange: () => undefined, onMapReady: () => undefined };
  const { rerender } = render(<MapEventBridge {...props} />);
  expect(mocks.map.flyTo).toHaveBeenCalledWith([selectedProperty.latitude, selectedProperty.longitude], MAP_FOCUS_ZOOM);
  rerender(<MapEventBridge {...props} />);
  expect(mocks.map.flyTo).toHaveBeenCalledOnce();
});

it("registers working zoom, bounds, and reset controls", () => {
  let controls: MapControlsApi | null = null;
  const { rerender } = render(<MapEventBridge properties={[]} selectedProperty={null} visible searchAsMapMoves={false} onBoundsChange={() => undefined} onMapReady={(value) => { controls = value; }} />);
  act(() => controls?.zoomIn());
  act(() => controls?.zoomOut());
  act(() => controls?.reset());
  expect(mocks.map.zoomIn).toHaveBeenCalledOnce();
  expect(mocks.map.zoomOut).toHaveBeenCalledOnce();
  expect(mocks.map.fitBounds).toHaveBeenLastCalledWith(NAGPUR_DEFAULT_BOUNDS, expect.any(Object));
  rerender(<MapEventBridge properties={NAGPUR_PROPERTIES.slice(0, 2)} selectedProperty={null} visible searchAsMapMoves={false} onBoundsChange={() => undefined} onMapReady={(value) => { controls = value; }} />);
  act(() => controls?.reset());
  expect(mocks.map.fitBounds).toHaveBeenLastCalledWith(expect.arrayContaining([[NAGPUR_PROPERTIES[0].latitude, NAGPUR_PROPERTIES[0].longitude]]), expect.any(Object));
});

it("invalidates map size on mount and visibility changes", () => {
  const props = { properties: [], selectedProperty: null, searchAsMapMoves: false, onBoundsChange: () => undefined, onMapReady: () => undefined };
  const { rerender } = render(<MapEventBridge {...props} visible={false} />);
  const mountCalls = mocks.map.invalidateSize.mock.calls.length;
  rerender(<MapEventBridge {...props} visible />);
  expect(mocks.map.invalidateSize.mock.calls.length).toBeGreaterThan(mountCalls);
});

it("invalidates after observed container resizing and disconnects on unmount", () => {
  const props = { properties: [], selectedProperty: null, searchAsMapMoves: false, onBoundsChange: () => undefined, onMapReady: () => undefined };
  const { unmount } = render(<MapEventBridge {...props} visible />);
  const beforeResize = mocks.map.invalidateSize.mock.calls.length;
  act(() => resizeCallback?.([], {} as ResizeObserver));
  expect(mocks.map.invalidateSize.mock.calls.length).toBeGreaterThan(beforeResize);
  unmount();
  expect(disconnectResizeObserver).toHaveBeenCalledOnce();
});
