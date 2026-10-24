import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("owner property action authorization", () => {
  it("does not grant administrators owner-agent capabilities", async () => {
    const source = await readFile(path.join(process.cwd(), "src/app/actions/properties.ts"), "utf8");
    expect(source).toContain('requireRole(["owner_agent"]');
    expect(source).not.toContain('requireRole(["owner_agent", "admin"]');
  });
});
