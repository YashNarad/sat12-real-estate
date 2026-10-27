import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = path.resolve("supabase/migrations/20261027120000_stage5a_secure_enquiries.sql");

describe("Stage 5A enquiry migration", () => {
  it("snapshots a trusted recipient and permits anonymous senders without broad table writes", async () => {
    const sql = await readFile(migration, "utf8");
    expect(sql).toMatch(/add column recipient_id uuid/iu);
    expect(sql).toMatch(/alter column sender_id drop not null/iu);
    expect(sql).toMatch(/revoke insert[\s\S]*public\.enquiries from authenticated, anon/iu);
    expect(sql).not.toMatch(/grant (?:all|insert|update) on public\.enquiries to anon/iu);
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
    expect(sql).toMatch(/recipient_id = \(select auth\.uid\(\)\)/iu);
    expect(sql).toMatch(/private\.is_aal2_admin\(\)/iu);
    expect(sql).toMatch(/p_status not in \('new', 'contacted', 'closed'\)/iu);
    expect(sql).not.toMatch(/grant usage on schema private to anon/iu);
  });
});
