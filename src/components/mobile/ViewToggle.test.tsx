import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { ViewToggle } from "./ViewToggle";

it("exposes list state and switches to map", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<ViewToggle value="list" onChange={onChange} />);
  expect(screen.getByRole("button", { name: "List" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "Map" })).toHaveAttribute("aria-pressed", "false");
  await user.click(screen.getByRole("button", { name: "Map" }));
  expect(onChange).toHaveBeenCalledWith("map");
});

it("exposes map state", () => {
  render(<ViewToggle value="map" onChange={() => undefined} />);
  expect(screen.getByRole("button", { name: "List" })).toHaveAttribute("aria-pressed", "false");
  expect(screen.getByRole("button", { name: "Map" })).toHaveAttribute("aria-pressed", "true");
});
