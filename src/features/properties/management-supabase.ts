import "server-only";

import { createServerClient } from "@/lib/supabase/server";

export async function createManagementClient() {
  const supabase = await createServerClient();
  return {
    rpc: async (name: string, args: Record<string, unknown>) => {
      const result = await supabase.rpc(name as never, args as never);
      return result as unknown as { data: unknown; error: { code?: string; message?: string } | null };
    },
    getRevision: async (id: string) => {
      const result = await supabase.from("property_revisions")
        .select("id, property_id, status, updated_at, properties!inner(owner_id, published_revision_id)")
        .eq("id", id).maybeSingle();
      return result as unknown as { data: Record<string, unknown> | null; error: { code?: string } | null };
    },
    updateRevision: async (id: string, fields: Record<string, unknown>, expectedUpdatedAt?: string) => {
      let query = supabase.from("property_revisions").update(fields as never).eq("id", id);
      if (expectedUpdatedAt) query = query.eq("updated_at", expectedUpdatedAt);
      const result = await query.select("id, property_id, updated_at").maybeSingle();
      if (!result.error && !result.data) return { data: null, error: { code: "23505", message: "SAT12_STALE_REVISION_STATE" } };
      return result as unknown as { data: unknown; error: { code?: string; message?: string } | null };
    },
    deleteRevision: async (id: string) => supabase.from("property_revisions").delete().eq("id", id),
    insertImage: async (fields: Record<string, unknown>) => {
      const result = await supabase.from("property_images").insert(fields as never).select("id").single();
      return result as unknown as { data: unknown; error: { code?: string } | null };
    },
    deleteImage: async (id: string) => supabase.from("property_images").delete().eq("id", id),
    getImage: async (id: string, revisionId: string, path: string) => supabase.from("property_images")
      .select("id, revision_id, storage_path").eq("id", id).eq("revision_id", revisionId)
      .eq("storage_path", path).maybeSingle(),
    raw: supabase,
  };
}
