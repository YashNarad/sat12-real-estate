import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import Home from "./page";

it("exposes the SAT12 property results landmark", () => {
  render(<Home />);
  expect(
    screen.getByRole("main", { name: /nagpur property results/i }),
  ).toBeInTheDocument();
});
