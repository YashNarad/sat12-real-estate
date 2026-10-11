# SAT12 Stage 2 Interactive Property Map — Design Specification

## Status and intent

Stage 2 replaces the Stage 1 map placeholder with a production-oriented, client-only interactive map while preserving every existing filter, card, sort, list/grid, favorite, loading, and empty-state behavior. The map and listings are two synchronized views of the same filtered Nagpur property collection. Mock data remains the only data source; Supabase, authentication, payments, listing submission, and other backend work remain out of scope.

The implementation must continue to match the finalized SAT12 reference: white and light-gray surfaces, charcoal typography, SAT12 red (`#DC0011`) for active states, an approximately 30/70 desktop map/results split, three listing columns when the results pane has enough width, and one primary surface at a time on mobile.

## Repository baseline

- Next.js App Router 16.4.0, React 19.3.0, TypeScript, and Tailwind CSS 4.
- `src/app/page.tsx` is the client coordinator for filters and selected property ID.
- `useFilteredProperties` is data-source independent and returns the collection consumed by the page.
- Nine typed Nagpur mock properties already contain stable IDs and valid latitude/longitude values.
- `PropertyResults` owns sorting, grid/list presentation, and favorites; `PropertyCard` already exposes an ID-based selection callback.
- Stage 1 reserves an approximately 30% desktop map column and hides it on mobile.
- The local `main` branch contains the completed Stage 1 UI and generated illustrative property imagery. At planning time the working tree is clean, but local `main` is one commit ahead of `origin/main`.

## Selected technical approach

Use React Leaflet 5 with Leaflet 1.9, `react-leaflet-cluster` 4, and `@types/leaflet`. This combination declares React 19-compatible peer dependencies and keeps clustering within the React Leaflet component tree.

The browser-dependent implementation is split into two layers:

1. `PropertyMap.tsx` is a small Client Component that calls `next/dynamic` at module scope with `{ ssr: false }` and renders an accessible loading fallback.
2. `PropertyMapClient.tsx` imports React Leaflet, Leaflet, cluster support, and Leaflet CSS. It never enters the server-rendered module graph.

This follows the installed Next.js 16.4 guidance: `ssr: false` is valid only when the dynamic import is declared in a Client Component. A `typeof window` branch inside render is not used because it creates a weaker hydration boundary and mixes loading concerns with map behavior.

Alternative approaches considered:

- Directly import React Leaflet in `page.tsx`: rejected because Leaflet uses browser APIs and would enlarge the page coordinator's client bundle and responsibilities.
- Use raw Leaflet with imperative layer management: rejected because it would duplicate React synchronization logic and increase cleanup risk.
- Use an unclustered map because the current mock set is small: rejected because clustering is an explicit acceptance requirement and future backend data will increase marker density.

## Dependencies and external services

Add exact compatible majors through npm:

- `leaflet@^1.9.4`
- `react-leaflet@^5.0.0`
- `react-leaflet-cluster@^4.1.3`
- `@types/leaflet@^1.9.22` as a development dependency

Use the standard OpenStreetMap raster endpoint:

```text
https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png
```

The tile layer must retain visible attribution to OpenStreetMap contributors. SAT12 must not prefetch tiles, cache tiles for offline use, remove attribution, or issue requests outside normal interactive viewing. Production deployment can later move to a commercial or self-hosted provider without changing map component interfaces.

## Component architecture

```text
src/
├─ app/
│  ├─ page.tsx                         # page-owned filter, selection, bounds, mobile-view state
│  └─ globals.css                      # Leaflet/SAT12 marker, cluster, control, popup styles
├─ components/
│  ├─ map/
│  │  ├─ PropertyMap.tsx               # client-only dynamic boundary and loading fallback
│  │  ├─ PropertyMapClient.tsx         # MapContainer, tiles, clusters, overlays
│  │  ├─ PropertyMarker.tsx            # custom marker icon and marker interaction
│  │  ├─ MapEventBridge.tsx            # moveend bounds emission and selected-marker focus
│  │  ├─ MapControls.tsx               # zoom, reset, search-as-map-moves controls
│  │  ├─ MapPreviewCard.tsx            # floating selected-property summary
│  │  └─ mapIcons.ts                   # deterministic Leaflet divIcon factories
│  └─ mobile/
│     └─ ViewToggle.tsx                # accessible Map/List segmented control
├─ hooks/
│  ├─ useFilteredProperties.ts         # unchanged Stage 1 data-source-independent filtering
│  ├─ useMapBoundsFilter.ts            # pure bounds filtering plus hook wrapper
│  ├─ useMediaQuery.ts                  # hydration-safe desktop/mobile map mount decision
│  └─ usePropertySelection.ts           # selected ID lifecycle and derived selected property
├─ lib/
│  └─ mapConfig.ts                     # Nagpur center/default bounds and fit options
└─ types/
   ├─ property.ts                      # existing property contracts
   └─ map.ts                           # serializable bounds and mobile-view contracts
```

Each map component consumes typed values and callbacks. No page-level code stores a Leaflet `Map`, `Marker`, `LatLngBounds`, or DOM object. This keeps the coordinator serializable and ready for a backend-provided `Property[]`.

## State ownership and data flow

`page.tsx` owns:

- `filters: PropertyFiltersState`
- `selectedPropertyId: string | null`
- `mobileView: "list" | "map"`
- `searchAsMapMoves: boolean`, default `false`
- `mapBounds: MapBounds | null`

Derived collections are computed in this order:

```text
NAGPUR_PROPERTIES
    ↓ useFilteredProperties(filters)
filterMatchedProperties
    ↓ searchAsMapMoves && mapBounds ? filterPropertiesByBounds(...) : unchanged
visibleProperties
    ├─→ PropertyMap markers/clusters
    └─→ PropertyResults cards/count/sort
```

Map bounds are plain numeric data:

```ts
export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}
```

The map emits bounds only after Leaflet's `moveend` event and only when “Search as I move the map” is enabled. Continuous `move` events do not update React state. Enabling the control immediately captures the current viewport; disabling it clears the bounds restriction and restores the complete filter-matched collection. This avoids render loops and prevents accidental result changes while users explore the map.

If a filter or bounds change removes the selected property from `visibleProperties`, selection clears. Sorting never changes marker identity because all synchronization is ID-based.

## Selection and focus behavior

### Listing to map

Clicking or keyboard-activating a property card:

1. Sets the selected property ID.
2. Applies the existing red selected-card treatment.
3. On mobile, switches `mobileView` to `"map"`.
4. Passes the selected ID and coordinates to the map.
5. `MapEventBridge` calls `flyTo` only when the selected ID changes, using reduced motion when the user requests it.
6. The matching marker receives the selected icon and elevated z-index.
7. `MapPreviewCard` opens with the selected property.

### Marker to listing

Clicking or keyboard-activating an individual marker sets the same selected property ID and opens the preview. On desktop the matching card highlights; scrolling the results pane is intentionally not forced because it can disorient keyboard users and conflict with manual sorting. On mobile the current view is already the map; closing the preview preserves selection until the user selects another property, changes filters, or explicitly closes the preview.

### Clusters

Cluster clicks use the cluster plugin's default zoom-to-bounds behavior. Clusters use a SAT12-red count icon with a white border. Spiderfying remains enabled for markers sharing or nearly sharing coordinates. A cluster click does not select an arbitrary child property.

## Map presentation

- Default center: central Nagpur, approximately `[21.1458, 79.0882]`.
- Default viewport: configured Nagpur bounds that contain all nine mock coordinates.
- Desktop: map remains in the left approximately 30% column, uses the full content-panel height, and becomes sticky below the header/filter region where supported.
- The right results pane remains approximately 70%, retaining container-query-driven one/two/three-column behavior.
- OpenStreetMap attribution remains visible at the lower edge.
- Default Leaflet zoom controls are disabled; SAT12 controls provide zoom in, zoom out, and reset.
- Reset fits the complete `filterMatchedProperties` bounds when at least one property exists; otherwise it fits the default Nagpur bounds. When map-search is enabled, reset emits the resulting bounds after movement completes.
- Individual markers display compact INR price labels. Selected markers use solid SAT12 red, white text, a stronger white halo, and a higher stacking order.
- The map loading state uses the existing light-gray placeholder visual language and announces “Loading interactive map.”

## Floating property preview

`MapPreviewCard` is an absolutely positioned card above the map. It shows the property's illustrative image, title, formatted price, locality, bedrooms/bathrooms when applicable, and area. It includes:

- A close button with an explicit accessible name.
- A “View property” action that preserves the current selected ID and switches to the list on mobile.
- An `aria-live="polite"` region or equivalent selection announcement so assistive technology receives marker-selection changes.
- No nested interactive elements.

The preview is not a Leaflet popup. Keeping it as ordinary React UI avoids clipping, gives predictable responsive placement, and makes keyboard focus and image optimization easier.

## Search-as-map-moves behavior

- Implemented as a controlled checkbox/switch in `MapControls`.
- Default: off.
- Off: panning and zooming never change cards or marker input.
- On: the current viewport is captured immediately, then updated on `moveend` only.
- Filter changes still run first; bounds filtering is always an intersection with the active property filters.
- Empty bounds results reuse the existing “No properties found” treatment with wording that suggests moving the map or disabling map search.
- Reset and programmatic selected-marker focus do not create update loops; bounds callbacks compare numeric bounds before setting state.

## Mobile behavior

Below the desktop map breakpoint, render a sticky `ViewToggle` with two 44px-minimum buttons: “List” and “Map.” Only the active surface is displayed to avoid two competing scroll regions and to defer map rendering until it is needed.

A hydration-safe `useMediaQuery("(min-width: 1024px)")` hook returns `false` during prerender and updates after mount. The page mounts the map when the viewport is desktop-sized or when the mobile view is explicitly `"map"`; therefore mobile List does not download or initialize Leaflet merely because the map exists elsewhere in the page.

- Initial mobile view: list.
- Choosing Map mounts the client-only map at a height based on the viewport, with a minimum usable height.
- Choosing List restores the listing results without resetting filters, sort, favorites, selected ID, or map-search state.
- Selecting a card automatically switches to Map and focuses the marker.
- “View property” in the preview switches back to List and leaves the corresponding card highlighted.
- Desktop ignores `mobileView` and displays map and results together.

## Accessibility

- The map region has an accessible label such as “Nagpur property map.”
- Custom markers retain Leaflet keyboard navigation and receive property-specific titles/alternative text.
- All map controls and the mobile toggle use native buttons/inputs with visible SAT12-red focus rings.
- Selected states expose `aria-pressed` or `aria-current` where appropriate; color is not the only selection signal.
- Map instructions explain that arrow keys pan the map and `+`/`-` controls zoom where Leaflet keyboard behavior is available.
- Preview close and view actions follow logical tab order.
- Motion honors `prefers-reduced-motion`; marker focus uses immediate `setView` instead of animated `flyTo` for reduced-motion users.
- Touch targets are at least 44px where practical.

## Performance and resilience

- Dynamic import keeps Leaflet out of the server-rendered path and out of the mobile list view until needed.
- Marker and cluster input uses the memoized `visibleProperties` array.
- Icon creation is deterministic and memoized by price/selection state; no icon is rebuilt during unrelated page state changes.
- Bounds updates occur on `moveend`, not every animation frame.
- Cluster chunked loading is enabled to remain responsive when a future backend supplies larger arrays.
- Event handlers are stable callbacks, and Leaflet listeners are registered through React Leaflet hooks so they are cleaned up on unmount.
- Missing or empty property collections still render a usable Nagpur map and reset control.
- Tile failure does not remove markers, controls, preview UI, or attribution; the base map may be blank while SAT12-owned overlays remain usable.

## Testing strategy

### Automated component and unit tests

- Pure bounds filtering: inside, outside, exact-edge, wrapped/invalid bounds defense, and disabled map search.
- Selection lifecycle: card/marker selection, selection clearing when a property disappears, preview close, and selected-property derivation.
- `MapControls`: zoom/reset callbacks and controlled search-as-map-moves state.
- `MapPreviewCard`: property metadata, close/view actions, and keyboard-accessible controls.
- `ViewToggle`: correct pressed state and callbacks.
- Page coordination with the Leaflet implementation mocked: filter-to-marker synchronization, listing selection switching mobile view, and bounds filtering affecting both list and map props.
- Client boundary: importing/rendering the page during Vitest must not evaluate Leaflet browser globals.

### Static and production verification

Run:

```text
npm test
npm run lint
npm run typecheck
npm run build
```

The production build must complete without `window is not defined`, hydration, CSS import, or generated-type failures.

### Browser verification

Inspect at 1536×1024, 1024×768, and 390×844. Verify:

- 30/70 desktop balance and three result columns where the results container permits.
- OSM tiles and visible attribution.
- Cluster expansion, marker clicks, preview positioning, zoom/reset, and selected marker styling.
- Card-to-marker focus and marker-to-card highlight.
- Search-as-map-moves off/on behavior and filter intersection.
- Mobile List/Map switching and automatic card-to-map transition.
- Keyboard focus order and reduced-motion behavior.
- No page-level horizontal overflow.

Save updated desktop and mobile screenshots under `docs/screenshots/` for review.

## Acceptance criteria

1. React Leaflet is never evaluated during server rendering and the Next.js production build passes.
2. Desktop retains the approved approximately 30% map / 70% results layout and three columns when space permits.
3. All filtered properties appear as clustered map markers using existing coordinates.
4. Marker activation opens a floating preview; card activation highlights and focuses the corresponding marker.
5. Zoom, reset, cluster expansion, and controlled search-as-map-moves behavior work without state loops.
6. Filters, map bounds, listings, count, selection, sorting, favorites, and mobile view remain synchronized without changing the mock-data boundary.
7. Mobile users can switch between usable Map and List surfaces, and card selection opens the selected property on the map.
8. Keyboard, screen-reader, touch-target, focus, and reduced-motion requirements are met.
9. OpenStreetMap attribution remains visible and tiles are used according to the standard interactive-use policy.
10. Tests, lint, TypeScript, production build, and desktop/mobile browser review pass with screenshots saved.

## Explicit non-goals

- Supabase or any database integration.
- Authentication, user profiles, saved favorites persistence, or alerts.
- Payments, subscriptions, listing submission, or lead capture.
- Geocoding, routing, travel-time search, drawing tools, or user-location permission.
- Server-side map rendering, tile proxying, offline tile caching, or a custom tile provider.
