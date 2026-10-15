import { describe, expect, it } from "vitest";

import {
  assertGeneratedTypesMatch,
  buildTypeGenerationArguments,
  validateTypeDriftTarget,
} from "./check-database-types.mjs";

describe("database type drift", () => {
  it("builds a read-only generation command for the approved project", () => {
    expect(buildTypeGenerationArguments("abcdefghijklmnopqrst")).toEqual([
      "gen",
      "types",
      "typescript",
      "--project-id",
      "abcdefghijklmnopqrst",
      "--schema",
      "public",
    ]);
  });

  it("compares generated types byte for byte", () => {
    expect(() => assertGeneratedTypesMatch("same\n", "same\n")).not.toThrow();
    expect(() => assertGeneratedTypesMatch("same\n", "different\n")).toThrow(/drift/);
  });

  it("refuses to inspect an unapproved project", () => {
    expect(() =>
      validateTypeDriftTarget({
        NODE_ENV: "test",
        SUPABASE_PROJECT_REF: "zzzzzzzzzzzzzzzzzzzz",
        SAT12_APPROVED_PROJECT_REF: "abcdefghijklmnopqrst",
        NEXT_PUBLIC_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
        SAT12_DEVELOPMENT_DATA_CONFIRMED: "true",
        SAT12_REMOTE_OPERATION_APPROVED: "",
      }),
    ).toThrow(/APPROVED/);
  });
});
