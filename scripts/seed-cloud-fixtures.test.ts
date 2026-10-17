import { describe, expect, it } from "vitest";

import {
  assertCleanupOwnership,
  buildFixtureAccountRequirements,
  buildFixturePlan,
  buildFixtureStatements,
  loadNagpurFixtureDefinitions,
  validateFixtureOperation,
} from "./seed-cloud-fixtures.mjs";

const OWNER_ID = "10000000-0000-4000-8000-000000000001";

function approvedEnvironment(operation: "fixture-apply" | "fixture-cleanup") {
  return {
    NODE_ENV: "test" as const,
    SUPABASE_PROJECT_REF: "abcdefghijklmnopqrst",
    SAT12_APPROVED_PROJECT_REF: "abcdefghijklmnopqrst",
    NEXT_PUBLIC_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
    SAT12_DEVELOPMENT_DATA_CONFIRMED: "true",
    SAT12_REMOTE_OPERATION_APPROVED: `${operation}:abcdefghijklmnopqrst`,
  };
}

describe("fixture planning", () => {
  it("creates nine deterministic, run-scoped Nagpur fixtures", async () => {
    const definitions = await loadNagpurFixtureDefinitions();
    const first = buildFixturePlan("stage3-task1", OWNER_ID, definitions);
    const second = buildFixturePlan("stage3-task1", OWNER_ID, definitions);

    expect(first).toEqual(second);
    expect(first.properties).toHaveLength(9);
    expect(new Set(first.properties.map(({ id }) => id)).size).toBe(9);
    expect(first.properties.every(({ slug }) => slug.startsWith("fixture-stage3-task1-"))).toBe(true);
    expect(first.properties.every(({ ownerId }) => ownerId === OWNER_ID)).toBe(true);
    expect(
      first.images.every(({ storagePath }, index) =>
        storagePath.startsWith(
          `${OWNER_ID}/${first.properties[index].id}/${first.revisions[index].id}/`,
        ),
      ),
    ).toBe(true);
  });

  it("isolates identifiers between fixture runs", async () => {
    const definitions = await loadNagpurFixtureDefinitions();
    const first = buildFixturePlan("stage3-run-a", OWNER_ID, definitions);
    const second = buildFixturePlan("stage3-run-b", OWNER_ID, definitions);

    expect(first.properties.map(({ id }) => id)).not.toEqual(second.properties.map(({ id }) => id));
  });

  it("uses idempotent inserts and owner-scoped cleanup statements", () => {
    const statements = buildFixtureStatements();

    expect(statements.insertProperty).toMatch(/on conflict \(id\) do nothing/i);
    expect(statements.insertRevision).toMatch(/on conflict \(id\) do nothing/i);
    expect(statements.insertImage).toMatch(/on conflict \(id\) do nothing/i);
    expect(statements.deleteProperties).toMatch(/owner_id = \$2/i);
    expect(statements.deleteProperties).toMatch(/slug = any\(\$3/i);
  });

  it("rejects cleanup outside the exact run and owner boundary", async () => {
    const definitions = await loadNagpurFixtureDefinitions();
    const plan = buildFixturePlan("stage3-task1", OWNER_ID, definitions);
    const property = plan.properties[0];

    expect(() => assertCleanupOwnership(plan, property)).not.toThrow();
    expect(() => assertCleanupOwnership(plan, { ...property, ownerId: "20000000-0000-4000-8000-000000000002" })).toThrow(/owner/);
    expect(() => assertCleanupOwnership(plan, { ...property, slug: "real-customer-listing" })).toThrow(/run boundary/);
    expect(() => assertCleanupOwnership(plan, { ...property, id: "30000000-0000-4000-8000-000000000003" })).toThrow(/fixture plan/);
  });
});

describe("fixture account support", () => {
  it("describes accounts without creating Auth users or passwords", () => {
    expect(buildFixtureAccountRequirements()).toEqual({
      createsAuthUsers: false,
      accounts: [
        { alias: "owner", role: "owner_agent", profileIdEnvironmentVariable: "SAT12_FIXTURE_OWNER_PROFILE_ID" },
        { alias: "user", role: "user", profileIdEnvironmentVariable: "SAT12_FIXTURE_USER_PROFILE_ID" },
        { alias: "admin", role: "admin", profileIdEnvironmentVariable: "SAT12_FIXTURE_ADMIN_PROFILE_ID" },
      ],
    });
  });
});

describe("fixture operation guards", () => {
  it("requires distinct approval for apply and cleanup", () => {
    expect(() => validateFixtureOperation("apply", approvedEnvironment("fixture-apply"))).not.toThrow();
    expect(() => validateFixtureOperation("cleanup", approvedEnvironment("fixture-cleanup"))).not.toThrow();
    expect(() => validateFixtureOperation("cleanup", approvedEnvironment("fixture-apply"))).toThrow(/fixture-cleanup/);
  });

  it("refuses an unapproved project", () => {
    expect(() =>
      validateFixtureOperation("apply", {
        ...approvedEnvironment("fixture-apply"),
        SUPABASE_PROJECT_REF: "zzzzzzzzzzzzzzzzzzzz",
      }),
    ).toThrow(/APPROVED/);
  });
});
