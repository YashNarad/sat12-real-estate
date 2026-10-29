import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

async function document(name: string) {
  return readFile(path.resolve("docs/security", name), "utf8");
}

describe("Stage 5C enquiry abuse operations contract", () => {
  it("documents every provider and trusted-proxy activation prerequisite", async () => {
    const source = await document("stage5c-enquiry-abuse-operations.md");

    expect(source).toMatch(/trusted proxy/iu);
    expect(source).toMatch(/atomic multi-window/iu);
    expect(source).toMatch(/provider-specific integration test/iu);
    expect(source).toMatch(/HMAC/iu);
    expect(source).toMatch(/key rotation/iu);
    expect(source).toMatch(/both submission gates remain disabled/iu);
  });

  it("defines privacy-safe observability and fail-closed incident response", async () => {
    const source = await document("stage5c-enquiry-abuse-operations.md");

    expect(source).toMatch(/aggregate-only/iu);
    expect(source).toMatch(/never log raw IP/iu);
    expect(source).toMatch(/buyer messages/iu);
    expect(source).toMatch(/fail closed/iu);
    expect(source).toMatch(/deactivat/iu);
    expect(source).toMatch(/deletion request/iu);
  });

  it("keeps the twelve-month proposal pending and unimplemented", async () => {
    const source = await document("stage5c-enquiry-abuse-operations.md");

    expect(source).toMatch(/twelve-month/iu);
    expect(source).toMatch(/pending privacy.*review/iu);
    expect(source).toMatch(/not implemented/iu);
  });

  it("links the existing enquiry security documentation to Stage 5C", async () => {
    const source = await document("stage5a-enquiries.md");
    expect(source).toMatch(/stage5c-enquiry-abuse-operations\.md/iu);
  });

  it("defines the hosted Vercel and Upstash validation boundary", async () => {
    const source = await document("stage5e-vercel-upstash-validation.md");

    expect(source).toMatch(/x-vercel-forwarded-for/iu);
    expect(source).toMatch(/attacker-controlled/iu);
    expect(source).toMatch(/direct deployment URL/iu);
    expect(source).toMatch(/one atomic EVAL/iu);
    expect(source).toMatch(/no automatic retry/iu);
    expect(source).toMatch(/timeout[\s\S]*consume/iu);
    expect(source).toMatch(/HMAC[\s\S]*version/iu);
    expect(source).toMatch(/credential overlap/iu);
    expect(source).toMatch(/raw IP/iu);
    expect(source).toMatch(/India[\s\S]*cross-border/iu);
    expect(source).toMatch(/rollback/iu);
    expect(source).toMatch(/both[\s\S]*gates[\s\S]*disabled/iu);
  });
});
