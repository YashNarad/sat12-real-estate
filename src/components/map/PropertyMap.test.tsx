import { render } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

const { dynamicSpy } = vi.hoisted(() => ({
  dynamicSpy: vi.fn(() => function DynamicMapStub() { return null; }),
}));

vi.mock("next/dynamic", () => ({ default: dynamicSpy }));

beforeEach(() => {
  dynamicSpy.mockClear();
  vi.resetModules();
});

it("declares a client-only dynamic map boundary", async () => {
  const { PropertyMap } = await import("./PropertyMap");

  render(
    <PropertyMap
      properties={[]}
      selectedPropertyId={null}
      searchAsMapMoves={false}
      visible
      onBoundsChange={() => undefined}
      onClearSelection={() => undefined}
      onSearchAsMapMovesChange={() => undefined}
      onSelect={() => undefined}
      onViewProperty={() => undefined}
    />,
  );

  expect(dynamicSpy).toHaveBeenCalledWith(
    expect.any(Function),
    expect.objectContaining({ ssr: false }),
  );
});
