import { describe, expect, it } from "vitest";

import { buildMigrationCommands } from "./run-supabase-migrations.mjs";

describe("buildMigrationCommands", () => {
  it("always links and previews before an approved apply", () => {
    expect(buildMigrationCommands("abcdefghijklmnopqrst", true)).toEqual([
      ["supabase", "link", "--project-ref", "abcdefghijklmnopqrst"],
      ["supabase", "migration", "list", "--linked"],
      ["supabase", "db", "push", "--linked", "--dry-run"],
      ["supabase", "db", "push", "--linked"],
    ]);
  });

  it("omits the mutating push in preview mode", () => {
    expect(buildMigrationCommands("abcdefghijklmnopqrst", false)).toHaveLength(3);
  });
});
