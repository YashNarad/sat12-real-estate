import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { MapControls } from "./MapControls";

it("runs zoom and reset controls", async () => {
  const user = userEvent.setup();
  const onZoomIn = vi.fn();
  const onZoomOut = vi.fn();
  const onReset = vi.fn();
  render(<MapControls searchAsMapMoves={false} onZoomIn={onZoomIn} onZoomOut={onZoomOut} onReset={onReset} onSearchAsMapMovesChange={() => undefined} />);

  await user.click(screen.getByRole("button", { name: "Zoom in" }));
  await user.click(screen.getByRole("button", { name: "Zoom out" }));
  await user.click(screen.getByRole("button", { name: "Reset map" }));
  expect(onZoomIn).toHaveBeenCalledOnce();
  expect(onZoomOut).toHaveBeenCalledOnce();
  expect(onReset).toHaveBeenCalledOnce();
});

it("reports controlled search-as-map-moves changes", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<MapControls searchAsMapMoves={false} onZoomIn={() => undefined} onZoomOut={() => undefined} onReset={() => undefined} onSearchAsMapMovesChange={onChange} />);
  await user.click(screen.getByRole("checkbox", { name: "Search as I move the map" }));
  expect(onChange).toHaveBeenCalledWith(true);
});
