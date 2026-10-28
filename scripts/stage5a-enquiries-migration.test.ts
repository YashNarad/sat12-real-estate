import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = path.resolve("supabase/migrations/20261027120000_stage5a_secure_enquiries.sql");

describe("Stage 5A enquiry migration", () => {
  it("fails closed before schema changes when historic recipients need provenance review", async () => {
    const sql = await readFile(migration, "utf8");
    const guard = sql.indexOf("SAT12_ENQUIRY_HISTORIC_RECIPIENT_REVIEW_REQUIRED");
    const schemaChange = sql.indexOf("alter table public.enquiries");
    expect(guard).toBeGreaterThanOrEqual(0);
    expect(guard).toBeLessThan(schemaChange);
    expect(sql).not.toMatch(/set recipient_id = p\.owner_id/iu);
  });

  it("snapshots a trusted recipient and permits anonymous senders without broad table writes", async () => {
    const sql = await readFile(migration, "utf8");
    expect(sql).toMatch(/add column recipient_id uuid/iu);
    expect(sql).toMatch(/alter column sender_id drop not null/iu);
    expect(sql).toMatch(/revoke insert[\s\S]*public\.enquiries from authenticated, anon/iu);
    expect(sql).not.toMatch(/grant (?:all|insert|update) on public\.enquiries to anon/iu);
  });

  it("revokes every legacy authenticated column write privilege as well as table writes", async () => {
    const sql = await readFile(migration, "utf8");
    expect(sql).toMatch(/revoke insert\s*\(\s*property_id,\s*property_revision_id_at_submission,\s*sender_id,\s*name,\s*email,\s*phone,\s*message\s*\)\s*on public\.enquiries from authenticated/iu);
    expect(sql).toMatch(/revoke update\s*\(\s*status,\s*closed_at\s*\)\s*on public\.enquiries from authenticated/iu);
    expect(sql).toMatch(/revoke insert on public\.enquiries from authenticated, anon/iu);
    expect(sql).toMatch(/revoke update on public\.enquiries from authenticated, anon/iu);
  });

  it("exposes only guarded submission and status RPCs with fixed search paths", async () => {
    const sql = await readFile(migration, "utf8");
    expect(sql).toMatch(/function public\.submit_property_enquiry\([\s\S]*security definer[\s\S]*set search_path = ''/iu);
    expect(sql).toMatch(/grant execute on function public\.submit_property_enquiry[\s\S]*to anon, authenticated/iu);
    expect(sql).toMatch(/function public\.update_enquiry_status\([\s\S]*security definer[\s\S]*set search_path = ''/iu);
    expect(sql).toMatch(/grant execute on function public\.update_enquiry_status[\s\S]*to authenticated/iu);
  });

  it("derives eligibility, revision and recipient from locked trusted rows", async () => {
    const sql = await readFile(migration, "utf8");
    expect(sql).toMatch(/p\.published_revision_id = r\.id/iu);
    expect(sql).toMatch(/p\.archived_at is null/iu);
    expect(sql).toMatch(/r\.status = 'published'/iu);
    expect(sql).toMatch(/for update of p, r/iu);
    expect(sql).toMatch(/v_property\.owner_id/iu);
    expect(sql).toMatch(/current_setting\('app\.settings\.enquiry_submissions_enabled'/iu);
    expect(sql).toMatch(/p_name is null or p_email is null or p_message is null/iu);
    expect(sql).toMatch(/trim\(p_phone\)\s*!~/iu);
  });

  it("keeps reads private and status updates restricted to the snapshotted recipient or AAL2 admin", async () => {
    const sql = await readFile(migration, "utf8");
    expect(sql.match(/recipient_id = \(select auth\.uid\(\)\)[\s\S]{0,100}private\.is_owner_agent\(\)/giu)).toHaveLength(2);
    expect(sql).toMatch(/private\.is_aal2_admin\(\)/iu);
    expect(sql).toMatch(/p_status not in \('new', 'contacted', 'closed'\)/iu);
    expect(sql).not.toMatch(/grant usage on schema private to anon/iu);
  });

  it("serializes the global email throttle with a normalized transaction lock", async () => {
    const sql = await readFile(migration, "utf8");
    expect(sql).toMatch(/pg_advisory_xact_lock\(pg_catalog\.hashtextextended\(v_email,/iu);
    expect(sql).not.toMatch(/pg_advisory_xact_lock[\s\S]{0,120}p_property_id::text \|\| ':' \|\| v_email/iu);
  });
});
