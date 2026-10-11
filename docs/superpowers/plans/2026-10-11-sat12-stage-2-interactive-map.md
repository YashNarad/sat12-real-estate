# SAT12 Stage 2 Interactive Property Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Stage 1 map placeholder with a client-only, clustered, synchronized Nagpur property map while preserving every existing SAT12 listing and filter behavior.

**Architecture:** `page.tsx` remains the single coordinator for serializable filters, selected ID, map bounds, map-search state, and mobile view. A small Client Component dynamically imports the Leaflet implementation with `ssr: false`; pure bounds/selection utilities sit outside Leaflet so they can be tested in jsdom and later reused with backend-supplied property arrays.

**Tech Stack:** Next.js App Router 16.4, React 19, TypeScript, Tailwind CSS 4, React Leaflet 5, Leaflet 1.9, react-leaflet-cluster 4, Vitest, Testing Library, OpenStreetMap raster tiles.

**Spec:** `docs/superpowers/specs/2026-10-11-sat12-stage-2-interactive-map-design.md`

## Global Constraints

- Preserve SAT12 red `#DC0011`, charcoal `#18181B`, secondary text `#71717A`, border `#E4E4E7`, canvas `#F7F7F8`, and white `#FFFFFF`.
- Preserve all Stage 1 navigation, Buy/Rent filtering, search filters, sorting, grid/list switching, favorites, loading state, empty state, responsive property columns, local imagery, and keyboard-accessible card structure.
- Desktop remains approximately 30% map and 70% listings; the results pane continues to control one/two/three columns through container width.
- Mobile shows one primary surface at a time with a Map/List toggle; initial mobile view is List.
- React Leaflet must load only through a Client Component containing `next/dynamic(..., { ssr: false })` at module scope.
- `useFilteredProperties` remains independent of the mock data source; map bounds filter the output of that hook rather than importing `NAGPUR_PROPERTIES`.
- Use `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png` only for normal interactive viewing and keep visible `&copy; OpenStreetMap contributors` attribution.
- Search-as-map-moves defaults off and updates bounds on `moveend`, never continuous `move`; bounds narrow listings only, while markers always receive all ordinary-filter matches.
- Do not add Supabase, authentication, payments, geocoding, routing, user-location permission, or persistent favorites.
- Follow the installed Next.js 16.4 guidance in `node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md` and `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-client.md` before implementation.

## File map

- Create `src/types/map.ts`: serializable `MapBounds` and `MobileResultsView` contracts.
- Create `src/lib/mapConfig.ts`: Nagpur center/default bounds, fit padding, and zoom limits.
- Create `src/hooks/useMapBoundsFilter.ts`: pure coordinate/bounds functions and memoized hook.
- Create `src/hooks/useMediaQuery.ts`: hydration-safe responsive map mount decision.
- Create `src/hooks/usePropertySelection.ts`: selected-ID lifecycle and derived property.
- Create `src/components/map/PropertyMap.tsx`: dynamic client-only boundary and fallback.
- Create `src/components/map/PropertyMapClient.tsx`: Leaflet container, tiles, clusters, overlays.
- Create `src/components/map/PropertyMarker.tsx`: marker rendering and marker selection.
- Create `src/components/map/MapEventBridge.tsx`: `moveend`, focus, reset, and bounds bridge.
- Create `src/components/map/MapControls.tsx`: zoom/reset/map-search controls.
- Create `src/components/map/MapPreviewCard.tsx`: selected-property map overlay.
- Create `src/components/map/mapIcons.ts`: selected/unselected price icons and cluster icons.
- Create `src/components/mobile/ViewToggle.tsx`: mobile Map/List segmented control.
- Modify `src/app/page.tsx`: replace placeholder and coordinate shared state.
- Modify `src/app/globals.css`: Leaflet import plus SAT12 marker/cluster/control styles.
- Modify `src/components/listings/PropertyResults.tsx`: accept optional map-aware empty-state message without moving its existing local presentation state.
- Modify `src/components/listings/PropertyCard.tsx`: expose `aria-pressed` on the existing selection button.
- Modify `package.json` and `package-lock.json`: add compatible map dependencies.
- Add focused tests beside hooks/components plus page coordination coverage.

## Review Focus

- A property exactly on a north/south/east/west bounds edge remains visible; covered in Task 2 bounds tests.
- Turning map search off restores all filter-matched properties without changing ordinary filters; covered in Task 5 page tests.
- Programmatic marker focus while map search is enabled does not enter a bounds/selection update loop; covered in Task 4 event-bridge tests.
- Map visibility/container resizing schedules `invalidateSize()`; covered in Task 4 bridge tests.
- Tile loading failure keeps overlays and attribution mounted and announces a non-blocking accessible status; covered in Tasks 4 and 6.
- Filtering out the selected property clears the preview and selected marker; covered in Tasks 2 and 5.
- Mobile card selection switches to Map, while preview “View property” returns to List without losing selection; covered in Task 5.

---

### Task 1: Install the map stack and establish the client-only boundary

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/components/map/PropertyMap.tsx`
- Create: `src/components/map/PropertyMap.test.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes: `Property[]`, selected property ID, and serializable callbacks from later page integration.
- Produces: `PropertyMap(props: PropertyMapProps)` as the only component imported by `page.tsx`; `PropertyMapClient` remains the dynamic target.

- [ ] **Step 1: Install compatible dependencies**

Run:

```powershell
npm install leaflet@^1.9.4 react-leaflet@^5.0.0 react-leaflet-cluster@^4.1.3
npm install -D @types/leaflet@^1.9.22
```

Expected: npm resolves React 19 peer dependencies without `--legacy-peer-deps`; only `package.json` and `package-lock.json` change.

- [ ] **Step 2: Write the client-boundary test before the component**

Create `src/components/map/PropertyMap.test.tsx`. Mock `next/dynamic` so it records the options and returns a harmless component without importing Leaflet:

```tsx
import { render } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

const { dynamicSpy } = vi.hoisted(() => ({
  dynamicSpy: vi.fn(() => function DynamicMapStub() { return null; }),
}));

vi.mock("next/dynamic", () => ({ default: dynamicSpy }));

beforeEach(() => dynamicSpy.mockClear());

it("declares a client-only dynamic map boundary", async () => {
  const { PropertyMap } = await import("./PropertyMap");
  render(<PropertyMap properties={[]} selectedPropertyId={null} onSelect={() => undefined} onClearSelection={() => undefined} onBoundsChange={() => undefined} onSearchAsMapMovesChange={() => undefined} onViewProperty={() => undefined} searchAsMapMoves={false} />);
  expect(dynamicSpy).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ ssr: false }));
});
```

- [ ] **Step 3: Run the focused test and verify RED**

Run: `npm test -- src/components/map/PropertyMap.test.tsx`

Expected: FAIL because `PropertyMap.tsx` does not exist.

- [ ] **Step 4: Add the exact public props and dynamic wrapper**

Create `PropertyMap.tsx` with `"use client"` first, a module-scope dynamic import, and this public interface:

```tsx
export interface PropertyMapProps {
  properties: readonly Property[];
  selectedPropertyId: string | null;
  searchAsMapMoves: boolean;
  onSelect: (id: string) => void;
  onClearSelection: () => void;
  onSearchAsMapMovesChange: (enabled: boolean) => void;
  onBoundsChange: (bounds: MapBounds) => void;
  onViewProperty: (id: string) => void;
}

const DynamicPropertyMap = dynamic(
  () => import("./PropertyMapClient").then((module) => module.PropertyMapClient),
  {
    ssr: false,
    loading: () => <div aria-label="Loading interactive map" className="map-placeholder grid h-full min-h-[520px] place-items-center" role="status">Loading interactive map…</div>,
  },
);
```

Temporarily create `PropertyMapClient.tsx` as a typed placeholder that renders `null`; Task 4 replaces it. Import Leaflet CSS in `globals.css` with `@import "leaflet/dist/leaflet.css";` before SAT12 overrides.

- [ ] **Step 5: Run the focused test and static checks**

Run: `npm test -- src/components/map/PropertyMap.test.tsx && npm run lint && npm run typecheck`

Expected: test passes; lint and TypeScript exit 0; no Leaflet browser global is evaluated by Vitest.

- [ ] **Step 6: Commit the independently reviewable boundary**

```powershell
git add package.json package-lock.json src/components/map/PropertyMap.tsx src/components/map/PropertyMapClient.tsx src/components/map/PropertyMap.test.tsx src/app/globals.css
git commit -m "chore: add client-only Leaflet boundary"
```

---

### Task 2: Add serializable bounds filtering and selection lifecycle

**Files:**
- Create: `src/types/map.ts`
- Create: `src/lib/mapConfig.ts`
- Create: `src/hooks/useMapBoundsFilter.ts`
- Create: `src/hooks/useMapBoundsFilter.test.ts`
- Create: `src/hooks/usePropertySelection.ts`
- Create: `src/hooks/usePropertySelection.test.tsx`

**Interfaces:**
- Produces: `MapBounds`, `MobileResultsView`, `NAGPUR_CENTER`, `NAGPUR_DEFAULT_BOUNDS`, `propertyIsWithinBounds`, `filterPropertiesByBounds`, `sameMapBounds`, `useMapBoundsFilter`, and `usePropertySelection`.
- Consumes: the existing `Property` contract and arbitrary property arrays.

- [ ] **Step 1: Write failing pure bounds tests**

Create fixtures at the center, on every exact edge, and outside the viewport. Assert:

```ts
const bounds = { north: 21.2, south: 21.0, east: 79.2, west: 79.0 };

expect(propertyIsWithinBounds(propertyAt(21.1, 79.1), bounds)).toBe(true);
expect(propertyIsWithinBounds(propertyAt(21.2, 79.2), bounds)).toBe(true);
expect(propertyIsWithinBounds(propertyAt(20.99, 79.1), bounds)).toBe(false);
expect(filterPropertiesByBounds(properties, null, false)).toEqual(properties);
expect(filterPropertiesByBounds(properties, bounds, true).map((property) => property.id)).toEqual(["inside", "edge"]);
expect(sameMapBounds(bounds, { ...bounds })).toBe(true);
```

- [ ] **Step 2: Write failing selection lifecycle tests**

Use `renderHook` and `rerender` to assert that selecting an existing ID exposes the matching property, selecting an unknown ID is ignored, and removing the selected property from the input array clears both ID and property.

- [ ] **Step 3: Run both hook tests and verify RED**

Run: `npm test -- src/hooks/useMapBoundsFilter.test.ts src/hooks/usePropertySelection.test.tsx`

Expected: FAIL because the modules do not exist.

- [ ] **Step 4: Implement map types and constants**

Use these exact contracts:

```ts
export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export type MobileResultsView = "list" | "map";

export const NAGPUR_CENTER: readonly [number, number] = [21.1458, 79.0882];
export const NAGPUR_DEFAULT_BOUNDS: readonly [readonly [number, number], readonly [number, number]] = [
  [20.98, 78.94],
  [21.25, 79.20],
];
export const MAP_MIN_ZOOM = 10;
export const MAP_MAX_ZOOM = 18;
```

- [ ] **Step 5: Implement inclusive bounds logic and the memoized hook**

`propertyIsWithinBounds` must use inclusive comparisons. `filterPropertiesByBounds(properties, bounds, enabled)` returns the original array values unchanged when disabled or `bounds` is null, and filters only when both are active. `sameMapBounds` compares the four numbers with a `1e-6` tolerance so repeated `moveend` events do not cause state churn.

- [ ] **Step 6: Implement ID-based selection**

Use this public return shape:

```ts
interface PropertySelection {
  selectedPropertyId: string | null;
  selectedProperty: Property | null;
  selectProperty: (id: string) => void;
  clearSelection: () => void;
}

export function usePropertySelection(properties: readonly Property[]): PropertySelection;
```

The hook derives `selectedProperty` with `useMemo`; an effect clears the ID when it no longer exists in `properties`; callbacks use `useCallback`.

- [ ] **Step 7: Run tests and static checks**

Run: `npm test -- src/hooks/useMapBoundsFilter.test.ts src/hooks/usePropertySelection.test.tsx && npm run lint && npm run typecheck`

Expected: all edge, disabled, equality, unknown-ID, and removal cases pass.

- [ ] **Step 8: Commit**

```powershell
git add src/types/map.ts src/lib/mapConfig.ts src/hooks/useMapBoundsFilter.ts src/hooks/useMapBoundsFilter.test.ts src/hooks/usePropertySelection.ts src/hooks/usePropertySelection.test.tsx
git commit -m "feat: add map bounds and property selection state"
```

---

### Task 3: Build accessible controls, preview, and mobile view toggle

**Files:**
- Create: `src/components/map/MapControls.tsx`
- Create: `src/components/map/MapControls.test.tsx`
- Create: `src/components/map/MapPreviewCard.tsx`
- Create: `src/components/map/MapPreviewCard.test.tsx`
- Create: `src/components/mobile/ViewToggle.tsx`
- Create: `src/components/mobile/ViewToggle.test.tsx`

**Interfaces:**
- Produces: `MapControls`, `MapPreviewCard`, and `ViewToggle` as Leaflet-independent React UI.
- Consumes: `Property`, `MobileResultsView`, formatter functions, and callbacks supplied by the map/page.

- [ ] **Step 1: Write failing controls tests**

Render `MapControls` and assert buttons named “Zoom in”, “Zoom out”, and “Reset map” call their callbacks once. Toggle the checkbox named “Search as I move the map” and assert `onSearchAsMapMovesChange(true)`.

- [ ] **Step 2: Write failing preview tests**

Render a known property and assert its title, formatted INR price, locality, and area are present. Activate “Close property preview” and “View property in list” and assert their callbacks. Confirm no preview renders for `property={null}`.

- [ ] **Step 3: Write failing mobile toggle tests**

For `value="list"`, assert List has `aria-pressed="true"`, Map has `aria-pressed="false"`, and activating Map calls `onChange("map")`. Repeat the pressed-state assertion for `value="map"`.

- [ ] **Step 4: Run the three test files and verify RED**

Run: `npm test -- src/components/map/MapControls.test.tsx src/components/map/MapPreviewCard.test.tsx src/components/mobile/ViewToggle.test.tsx`

Expected: FAIL because the components do not exist.

- [ ] **Step 5: Implement controls with native elements**

Use this shape:

```ts
interface MapControlsProps {
  searchAsMapMoves: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  onSearchAsMapMovesChange: (enabled: boolean) => void;
}
```

Controls are absolutely positioned SAT12 surfaces with 44px buttons, Lucide icons marked `aria-hidden`, and a labeled native checkbox. Do not nest controls inside links or other buttons.

- [ ] **Step 6: Implement the ordinary React preview overlay**

Use `next/image`, the existing `formatINR`/`formatArea`, and sibling buttons. Add `role="region"`, `aria-label="Selected property preview"`, a close button, and a red “View property” button. The card must be usable outside Leaflet so jsdom tests never import map code.

- [ ] **Step 7: Implement the mobile segmented control**

Render two native buttons with `aria-pressed`, minimum 44px height, SAT12 red active treatment, visible focus styles, and labels “List” and “Map.” The component owns no responsive detection or state.

- [ ] **Step 8: Run tests and static checks**

Run: `npm test -- src/components/map/MapControls.test.tsx src/components/map/MapPreviewCard.test.tsx src/components/mobile/ViewToggle.test.tsx && npm run lint && npm run typecheck`

Expected: all interaction and pressed-state cases pass.

- [ ] **Step 9: Commit**

```powershell
git add src/components/map/MapControls.tsx src/components/map/MapControls.test.tsx src/components/map/MapPreviewCard.tsx src/components/map/MapPreviewCard.test.tsx src/components/mobile/ViewToggle.tsx src/components/mobile/ViewToggle.test.tsx
git commit -m "feat: add map controls preview and mobile toggle"
```

---

### Task 4: Implement clustered Leaflet markers and map event synchronization

**Files:**
- Create: `src/components/map/mapIcons.ts`
- Create: `src/components/map/mapIcons.test.ts`
- Create: `src/components/map/PropertyMarker.tsx`
- Create: `src/components/map/MapEventBridge.tsx`
- Create: `src/components/map/MapEventBridge.test.tsx`
- Replace placeholder: `src/components/map/PropertyMapClient.tsx`
- Create: `src/components/map/PropertyMapClient.test.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes: `PropertyMapProps`, Task 2 map config/types, Task 3 controls/preview.
- Produces: a functional map with tiles, clustered price markers, controlled selection, bounds events, focus, reset, resize invalidation, and non-blocking tile-error status.

- [ ] **Step 1: Write failing icon-factory tests**

Mock Leaflet's `divIcon` and assert unselected/selected marker factories include distinct classes and formatted compact price text. Assert the cluster factory includes the child count and `sat-map-cluster` class.

- [ ] **Step 2: Write failing event-bridge tests with mocked `useMap` and `useMapEvents`**

Assert:

- `moveend` does not call `onBoundsChange` when map search is off.
- `moveend` emits `{ north, south, east, west }` when it is on.
- changing selected ID calls `flyTo([latitude, longitude], expectedZoom)` once.
- repeated render with the same selected ID does not call `flyTo` again.
- reset fits property bounds, or `NAGPUR_DEFAULT_BOUNDS` for an empty collection.
- mounting/visibility changes and observed container resizes schedule `invalidateSize()`.

- [ ] **Step 3: Write a failing map composition test**

Mock `react-leaflet`, `react-leaflet-cluster`, `PropertyMarker`, and `MapEventBridge`. Render two properties and assert one tile layer, a cluster group, two markers, controls, and the selected property's preview. Assert the tile attribution contains “OpenStreetMap contributors.” Trigger `tileerror` and assert an accessible, non-blocking status appears while the cluster, controls, preview, and attribution remain rendered.

- [ ] **Step 4: Run the map tests and verify RED**

Run: `npm test -- src/components/map/mapIcons.test.ts src/components/map/MapEventBridge.test.tsx src/components/map/PropertyMapClient.test.tsx`

Expected: FAIL because the implementation files do not exist or remain placeholders.

- [ ] **Step 5: Implement deterministic marker and cluster icons**

Use Leaflet `divIcon` with no external image files. Individual icon markup contains the formatted compact price and class names `sat-map-marker` plus `is-selected` when selected. Cluster markup contains only the count and uses `sat-map-cluster`. Escape or avoid arbitrary HTML inputs; all displayed values come from numeric formatters.

- [ ] **Step 6: Implement `PropertyMarker`**

Render `Marker` with `[property.latitude, property.longitude]`, `keyboard`, `riseOnHover`, selected `zIndexOffset`, property-specific `title`/`alt`, memoized icon, and `eventHandlers={{ click: () => onSelect(property.id) }}`. Do not render a Leaflet `Popup`.

- [ ] **Step 7: Implement `MapEventBridge`**

Use `useMapEvents({ moveend })` and `useMap()`. Convert Leaflet bounds immediately to plain `MapBounds`. Keep the previous selected ID in a ref so focus happens only on ID change. Detect `prefers-reduced-motion` and use `setView` instead of `flyTo`. Observe the map container with `ResizeObserver` and schedule `map.invalidateSize()` after mount, visibility changes, and observed resizes, with cleanup on unmount. Expose map operations through callback-registration props:

```ts
interface MapEventBridgeProps {
  properties: readonly Property[];
  selectedProperty: Property | null;
  searchAsMapMoves: boolean;
  onBoundsChange: (bounds: MapBounds) => void;
  onMapReady: (controls: { zoomIn: () => void; zoomOut: () => void; reset: () => void; readBounds: () => MapBounds }) => void;
}
```

When `reset()` runs, fit all provided property coordinates or `NAGPUR_DEFAULT_BOUNDS`. `readBounds()` lets enabling map search capture the current viewport immediately.

- [ ] **Step 8: Implement the client map composition**

`PropertyMapClient` renders:

```tsx
<MapContainer
  aria-label="Nagpur property map"
  center={NAGPUR_CENTER}
  className="h-full min-h-[520px] w-full"
  maxZoom={MAP_MAX_ZOOM}
  minZoom={MAP_MIN_ZOOM}
  scrollWheelZoom
  zoom={11}
  zoomControl={false}
>
  <TileLayer
    attribution="&copy; OpenStreetMap contributors"
    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
  />
  <MarkerClusterGroup chunkedLoading iconCreateFunction={createClusterIcon} showCoverageOnHover={false}>
    {properties.map(/* PropertyMarker keyed by stable ID */)}
  </MarkerClusterGroup>
  <MapEventBridge ... />
</MapContainer>
```

Place `MapControls` and `MapPreviewCard` as ordinary absolutely positioned siblings over the map container. When the controlled map-search checkbox changes from false to true, call `readBounds()` once before notifying the page.

- [ ] **Step 9: Add restrained SAT12 Leaflet CSS**

Define `.leaflet-container`, `.sat-map-marker`, `.sat-map-marker.is-selected`, `.sat-map-cluster`, focus-visible styles, attribution legibility, and a higher selected-marker stacking treatment. Use only existing design tokens; do not alter listing layout rules.

- [ ] **Step 10: Run map tests and static checks**

Run: `npm test -- src/components/map/mapIcons.test.ts src/components/map/MapEventBridge.test.tsx src/components/map/PropertyMapClient.test.tsx && npm run lint && npm run typecheck`

Expected: all map composition, focus-once, controlled bounds, reset, icon, and attribution cases pass.

- [ ] **Step 11: Commit**

```powershell
git add src/components/map src/app/globals.css
git commit -m "feat: add clustered interactive property map"
```

---

### Task 5: Synchronize filters, listings, markers, and mobile views

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/page.test.tsx`
- Create: `src/hooks/useMediaQuery.ts`
- Create: `src/hooks/useMediaQuery.test.tsx`
- Modify: `src/components/listings/PropertyResults.tsx`
- Modify: `src/components/listings/PropertyResults.test.tsx`
- Modify: `src/components/listings/PropertyCard.tsx`

**Interfaces:**
- Consumes: all Stage 2 hooks/components and existing filter/results interfaces.
- Produces: the completed coordinated SAT12 Stage 2 page.

- [ ] **Step 1: Mock `PropertyMap` and write failing page-coordination tests**

The mock must expose received property IDs and buttons that invoke `onSelect`, `onBoundsChange`, and `onViewProperty`. Assert these flows independently:

1. Initial Buy filters send the same seven IDs to list and map.
2. Changing intent to Rent sends the same two rental IDs to both.
3. Marker selection applies the selected card state.
4. Card selection sends the selected ID to the map.
5. Enabling map search and emitting bounds reduces card inputs while marker inputs retain every ordinary-filter match.
6. Disabling map search restores all filter-matched IDs.
7. Filtering out the selected property clears map preview selection.
8. On mobile state, card selection changes `ViewToggle` to Map; `onViewProperty` changes it to List without clearing selection.
9. While the media query is mobile and view is List, `PropertyMap` is not mounted; switching to Map mounts it. While the media query is desktop, map and listings are both mounted.

- [ ] **Step 2: Add a failing bounds-specific empty-state test**

Render `PropertyResults` with zero properties and `emptyReason="map-bounds"`. Assert it suggests moving the map or disabling map search, while the existing default empty test still suggests changing filters.

- [ ] **Step 3: Run the page/results tests and verify RED**

Run: `npm test -- src/app/page.test.tsx src/components/listings/PropertyResults.test.tsx`

Expected: FAIL because page state and `emptyReason` do not exist.

- [ ] **Step 4: Replace placeholder state with the coordinated pipeline**

In `page.tsx`, create:

```ts
const filterMatchedProperties = useFilteredProperties(NAGPUR_PROPERTIES, filters);
const [searchAsMapMoves, setSearchAsMapMoves] = useState(false);
const [mapBounds, setMapBounds] = useState<MapBounds | null>(null);
const [mobileView, setMobileView] = useState<MobileResultsView>("list");
const listingProperties = useMapBoundsFilter(filterMatchedProperties, mapBounds, searchAsMapMoves);
const selection = usePropertySelection(filterMatchedProperties);
```

When disabling map search, set `mapBounds` to null. When receiving bounds, skip `setMapBounds` if `sameMapBounds(current, next)` is true. Preserve filter reset behavior and reset selection only through the selection hook's visibility rule.

Implement `useMediaQuery(query)` with `useState(false)` and an effect that calls `window.matchMedia(query)`, sets the initial client value, subscribes to `change`, and removes the listener on cleanup. Test the initial false value, post-effect match, change events, and cleanup with a mocked `MediaQueryList`.

- [ ] **Step 5: Replace the Stage 1 map placeholder without changing the desktop grid**

Desktop remains `lg:grid-cols-[30%_70%]`. Render `PropertyMap` with `filterMatchedProperties` in the left aside and `PropertyResults` with `listingProperties` in the right section. Add `ViewToggle` above the two surfaces on mobile. Use `const isDesktop = useMediaQuery("(min-width: 1024px)")` and mount `PropertyMap` only when `isDesktop || mobileView === "map"`. Responsive classes make desktop show both, mobile show only the selected surface, and the mobile map use `min-h-[calc(100dvh-220px)]` with a practical fallback minimum. Pass a visibility signal so the map invalidates its size after surface switches.

- [ ] **Step 6: Wire card and marker selection**

Card selection calls `selection.selectProperty(id)` and `setMobileView("map")`. Marker selection calls `selection.selectProperty(id)`. Preview close calls `selection.clearSelection()`. Preview view action preserves selection and sets `mobileView("list")`.

- [ ] **Step 7: Preserve results presentation state and improve accessibility**

Add `emptyReason?: "filters" | "map-bounds"` to `PropertyResults`. Change only the empty explanatory sentence based on the reason. Add `aria-pressed={selected}` to the existing property selection button without nesting the favorite button.

- [ ] **Step 8: Run focused tests and the complete Stage 1 regression suite**

Run: `npm test -- src/app/page.test.tsx src/components/listings/PropertyResults.test.tsx src/hooks/useMediaQuery.test.tsx && npm test`

Expected: synchronization tests pass and all previous Stage 1 tests remain green.

- [ ] **Step 9: Run static checks**

Run: `npm run lint && npm run typecheck`

Expected: both commands exit 0.

- [ ] **Step 10: Commit**

```powershell
git add src/app/page.tsx src/app/page.test.tsx src/components/listings/PropertyResults.tsx src/components/listings/PropertyResults.test.tsx src/components/listings/PropertyCard.tsx src/hooks/useMediaQuery.ts src/hooks/useMediaQuery.test.tsx
git commit -m "feat: synchronize SAT12 map and listings"
```

---

### Task 6: Add resilience, accessibility, and performance regression coverage

**Files:**
- Modify tests from Tasks 1–5 only where required.
- Modify map/page components only for defects proven by failing tests.

**Interfaces:**
- Consumes: completed Stage 2 behavior.
- Produces: regression coverage for failure modes that are hard to see in a static screenshot.

- [ ] **Step 1: Add a failing client-import regression test**

Reset modules, delete any test `window` shim only within the isolated test, import `PropertyMap.tsx`, and assert the import does not throw or synchronously import `leaflet`. Restore globals in `finally`.

- [ ] **Step 2: Add a failing empty-map reset test**

With `properties=[]`, invoke registered reset controls and assert `fitBounds(NAGPUR_DEFAULT_BOUNDS)` rather than throwing or calculating invalid bounds.

- [ ] **Step 3: Add a failing repeated-bounds test**

Emit the same numeric bounds twice through the page mock and assert the visible property output remains stable and no extra selection clear occurs. Use an observable callback/count in the mock rather than testing implementation details.

- [ ] **Step 4: Add a failing accessibility test**

Assert the map loading fallback is a named status, mobile toggle pressed states are exposed, selected cards expose `aria-pressed`, marker titles include property/locality, and preview buttons have unambiguous names.

- [ ] **Step 5: Add failing resize and tile-failure resilience tests**

Mock `ResizeObserver` and animation-frame scheduling. Assert mount, a container resize, and a mobile visibility change schedule `invalidateSize()`, while unmount disconnects the observer. Trigger tile failure and assert the named status is announced without removing markers, controls, preview, or OpenStreetMap attribution.

- [ ] **Step 6: Add a failing performance contract test**

Mock the marker component and rerender `PropertyMapClient` with only preview open/close state changed. Assert marker IDs and count remain stable. Assert `move` is not registered while `moveend` is registered.

- [ ] **Step 7: Make the smallest implementation corrections required by RED tests**

Do not refactor unrelated Stage 1 components. Keep Leaflet objects inside map components and keep page state serializable.

- [ ] **Step 8: Run the full automated suite and static checks**

Run: `npm test && npm run lint && npm run typecheck`

Expected: zero test failures; lint and TypeScript exit 0.

- [ ] **Step 9: Commit**

```powershell
git add src
git commit -m "test: harden SAT12 map interactions"
```

---

### Task 7: Production build and browser verification

**Files:**
- Create: `docs/screenshots/sat12-stage2-desktop.png`
- Create: `docs/screenshots/sat12-stage2-mobile-list.png`
- Create: `docs/screenshots/sat12-stage2-mobile-map.png`
- Modify only source/tests required by failures discovered during this task.

**Interfaces:**
- Consumes: the complete Stage 2 implementation.
- Produces: a verified Stage 2 checkpoint ready for review and later backend integration.

- [ ] **Step 1: Run fresh automated verification**

Run:

```powershell
npm test
npm run lint
npm run typecheck
npm run build
```

Expected: all tests pass and the build completes without Leaflet SSR, `window is not defined`, CSS order, hydration, or generated-type failures.

- [ ] **Step 2: Start the development server and confirm the route responds**

Run: `npm run dev`

Then request `http://127.0.0.1:3000/`. Expected: HTTP 200 and no browser console errors.

- [ ] **Step 3: Verify the 1536×1024 desktop reference state**

Confirm the approximately 30/70 layout, three result columns when container width permits, OSM attribution, cluster appearance, price markers, and no horizontal page overflow. Click a marker and confirm its preview; click a card and confirm its marker focuses and highlights; test zoom in/out and reset. Save `docs/screenshots/sat12-stage2-desktop.png`.

- [ ] **Step 4: Verify controlled map-search behavior**

With map search off, pan/zoom and assert result count is unchanged. Enable it and assert the current bounds immediately filter cards while all ordinary-filter-matched markers remain available for discovery. Pan to a different area and assert listing updates occur after movement ends without removing matching markers. Disable it and assert all filter-matched list results return. Repeat after selecting a property to confirm no update loop.

- [ ] **Step 5: Verify filter and cluster synchronization**

Switch Buy/Rent and apply property type/BHK/budget filters. Confirm ordinary filters update cards and marker cluster children to the same candidate set; when map search is active, only the cards are the in-bounds subset. Click a cluster and confirm zoom-to-bounds reveals its markers without selecting an arbitrary property.

- [ ] **Step 6: Verify 390×844 mobile List and Map views**

Confirm List is initial, toggle buttons are at least 44px, only one primary surface is visible, and neither state introduces page-level horizontal overflow. Select a card and confirm Map opens with the matching highlighted marker and preview. Use “View property” to return to List with the card still selected. Save `sat12-stage2-mobile-list.png` and `sat12-stage2-mobile-map.png`.

- [ ] **Step 7: Verify keyboard and reduced-motion behavior**

Tab through mobile toggle, card, favorite, map controls, marker, preview close, and preview view actions. Confirm focus is visible and order is logical. Emulate reduced motion and confirm card-to-marker focus does not animate.

- [ ] **Step 8: Fix each discovered defect through RED → GREEN**

For every behavioral defect, add the smallest failing Vitest case first, implement the correction, and rerun the focused test before repeating the complete verification command from Step 1.

- [ ] **Step 9: Commit the verified Stage 2 checkpoint**

```powershell
git add src docs/screenshots package.json package-lock.json
git commit -m "test: verify SAT12 stage two map"
```

## Plan self-review

- Spec coverage: client-only loading, 30/70 layout, coordinates, clustering, preview, bidirectional selection, map search, controls, mobile toggle, filter synchronization, accessibility, performance, tests, build, and screenshots each map to a task.
- Placeholder scan: no unresolved placeholders, deferred implementation instructions, or undefined cross-task references remain.
- Type consistency: `MapBounds`, `MobileResultsView`, `PropertyMapProps`, selection return values, and map-control registration use the same names throughout.
- Scope: all tasks ship one interactive-map subsystem; backend, auth, payments, geocoding, routing, and provider migration remain excluded.
