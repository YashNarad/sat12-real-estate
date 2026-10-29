import "server-only";

import ipaddr from "ipaddr.js";

import type { TrustedClientIpResolver } from "../abuse-protection";

type VercelRuntime = Readonly<
  Partial<Pick<NodeJS.ProcessEnv, "VERCEL" | "VERCEL_ENV">>
>;

function normalizePublicIp(value: string) {
  if (!value || value.includes(",") || value.includes("%")) return null;

  try {
    const address = ipaddr.process(value);
    if (address.range() !== "unicast") return null;
    return address.toString();
  } catch {
    return null;
  }
}

export function createVercelTrustedClientIpResolver(
  runtime: VercelRuntime,
): TrustedClientIpResolver {
  return {
    async resolve(headers) {
      if (runtime.VERCEL !== "1" || runtime.VERCEL_ENV !== "production") {
        return { status: "unavailable", reason: "unconfigured" };
      }

      try {
        const value = headers.get("x-vercel-forwarded-for");
        if (!value) return { status: "invalid", reason: "untrusted-source" };

        const ip = normalizePublicIp(value);
        if (!ip) return { status: "invalid", reason: "invalid-address" };
        return { status: "trusted", ip };
      } catch {
        return { status: "unavailable", reason: "provider-unavailable" };
      }
    },
  };
}
