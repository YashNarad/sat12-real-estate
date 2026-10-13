import { describe, expect, it } from "vitest";

import {
  analyzeTapResults,
  collectTapFailures,
} from "./cloud-db-test-runner.mjs";

describe("collectTapFailures", () => {
  it("returns no failures for successful pgTAP output", () => {
    expect(
      collectTapFailures([
        { plan: "1..2" },
        { has_table: "ok 1 - profiles exists" },
        { policies_are: "ok 2 - profiles policies are exact" },
      ]),
    ).toEqual([]);
  });

  it("returns every not-ok pgTAP result", () => {
    expect(
      collectTapFailures([
        { has_table: "not ok 1 - profiles exists" },
        { diagnostics: "# Missing table public.profiles" },
        { has_column: "not ok 2 - role exists" },
      ]),
    ).toEqual([
      "not ok 1 - profiles exists",
      "not ok 2 - role exists",
    ]);
  });

  it("finds failures in multi-statement query results", () => {
    expect(
      collectTapFailures([
        { rows: [{ plan: "1..1" }] },
        { rows: [{ finish: "not ok 1 - RLS enabled" }] },
      ]),
    ).toEqual(["not ok 1 - RLS enabled"]);
  });
});

describe("analyzeTapResults", () => {
  it("rejects SQL output that does not contain a TAP plan", () => {
    expect(() => analyzeTapResults([{ result: "plain SQL output" }])).toThrow(
      /TAP plan/,
    );
  });

  it("accepts planned successful TAP output", () => {
    expect(
      analyzeTapResults([
        { plan: "1..1" },
        { assertion: "ok 1 - schema is secure" },
      ]),
    ).toEqual({ assertionCount: 1, plannedCount: 1 });
  });
});
