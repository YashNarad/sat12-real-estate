import { describe, expect, it } from "vitest";

import {
  buildBootstrapConfiguration,
  findConfirmedUserByEmail,
} from "./bootstrap-admin.mjs";

const PROJECT_REF = "abcdefghijklmnopqrst";

function approvedEnvironment() {
  return {
    NODE_ENV: "test" as const,
    SUPABASE_PROJECT_REF: PROJECT_REF,
    SAT12_APPROVED_PROJECT_REF: PROJECT_REF,
    NEXT_PUBLIC_SUPABASE_URL: `https://${PROJECT_REF}.supabase.co`,
    SAT12_DEVELOPMENT_DATA_CONFIRMED: "true",
    SAT12_REMOTE_OPERATION_APPROVED: `bootstrap:${PROJECT_REF}`,
    SUPABASE_SERVICE_ROLE_KEY: "test-only-placeholder",
    SAT12_BOOTSTRAP_ADMIN_EMAIL: "admin@example.test",
    SAT12_BOOTSTRAP_REASON: "Initial SAT12 development administrator",
  };
}

describe("first-admin bootstrap guard", () => {
  it("requires exact project approval and process-only inputs", () => {
    expect(buildBootstrapConfiguration(approvedEnvironment())).toEqual({
      projectRef: PROJECT_REF,
      projectUrl: `https://${PROJECT_REF}.supabase.co`,
      serviceRoleKey: "test-only-placeholder",
      email: "admin@example.test",
      reason: "Initial SAT12 development administrator",
    });
    expect(() =>
      buildBootstrapConfiguration({
        ...approvedEnvironment(),
        SAT12_REMOTE_OPERATION_APPROVED: "",
      }),
    ).toThrow(/bootstrap/);
  });

  it("resolves one exact email-confirmed user and rejects ambiguity", () => {
    const confirmed = {
      id: "10000000-0000-4000-8000-000000000001",
      email: "admin@example.test",
      email_confirmed_at: "2026-10-15T00:00:00.000Z",
    };
    expect(findConfirmedUserByEmail([confirmed], "ADMIN@example.test")).toEqual(confirmed);
    expect(() =>
      findConfirmedUserByEmail(
        [confirmed, { ...confirmed, id: "20000000-0000-4000-8000-000000000002" }],
        "admin@example.test",
      ),
    ).toThrow(/exactly one/);
    expect(() =>
      findConfirmedUserByEmail(
        [{ ...confirmed, email_confirmed_at: null }],
        "admin@example.test",
      ),
    ).toThrow(/confirmed/);
  });
});
