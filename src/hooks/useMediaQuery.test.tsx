import { act, renderHook } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { useMediaQuery } from "./useMediaQuery";

it("tracks media query changes and removes its listener", () => {
  let matches = true;
  let listener: ((event: MediaQueryListEvent) => void) | undefined;
  const removeEventListener = vi.fn();
  const mediaQueryList = {
    get matches() { return matches; },
    media: "(min-width: 1024px)",
    onchange: null,
    addEventListener: (_type: string, callback: (event: MediaQueryListEvent) => void) => { listener = callback; },
    removeEventListener,
    addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  };
  vi.stubGlobal("matchMedia", vi.fn(() => mediaQueryList));
  const { result, unmount } = renderHook(() => useMediaQuery("(min-width: 1024px)"));
  expect(result.current).toBe(true);
  matches = false;
  act(() => listener?.({ matches } as MediaQueryListEvent));
  expect(result.current).toBe(false);
  unmount();
  expect(removeEventListener).toHaveBeenCalledWith("change", listener);
});
