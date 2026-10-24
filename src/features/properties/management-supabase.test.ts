import { describe, expect, it, vi } from "vitest";

const REVISION_ID = "33000000-0000-4000-8000-000000000001";

const harness = vi.hoisted(() => ({
  selected: "",
  filteredId: "",
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(async () => ({
    from: vi.fn(() => ({
      select: (columns: string) => {
        harness.selected = columns;
        return {
          eq: (_column: string, id: string) => {
            harness.filteredId = id;
            return {
              maybeSingle: async () => ({
                data: {
                  id,
                  property_id: "32000000-0000-4000-8000-000000000001",
                  status: "draft",
                  properties: {
                    owner_id: "31000000-0000-4000-8000-000000000001",
                    published_revision_id: null,
                  },
                },
                error: null,
              }),
            };
          },
        };
      },
    })),
  })),
}));

import { createManagementClient } from "./management-supabase";

describe("property management Supabase adapter", () => {
  it("loads image authorization metadata through the revision property foreign key", async () => {
    const client = await createManagementClient();

    const result = await client.getRevision(REVISION_ID);

    expect(result.error).toBeNull();
    expect(harness.filteredId).toBe(REVISION_ID);
    expect(harness.selected).toContain(
      "properties!property_revisions_property_id_fkey!inner(owner_id, published_revision_id)",
    );
  });
});
