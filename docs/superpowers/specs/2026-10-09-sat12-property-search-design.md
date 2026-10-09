# SAT12 Property Search Frontend — Implementation Specification

## Goal

Build a responsive Indian real-estate search experience that closely follows the approved SAT12 reference: a restrained white and light-gray interface, charcoal typography, SAT12 red (`#DC0011`) accents, a filter rail, an interactive map, and dense property results for Nagpur. The first release is frontend-only and uses realistic local mock data; authentication, payments, and Supabase are out of scope.

## Technology

- Next.js App Router with TypeScript and Tailwind CSS.
- React Leaflet loaded client-side through a dynamic import so Leaflet never executes during server rendering.
- OpenStreetMap raster tiles with visible attribution and no prefetching or offline caching.
- Leaflet marker clustering for nearby properties.
- Component tests for filtering and selection behavior, plus lint, type/build checks, and responsive browser review.

## Visual System

- Brand red: `#DC0011`; charcoal: `#18181B`; secondary text: `#71717A`; border: `#E4E4E7`; canvas: `#F7F7F8`; surface: `#FFFFFF`.
- Use a clean geometric sans-serif with compact price and metadata treatments.
- Use thin borders, modest corner radii, and selective shadows. Red is reserved for primary actions, prices, active controls, and selected map markers.
- Desktop content uses an approximately 30/70 map/results split. Results use three columns at wide desktop sizes and collapse responsively.
- Mobile displays one primary surface at a time through a Map/List toggle, while keeping the search/filter controls accessible.

## Application Structure

```text
src/
├─ app/
│  ├─ layout.tsx
│  ├─ page.tsx
│  └─ globals.css
├─ components/
│  ├─ layout/Header.tsx
│  ├─ search/
│  │  ├─ SearchBar.tsx
│  │  ├─ FilterButton.tsx
│  │  └─ PropertyFilters.tsx
│  ├─ listings/
│  │  ├─ ListingsHeader.tsx
│  │  ├─ PropertyList.tsx
│  │  ├─ PropertyGrid.tsx
│  │  └─ PropertyCard.tsx
│  ├─ map/
│  │  ├─ PropertyMap.tsx
│  │  ├─ PropertyMarker.tsx
│  │  ├─ MapControls.tsx
│  │  └─ MapPreviewCard.tsx
│  └─ mobile/ViewToggle.tsx
├─ data/properties.ts
├─ hooks/
│  ├─ usePropertySelection.ts
│  └─ useFilteredProperties.ts
├─ lib/formatters.ts
└─ types/property.ts
```

`PropertyList` owns the current grid/list presentation boundary even though the first release defaults to the reference's grid view. `PropertyFilters` owns filter control state and emits a serializable filter model. `useFilteredProperties` accepts any `Property[]` source plus that model; it does not import mock data. This keeps filtering independent of the future backend.

## Data Model

Each property has a stable ID, title, category, price in INR, display price, Nagpur locality, latitude/longitude, image, bedroom/bathroom counts, area in square feet, status, RERA state, and optional badge. Coordinates must be plausible Nagpur locations and sufficiently varied to demonstrate clusters.

The filter model includes query, intent, property type, budget band, and BHK count. Filtering is deterministic and side-effect free. Mock records remain in `data/properties.ts`; components receive data through props.

## Interaction and State

The page coordinates filters, selected property ID, mobile view, and result presentation. Selection is ID-based:

1. Clicking a property card selects it, applies a visible card state, switches to the map on mobile, focuses the matching marker, and opens its preview.
2. Clicking an individual marker selects the property and opens `MapPreviewCard`.
3. Clicking a cluster zooms to reveal its members.
4. Map controls provide zoom in/out, reset to Nagpur bounds, and a controlled “Search as I move the map” option.
5. Filter changes update visible cards and markers from the same filtered collection. If the selected property is filtered out, selection clears.

Selection logic lives behind `usePropertySelection` so map and listing components depend on callbacks rather than each other. The map exposes focus behavior through selected ID and coordinates, avoiding direct Leaflet references in page-level code.

## Responsive Behavior

- Wide desktop: sticky map at roughly 30%, three-column property grid at roughly 70%.
- Medium desktop/tablet: map remains visible where space permits; results reduce to two columns.
- Mobile: filters condense and the Map/List toggle swaps between a full-width map and a single-column result list. Touch targets remain at least 44px where practical.
- Keyboard focus is visible; interactive cards are reachable without a pointer; reduced-motion preferences are respected.

## Staged Delivery

1. Scaffold Next.js, TypeScript, Tailwind, tests, tokens, and base layout. Build the header, search/filter rail, typed mock data, filtering hook, listing header, and property cards/list. Run focused tests, lint, and build.
2. Add the client-only React Leaflet map, clustering, custom selected markers, map controls, preview card, and map/list synchronization. Run behavior tests, lint, and build.
3. Add responsive Map/List switching, polish spacing and reference fidelity, inspect desktop/mobile screenshots, and run the full test/lint/build suite.

## Acceptance Criteria

- The page visually tracks the supplied SAT12 reference and approved palette without introducing unrelated design treatments.
- Desktop has the specified map/results proportions and three listing columns.
- Cards and markers synchronize selection in both directions; marker clicks open previews; clusters and zoom work.
- Mobile users can switch between functional map and list views.
- Filtering is independent of the mock source and ready to receive backend-supplied arrays later.
- OpenStreetMap attribution remains visible.
- No authentication, payments, or Supabase code is introduced.
