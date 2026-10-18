import { describe, expect, it } from "vitest";

import { getPublicSupabaseEnvironment, getTrustedSiteOrigin } from "./config";

describe("Supabase public environment", () => {
  it("returns only the project URL and publishable key", () => {
    expect(
      getPublicSupabaseEnvironment({
        NEXT_PUBLIC_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
        SUPABASE_SERVICE_ROLE_KEY: "must-not-leak",
      }),
    ).toEqual({
      url: "https://abcdefghijklmnopqrst.supabase.co",
      publishableKey: "publishable-key",
    });
  });

  it("rejects missing or non-HTTPS public configuration", () => {
    expect(() => getPublicSupabaseEnvironment({})).toThrow("NEXT_PUBLIC_SUPABASE_URL");
    expect(() =>
      getPublicSupabaseEnvironment({
        NEXT_PUBLIC_SUPABASE_URL: "http://abcdefghijklmnopqrst.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      }),
    ).toThrow("HTTPS");
  });
});

describe("trusted SAT12 site origin", () => {
  it("accepts an HTTPS origin without path, credentials, query, or fragment", () => {
    expect(
      getTrustedSiteOrigin({
        NEXT_PUBLIC_SITE_URL: "https://sat12.example",
        NODE_ENV: "production",
      }),
    ).toBe("https://sat12.example");
  });

  it.each([
    "http://sat12.example",
    "https://user:password@sat12.example",
    "https://sat12.example/auth/callback",
    "https://sat12.example?next=https://evil.example",
    "https://sat12.example#fragment",
  ])("rejects an unsafe configured site URL: %s", (url) => {
    expect(() =>
      getTrustedSiteOrigin({ NEXT_PUBLIC_SITE_URL: url, NODE_ENV: "production" }),
    ).toThrow(/NEXT_PUBLIC_SITE_URL/);
  });

  it("uses localhost only outside production and requires explicit production configuration", () => {
    expect(getTrustedSiteOrigin({ NODE_ENV: "test" })).toBe("http://localhost:3000");
    expect(() => getTrustedSiteOrigin({ NODE_ENV: "production" })).toThrow(
      /NEXT_PUBLIC_SITE_URL/,
    );
  });
});
