import { describe, expect, it, vi } from "vitest";

import {
  executeStorageApiTestRun,
  recoverFailedFixtureSetup,
  runCleanupSteps,
  runStorageApiSecurityScenarios,
  verifyFixtureCleanup,
  validateStorageApiTestOperation,
} from "./storage-api-tests.mjs";

const projectRef = "abcdefghijklmnopqrst";

function approvedEnvironment() {
  return {
    NODE_ENV: "test" as const,
    SUPABASE_PROJECT_REF: projectRef,
    SAT12_APPROVED_PROJECT_REF: projectRef,
    NEXT_PUBLIC_SUPABASE_URL: `https://${projectRef}.supabase.co`,
    SAT12_DEVELOPMENT_DATA_CONFIRMED: "true",
    SAT12_REMOTE_OPERATION_APPROVED: `storage-api-test:${projectRef}`,
  };
}

describe("Storage API test guard", () => {
  it("requires exact operation approval for the approved project", () => {
    expect(() => validateStorageApiTestOperation(approvedEnvironment())).not.toThrow();
    expect(() =>
      validateStorageApiTestOperation({
        ...approvedEnvironment(),
        SAT12_REMOTE_OPERATION_APPROVED: "",
      }),
    ).toThrow(/storage-api-test/);
    expect(() =>
      validateStorageApiTestOperation({
        ...approvedEnvironment(),
        SUPABASE_PROJECT_REF: "zzzzzzzzzzzzzzzzzzzz",
      }),
    ).toThrow(/APPROVED/);
  });
});

describe("authenticated Storage API security scenarios", () => {
  it("checks update and delete boundaries without using an operator client for actions", async () => {
    const existing = new Set(["submitted.webp", "published.webp", "held.webp"]);
    const owner = {
      upload: vi.fn(async (path: string, _body: Uint8Array, options: { upsert: boolean }) => {
        if (options.upsert && existing.has(path)) return { error: new Error("RLS denied") };
        existing.add(path);
        return { error: null };
      }),
      update: vi.fn(async () => ({ error: new Error("RLS denied") })),
      remove: vi.fn(async (paths: string[]) => {
        for (const path of paths) {
          if (path === "draft.webp" && metadataDeleted) existing.delete(path);
        }
        return { error: null };
      }),
    };
    const otherOwner = {
      remove: vi.fn(async () => ({ error: null })),
    };
    let metadataDeleted = false;
    const recordDraftMetadata = vi.fn(async () => undefined);
    const deleteDraftMetadata = vi.fn(async () => {
      metadataDeleted = true;
    });
    const observer = {
      exists: vi.fn(async (path: string) => existing.has(path)),
    };

    const results = await runStorageApiSecurityScenarios({
      owner,
      otherOwner,
      observer,
      recordDraftMetadata,
      deleteDraftMetadata,
      body: new Uint8Array([82, 73, 70, 70]),
      paths: {
        draft: "draft.webp",
        submitted: "submitted.webp",
        published: "published.webp",
        held: "held.webp",
      },
    });

    expect(results).toEqual([
      "owner upload",
      "update denied",
      "upsert denied",
      "cross-owner delete denied",
      "metadata-first delete denied",
      "submitted delete denied",
      "published delete denied",
      "legal-hold delete denied",
      "editable delete succeeds",
    ]);
    expect(owner.upload).toHaveBeenNthCalledWith(1, "draft.webp", expect.any(Uint8Array), {
      contentType: "image/webp",
      upsert: false,
    });
    expect(owner.upload).toHaveBeenNthCalledWith(2, "draft.webp", expect.any(Uint8Array), {
      contentType: "image/webp",
      upsert: true,
    });
    expect(owner.update).toHaveBeenCalledWith("draft.webp", expect.any(Uint8Array), {
      contentType: "image/webp",
      upsert: false,
    });
    expect(otherOwner.remove).toHaveBeenCalledWith(["draft.webp"]);
    expect(recordDraftMetadata).toHaveBeenCalledOnce();
    expect(deleteDraftMetadata).toHaveBeenCalledOnce();
    expect(await observer.exists("draft.webp")).toBe(false);
  });
});

describe("Storage API cleanup", () => {
  it("fails cleanup verification when a run-created profile remains", async () => {
    const end = vi.fn(async () => undefined);
    const query = vi.fn(async (sql: string) => {
      expect(sql).toContain("from public.profiles");
      expect(sql).toContain("from public.legal_holds");
      return {
        rows: [{
          users: 0,
          profiles: 1,
          properties: 0,
          revisions: 0,
          metadata: 0,
          legal_holds: 0,
          objects: 0,
        }],
      };
    });

    await expect(
      verifyFixtureCleanup({
        database: { query, end },
        userIds: ["00000000-0000-0000-0000-000000000001"],
        propertyIds: [],
        revisionIds: [],
        imageIds: [],
        paths: {},
      }),
    ).rejects.toThrow("SAT12_STORAGE_API_CLEANUP_VERIFICATION_FAILED");

    expect(end).toHaveBeenCalledOnce();
  });

  it("fails cleanup verification when a run-created legal hold remains", async () => {
    const end = vi.fn(async () => undefined);
    const query = vi.fn(async () => ({
      rows: [{
        users: 0,
        profiles: 0,
        properties: 0,
        revisions: 0,
        metadata: 0,
        legal_holds: 1,
        objects: 0,
      }],
    }));

    await expect(
      verifyFixtureCleanup({
        database: { query, end },
        userIds: [],
        propertyIds: [],
        revisionIds: [],
        imageIds: ["00000000-0000-0000-0000-000000000002"],
        paths: {},
      }),
    ).rejects.toThrow("SAT12_STORAGE_API_CLEANUP_VERIFICATION_FAILED");

    expect(end).toHaveBeenCalledOnce();
  });

  it("cleans and verifies a partially created fixture before reporting setup failure", async () => {
    const fixture = { runId: "partial-run" };
    const cleanup = vi.fn(async () => {
      throw new Error("partial cleanup failed");
    });
    const verifyCleanup = vi.fn(async () => undefined);

    await expect(
      recoverFailedFixtureSetup({
        fixture,
        setupError: new Error("setup failed"),
        cleanupFixture: cleanup,
        verifyCleanup,
      }),
    ).rejects.toThrow("Storage API fixture setup and recovery failed");

    expect(cleanup).toHaveBeenCalledWith(fixture);
    expect(verifyCleanup).toHaveBeenCalledWith(fixture);
  });

  it("attempts every run-scoped cleanup step and reports aggregate failure", async () => {
    const calls: string[] = [];

    await expect(
      runCleanupSteps([
        async () => {
          calls.push("metadata");
          throw new Error("metadata cleanup failed");
        },
        async () => {
          calls.push("objects");
        },
        async () => {
          calls.push("users");
          throw new Error("user cleanup failed");
        },
      ]),
    ).rejects.toThrow("2 Storage API cleanup steps failed");

    expect(calls).toEqual(["metadata", "objects", "users"]);
  });

  it("always cleans and verifies only the run-scoped fixture", async () => {
    const cleanup = vi.fn(async () => undefined);
    const verifyCleanup = vi.fn(async () => undefined);

    await expect(
      executeStorageApiTestRun({
        createFixture: async () => ({ runId: "run-1" }),
        runScenarios: async () => {
          throw new Error("scenario failed");
        },
        cleanupFixture: cleanup,
        verifyCleanup,
      }),
    ).rejects.toThrow("scenario failed");

    expect(cleanup).toHaveBeenCalledWith({ runId: "run-1" });
    expect(verifyCleanup).toHaveBeenCalledWith({ runId: "run-1" });
  });

  it("still performs post-test verification when cleanup reports a failure", async () => {
    const verifyCleanup = vi.fn(async () => undefined);

    await expect(
      executeStorageApiTestRun({
        createFixture: async () => ({ runId: "run-2" }),
        runScenarios: async () => ["owner upload"],
        cleanupFixture: async () => {
          throw new Error("cleanup failed");
        },
        verifyCleanup,
      }),
    ).rejects.toThrow("cleanup failed");

    expect(verifyCleanup).toHaveBeenCalledWith({ runId: "run-2" });
  });
});
