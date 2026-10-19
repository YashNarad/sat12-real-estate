import { beforeEach, describe, expect, it, vi } from "vitest";

const { connection, getHomepageAccount } = vi.hoisted(() => ({
  connection: vi.fn(async () => undefined),
  getHomepageAccount: vi.fn(async () => null),
}));

vi.mock("next/server", () => ({ connection }));
vi.mock("@/app/actions/auth", () => ({ logoutAction: vi.fn() }));
vi.mock("@/features/auth/homepage-account", () => ({ getHomepageAccount }));

import { HeaderAccount } from "./HeaderAccount";

describe("HeaderAccount", () => {
  beforeEach(() => {
    connection.mockClear();
    getHomepageAccount.mockClear();
  });

  it("defers the time-sensitive SSR identity read until request time", async () => {
    await HeaderAccount();

    expect(connection).toHaveBeenCalledOnce();
    expect(connection.mock.invocationCallOrder[0]).toBeLessThan(
      getHomepageAccount.mock.invocationCallOrder[0],
    );
  });
});
