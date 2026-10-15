import { describe, expect, it } from "vitest";

import {
  buildMigrationCommands,
  buildSupabaseInvocation,
} from "./run-supabase-migrations.mjs";

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

  it("launches the installed native CLI instead of a Windows cmd shim", () => {
    const invocation = buildSupabaseInvocation(
      ["supabase", "migration", "list", "--linked"],
      "C:\\workspace\\node_modules\\@supabase\\cli-windows-x64\\bin\\supabase.exe",
    );

    expect(invocation).toEqual({
      executable:
        "C:\\workspace\\node_modules\\@supabase\\cli-windows-x64\\bin\\supabase.exe",
      args: ["migration", "list", "--linked"],
    });
  });
});
