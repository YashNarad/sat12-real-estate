import { describe, expect, it } from "vitest";

import {
  validateDatabaseUrl,
  validateSupabaseTarget,
} from "./supabase-target.mjs";

const projectRef = "abcdefghijklmnopqrst";

const validInput = {
  projectRef,
  approvedProjectRef: projectRef,
  projectUrl: `https://${projectRef}.supabase.co`,
  dataConfirmed: "true",
  operation: "read",
  operationApproval: undefined,
};

describe("validateSupabaseTarget", () => {
  it("accepts a read against the confirmed approved development project", () => {
    expect(validateSupabaseTarget(validInput)).toEqual({
      operation: "read",
      projectRef,
    });
  });

  it.each([
    ["missing approved ref", { approvedProjectRef: undefined }],
    ["different approved ref", { approvedProjectRef: "zyxwvutsrqponmlkjihg" }],
    ["different URL host", { projectUrl: "https://zyxwvutsrqponmlkjihg.supabase.co" }],
    ["unconfirmed data classification", { dataConfirmed: "false" }],
  ])("rejects %s", (_name, overrides) => {
    expect(() => validateSupabaseTarget({ ...validInput, ...overrides })).toThrow();
  });

  it("requires operation-specific approval for remote mutations", () => {
    expect(() =>
      validateSupabaseTarget({ ...validInput, operation: "migrate" }),
    ).toThrow(/SAT12_REMOTE_OPERATION_APPROVED/);

    expect(
      validateSupabaseTarget({
        ...validInput,
        operation: "migrate",
        operationApproval: `migrate:${projectRef}`,
      }),
    ).toEqual({ operation: "migrate", projectRef });
  });

  it("does not let approval for one operation authorize another", () => {
    expect(() =>
      validateSupabaseTarget({
        ...validInput,
        operation: "seed",
        operationApproval: `migrate:${projectRef}`,
      }),
    ).toThrow(/seed/);
  });

  it.each(["fixture-apply", "fixture-cleanup"])(
    "requires operation-specific approval for %s",
    (operation) => {
      expect(() => validateSupabaseTarget({ ...validInput, operation })).toThrow(
        new RegExp(operation),
      );
      expect(
        validateSupabaseTarget({
          ...validInput,
          operation,
          operationApproval: `${operation}:${projectRef}`,
        }),
      ).toEqual({ operation, projectRef });
    },
  );

  it("requires explicit approval before running cloud database tests", () => {
    expect(() =>
      validateSupabaseTarget({ ...validInput, operation: "test" }),
    ).toThrow(/test/);

    expect(
      validateSupabaseTarget({
        ...validInput,
        operation: "test",
        operationApproval: `test:${projectRef}`,
      }),
    ).toEqual({ operation: "test", projectRef });
  });

  it("requires separate approval for non-transactional Storage API tests", () => {
    expect(() =>
      validateSupabaseTarget({ ...validInput, operation: "storage-api-test" }),
    ).toThrow(/storage-api-test/);

    expect(
      validateSupabaseTarget({
        ...validInput,
        operation: "storage-api-test",
        operationApproval: `storage-api-test:${projectRef}`,
      }),
    ).toEqual({ operation: "storage-api-test", projectRef });
  });
});

describe("validateDatabaseUrl", () => {
  it("accepts the approved project's direct database host", () => {
    expect(
      validateDatabaseUrl(
        `postgresql://postgres:secret@db.${projectRef}.supabase.co:5432/postgres`,
        projectRef,
      ),
    ).toBeUndefined();
  });

  it("accepts the approved project's Supabase pooler identity", () => {
    expect(
      validateDatabaseUrl(
        `postgresql://postgres.${projectRef}:secret@aws-0-ap-south-1.pooler.supabase.com:6543/postgres`,
        projectRef,
      ),
    ).toBeUndefined();
  });

  it("rejects a database URL for a different project", () => {
    expect(() =>
      validateDatabaseUrl(
        "postgresql://postgres.zyxwvutsrqponmlkjihg:secret@aws-0-ap-south-1.pooler.supabase.com:6543/postgres",
        projectRef,
      ),
    ).toThrow(/approved project/);
  });
});
