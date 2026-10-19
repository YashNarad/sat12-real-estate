import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createSupabaseServerClient, getClaims } = vi.hoisted(() => ({
  getClaims: vi.fn(),
  createSupabaseServerClient: vi.fn(
  (
    _url: string,
    _key: string,
    options: {
      cookies: {
        setAll: (
          cookies: Array<{
            name: string;
            value: string;
            options: Record<string, boolean | number | string>;
          }>,
        ) => void;
      };
    },
  ) => ({
    auth: {
      getClaims: async () => {
        options.cookies.setAll([
          {
            name: "sb-access-token",
            value: "refreshed",
            options: { httpOnly: true, sameSite: "lax", secure: true, path: "/" },
          },
          {
            name: "sb-stale-token",
            value: "",
            options: { maxAge: 0, httpOnly: true, path: "/" },
          },
        ]);
        return getClaims();
      },
    },
  })),
}));

vi.mock("server-only", () => ({}));
vi.mock("@supabase/ssr", () => ({ createServerClient: createSupabaseServerClient }));

import { updateSession } from "./proxy";
import { config as proxyConfig } from "@/proxy";

describe("Supabase session refresh proxy", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable-test-key");
    getClaims.mockResolvedValue({ data: { claims: {} }, error: null });
  });

  it("preserves refreshed and deleted cookie options on the response", async () => {
    const request = new NextRequest("https://sat12.example/");
    const response = await updateSession(request);

    expect(getClaims).toHaveBeenCalledOnce();
    expect(response.cookies.get("sb-access-token")?.value).toBe("refreshed");
    expect(response.cookies.get("sb-stale-token")?.value).toBe("");
    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("sb-access-token=refreshed");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Secure");
    expect(setCookie).toContain("sb-stale-token=");
    expect(setCookie).toContain("Max-Age=0");
  });

  it("refreshes sessions on the homepage where account identity is rendered", () => {
    expect(proxyConfig.matcher).toContain("/");
  });
});
