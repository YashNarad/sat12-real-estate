import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

async function sql(name: string) {
  return readFile(path.resolve("supabase/tests", name), "utf8");
}

describe("Task 2 cloud database test coverage", () => {
  it("covers anonymous, cross-owner, role escalation, and AAL1 denial", async () => {
    const source = await sql("properties_rls.test.sql");

    expect(source).toMatch(/anonymous cannot read a draft/i);
    expect(source).toMatch(/anonymous reads only active published property/i);
    expect(source).toMatch(/anonymous reads only current published revision/i);
    expect(source).toMatch(/owner reads own draft without recursion/i);
    expect(source).toMatch(/user cannot create a listing/i);
    expect(source).toMatch(/owner b cannot read owner a draft/i);
    expect(source).toMatch(/aal1 admin cannot change roles/i);
    expect(source).toMatch(/aal2 admin can approve owner role/i);
    expect(source).toMatch(/user cannot change own role/i);
    expect(source).toMatch(/owner cannot change revision status/i);
    expect(source).toMatch(/owner cannot set listing badge/i);
    expect(source).toMatch(/owner cannot change published pointer/i);
    expect(source).toMatch(/ordinary caller cannot bootstrap admin/i);
    expect(source).toMatch(/unconfirmed user cannot become first admin/i);
    expect(source).toMatch(/first admin bootstrap succeeds once/i);
    expect(source).toMatch(/second admin bootstrap is refused/i);
  });

  it("covers restricted enquiry submission, recipient isolation, and immutable content", async () => {
    const source = await sql("enquiries_rls.test.sql");

    expect(source).toMatch(/anonymous direct insert is denied/i);
    expect(source).toMatch(/anonymous submits to a published property through the rpc/i);
    expect(source).toMatch(/sender reads own enquiry/i);
    expect(source).toMatch(/unrelated user cannot read enquiries/i);
    expect(source).toMatch(/recipient changes allowed status/i);
    expect(source).toMatch(/recipient cannot update buyer fields directly/i);
    expect(source).toMatch(/authenticated sender submits through the rpc/i);
    expect(source).toMatch(/new property owner cannot read historic enquiry/i);
    expect(source).toMatch(/aal2 admin reads enquiries/i);
  });

  it("covers moderation, stale transitions, and stable publication identity", async () => {
    const source = await sql("listing_workflow.test.sql");

    expect(source).toMatch(/aal1 admin cannot approve/i);
    expect(source).toMatch(/rejection notes are required/i);
    expect(source).toMatch(/repeated approval is rejected/i);
    expect(source).toMatch(/approval does not publish/i);
    expect(source).toMatch(/stable slug survives revision publication/i);
    expect(source).toMatch(/previous publication is superseded/i);
    expect(source).toMatch(/aal1 admin cannot reject/i);
    expect(source).toMatch(/aal1 admin cannot publish/i);
    expect(source).toMatch(/aal1 admin cannot archive/i);
    expect(source).toMatch(/approval audit rows are immutable/i);
    expect(source).toMatch(/enquiry survives revision publication/i);
  });
});
