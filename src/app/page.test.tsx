import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import Home from "./page";

it("exposes the SAT12 property results landmark", () => {
  render(<Home />);
  expect(
    screen.getByRole("main", { name: /nagpur property results/i }),
  ).toBeInTheDocument();
});

it("changes the real listing intent from the header navigation", async () => {
  const user = userEvent.setup();
  render(<Home />);

  await user.click(screen.getByRole("button", { name: "Rent" }));

  expect(screen.getByRole("combobox", { name: "Intent" })).toHaveValue("Rent");
  expect(screen.getByRole("status")).toHaveTextContent("2 properties found");
});
