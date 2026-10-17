import { describe, expect, it, vi } from "vitest";

import {
  applyPropertyImageFixtures,
  buildPropertyImageFixturePlan,
  validatePropertyImageFixtureOperation,
} from "./seed-property-images.mjs";

const ownerId = "51000000-0000-4000-8000-000000000001";

function approvedEnvironment(operation: "storage-fixture-apply" | "storage-fixture-cleanup") {
  return {
    NODE_ENV: "test" as const,
    SUPABASE_PROJECT_REF: "abcdefghijklmnopqrst",
    SAT12_APPROVED_PROJECT_REF: "abcdefghijklmnopqrst",
    NEXT_PUBLIC_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
    SAT12_DEVELOPMENT_DATA_CONFIRMED: "true",
    SAT12_REMOTE_OPERATION_APPROVED: `${operation}:abcdefghijklmnopqrst`,
  };
}

describe("property-image fixture planning", () => {
  it("creates nine immutable revision-scoped WebP paths", () => {
    const definitions = Array.from({ length: 9 }, (_, index) => ({
      key: `property-${index + 1}`,
      image: `property-${String(index + 1).padStart(2, "0")}.webp`,
    }));
    const first = buildPropertyImageFixturePlan("storage-run", ownerId, definitions);
    const second = buildPropertyImageFixturePlan("storage-run", ownerId, definitions);

    expect(first).toEqual(second);
    expect(first.objects).toHaveLength(9);
    expect(new Set(first.objects.map(({ path }) => path)).size).toBe(9);
    expect(
      first.objects.every(({ path }) =>
        new RegExp(`^${ownerId}/[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\\.webp$`).test(path),
      ),
    ).toBe(true);
  });

  it("requires operation-specific approval and rejects unknown targets", () => {
    expect(() =>
      validatePropertyImageFixtureOperation("apply", approvedEnvironment("storage-fixture-apply")),
    ).not.toThrow();
    expect(() =>
      validatePropertyImageFixtureOperation("cleanup", approvedEnvironment("storage-fixture-cleanup")),
    ).not.toThrow();
    expect(() =>
      validatePropertyImageFixtureOperation("cleanup", approvedEnvironment("storage-fixture-apply")),
    ).toThrow(/storage-fixture-cleanup/);
    expect(() =>
      validatePropertyImageFixtureOperation("apply", {
        ...approvedEnvironment("storage-fixture-apply"),
        SUPABASE_PROJECT_REF: "zzzzzzzzzzzzzzzzzzzz",
      }),
    ).toThrow(/APPROVED/);
  });
});

describe("property-image fixture upload", () => {
  it("never upserts and removes only objects uploaded by the failed run", async () => {
    const remove = vi.fn().mockResolvedValue({ error: null });
    const upload = vi
      .fn()
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: new Error("upload failed") });
    const plan = {
      objects: [
        { path: `${ownerId}/p/r/a.webp`, sourceFile: "a.webp" },
        { path: `${ownerId}/p/r/b.webp`, sourceFile: "b.webp" },
      ],
    };

    await expect(
      applyPropertyImageFixtures(plan, { upload, remove }, async (file: string) => file),
    ).rejects.toThrow("SAT12_STORAGE_FIXTURE_UPLOAD_FAILED");
    expect(upload).toHaveBeenCalledWith(expect.any(String), expect.any(String), {
      contentType: "image/webp",
      upsert: false,
    });
    expect(remove).toHaveBeenCalledWith([plan.objects[0].path]);
  });
});
