import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = path.resolve(
  "supabase/migrations/20261031120000_stage5g_projects_locations.sql",
);

async function migrationSql() {
  return readFile(migrationPath, "utf8");
}

async function pgTapContract(file: string) {
  const sql = await readFile(path.resolve("supabase/tests", file), "utf8");
  const declared = Number(sql.match(/extensions\.plan\((\d+)\)/i)?.[1]);
  const discovered = (
    sql.match(/extensions\.(?:ok|is|isnt|like|unlike|throws_ok|lives_ok|has_[a-z_]+)\s*\(/gi) ?? []
  ).length;
  return { sql, declared, discovered };
}

describe("Stage 5G projects and locations migration", () => {
  it("creates versioned projects and locations with exact published pointers", async () => {
    const sql = await migrationSql();

    for (const table of [
      "projects",
      "project_revisions",
      "project_images",
      "project_rera_evidence",
      "project_approvals",
      "project_audit_log",
      "locations",
      "location_revisions",
      "location_audit_log",
    ]) {
      expect(sql).toMatch(new RegExp(`create table public\\.${table}\\b`, "i"));
      expect(sql).toMatch(
        new RegExp(`alter table public\\.${table} enable row level security`, "i"),
      );
    }

    expect(sql).toMatch(/foreign key \(published_revision_id, id\)[\s\S]*references public\.project_revisions \(id, project_id\)/i);
    expect(sql).toMatch(/foreign key \(published_revision_id, id\)[\s\S]*references public\.location_revisions \(id, location_id\)/i);
  });

  it("keeps project claims bounded and MahaRERA review fail closed", async () => {
    const sql = await migrationSql();

    expect(sql).toMatch(/price_max_inr is null or price_min_inr is not null/i);
    expect(sql).toMatch(/price_max_inr >= price_min_inr/i);
    expect(sql).toMatch(/extract\(day from possession_month\) = 1/i);
    expect(sql).toMatch(/construction_status <> 'ready_to_move'/i);
    expect(sql).toMatch(/position between 0 and 19/i);
    expect(sql).toMatch(/size_bytes <= 5242880/i);
    expect(sql).toMatch(/decision <> 'verified'/i);
    expect(sql).toMatch(/SAT12_PROJECT_RERA_NOT_VERIFIED/i);
  });

  it("adds backward-compatible exact property associations without backfill", async () => {
    const sql = await migrationSql();

    expect(sql).toMatch(/alter table public\.property_revisions[\s\S]*add column location_id uuid/i);
    expect(sql).toMatch(/add column project_id uuid/i);
    expect(sql).toMatch(/add column project_revision_id uuid/i);
    expect(sql).toMatch(/foreign key \(project_revision_id, project_id\)[\s\S]*references public\.project_revisions \(id, project_id\)/i);
    expect(sql).not.toMatch(/update public\.property_revisions[\s\S]*set location_id/i);
    expect(sql).toMatch(/create or replace function public\.create_listing_revision\(p_property_id uuid\)[\s\S]*v_source\.location_id[\s\S]*v_source\.project_revision_id/i);
    expect(sql).toMatch(/grant update \(location_id, project_id, project_revision_id\)[\s\S]*public\.property_revisions/i);
  });

  it("uses hardened lifecycle RPCs with AAL2 checks, locks, and immutable audits", async () => {
    const sql = await migrationSql();

    for (const fn of [
      "create_draft_project",
      "create_project_revision",
      "submit_project",
      "approve_project",
      "reject_project",
      "publish_project",
      "archive_project",
      "review_project_rera_evidence",
      "create_location",
      "create_location_revision",
      "publish_location",
      "archive_location",
    ]) {
      expect(sql).toMatch(
        new RegExp(`function public\\.${fn}\\([\\s\\S]*?security definer[\\s\\S]*?set search_path = ''`, "i"),
      );
    }

    expect(sql.match(/private\.is_aal2_admin\(\)/gi)?.length ?? 0).toBeGreaterThanOrEqual(8);
    expect(sql).toMatch(/for update of p, r/i);
    expect(sql).toMatch(/insert into public\.project_audit_log/i);
    expect(sql).toMatch(/insert into public\.location_audit_log/i);
    expect(sql).toMatch(/foreign key \(revision_id, project_id\)[\s\S]*references public\.project_revisions \(id, project_id\)/i);
    expect(sql).toMatch(/foreign key \(revision_id, location_id\)[\s\S]*references public\.location_revisions \(id, location_id\)/i);
    expect(sql).not.toMatch(/grant\s+(?:insert|update|delete)[^;]+(?:project_audit_log|location_audit_log|project_approvals)/i);
  });

  it("snapshots the exact published curated locality during project submission", async () => {
    const sql = await migrationSql();

    expect(sql).toMatch(/v_location\.published_revision_id[\s\S]*status = 'published'/i);
    expect(sql).toMatch(/select lr\.name into v_locality_name/i);
    expect(sql).toMatch(/locality_text = v_locality_name/i);
  });

  it("splits anonymous public reads from authenticated owner and AAL2 policies", async () => {
    const sql = await migrationSql();

    expect(sql).toMatch(/create policy "public reads published projects"[\s\S]*to anon, authenticated[\s\S]*published_revision_id = project_revisions\.id/i);
    expect(sql).toMatch(/create policy "public reads published project images"[\s\S]*to anon, authenticated/i);
    const publicPolicies = sql.match(/create policy "public reads[\s\S]*?;/gi) ?? [];
    expect(publicPolicies.every((policy) => !policy.includes("private.is_aal2_admin"))).toBe(true);
    expect(sql).toMatch(/create policy "owners read own projects"[\s\S]*to authenticated/i);
    expect(sql).toMatch(/create policy "aal2 admins read projects"[\s\S]*to authenticated[\s\S]*private\.is_aal2_admin\(\)/i);
  });

  it("defines a separate private project image bucket and exact path authorization", async () => {
    const sql = await migrationSql();

    expect(sql).toMatch(/insert into storage\.buckets[\s\S]*'project-images'[\s\S]*false[\s\S]*5242880/i);
    expect(sql).toMatch(/function private\.parse_project_image_path/i);
    expect(sql).toMatch(/function private\.can_insert_project_image_object/i);
    expect(sql).toMatch(/function private\.can_read_project_image_object/i);
    expect(sql).toMatch(/bucket_id = 'project-images'/i);
    expect(sql).not.toMatch(/update storage\.buckets[\s\S]*property-images/i);
  });

  it("uses least-privilege grants and keeps lifecycle columns out of direct writes", async () => {
    const sql = await migrationSql();

    expect(sql).toMatch(/revoke all on public\.projects from anon, authenticated/i);
    expect(sql).toMatch(/revoke all on public\.project_revisions from anon, authenticated/i);
    expect(sql).toMatch(/grant select on public\.projects, public\.project_revisions/i);
    expect(sql).toMatch(/grant update \([^)]+\) on public\.project_revisions to authenticated/i);
    expect(sql).not.toMatch(/grant\s+update\s+on public\.(?:projects|project_revisions|locations|location_revisions)/i);
    expect(sql).toMatch(/revoke all on function public\.publish_project\(uuid, text\) from public, anon/i);
  });

  it.each([
    ["projects_locations_schema.test.sql", 20],
    ["projects_locations_rls.test.sql", 30],
    ["project_storage_rls.test.sql", 18],
  ])("keeps %s at its reviewed assertion plan", async (file, expected) => {
    const contract = await pgTapContract(file);
    expect(contract.declared).toBe(expected);
    expect(contract.discovered).toBe(expected);
    expect(contract.sql).toMatch(/select \* from extensions\.finish\(\)/i);
  });

  it("covers the required security identities and fail-closed legal states", async () => {
    const schema = await pgTapContract("projects_locations_schema.test.sql");
    const rls = await pgTapContract("projects_locations_rls.test.sql");
    const storage = await pgTapContract("project_storage_rls.test.sql");
    const all = `${schema.sql}\n${rls.sql}\n${storage.sql}`;

    for (const marker of [
      "anonymous sees only exact published projects",
      "cross-owner project access is denied",
      "aal1 admin cannot approve a project",
      "not-applicable evidence cannot approve a project",
      "archived project images are not public",
      "property association requires the same owner",
      "project image paths bind every identifier",
    ]) {
      expect(all).toContain(marker);
    }
  });
});
