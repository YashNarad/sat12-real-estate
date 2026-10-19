import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({ calls: [] as string[] }));

vi.mock("next/server", () => ({
  connection: vi.fn(async () => { harness.calls.push("connection"); }),
}));
vi.mock("@/features/properties/supabase-repository", () => ({
  getPublishedProperties: vi.fn(async () => { harness.calls.push("repository"); return []; }),
}));
vi.mock("@/components/layout/HeaderAccount", () => ({
  HeaderAccount: () => <span>Account</span>,
  HeaderAccountFallback: () => <span>Loading account</span>,
}));
vi.mock("@/components/properties/PropertyExplorer", () => ({
  PropertyExplorer: ({ inventoryMode, initialProperties }: { inventoryMode: string; initialProperties: unknown[] }) => (
    <div data-count={initialProperties.length} data-mode={inventoryMode}>Explorer</div>
  ),
}));

import { PublishedPropertyExplorer } from "./page";

it("enters request time before loading repository data", async () => {
  harness.calls.length = 0;
  render(await PublishedPropertyExplorer());
  expect(harness.calls).toEqual(["connection", "repository"]);
  expect(screen.getByText("Explorer")).toHaveAttribute("data-mode", "published");
  expect(screen.getByText("Explorer")).toHaveAttribute("data-count", "0");
});
