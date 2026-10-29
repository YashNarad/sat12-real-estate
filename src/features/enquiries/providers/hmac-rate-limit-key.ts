import "server-only";

import { createHmac } from "node:crypto";

import type { RateLimitKeyDeriver } from "../abuse-protection";

type HmacRateLimitKeyConfiguration = Readonly<{
  secret: string;
  keyVersion: string;
}>;

function decodeSecret(secret: string) {
  if (!/^[A-Za-z0-9+/]+={0,2}$/u.test(secret) || secret.length % 4 !== 0) {
    return null;
  }
  const decoded = Buffer.from(secret, "base64");
  return decoded.length === 32 ? decoded : null;
}

export function createHmacRateLimitKeyDeriver(
  configuration: HmacRateLimitKeyConfiguration,
): RateLimitKeyDeriver {
  const secret = decodeSecret(configuration.secret);
  const version = /^[a-z0-9-]{1,16}$/u.test(configuration.keyVersion)
    ? configuration.keyVersion
    : null;

  return {
    async derive(trustedIp) {
      if (!secret || !version) {
        return { status: "unavailable", reason: "unconfigured" };
      }

      try {
        const digest = createHmac("sha256", secret)
          .update(`sat12/enquiry-ip/${version}/${trustedIp}`)
          .digest("hex");
        return {
          status: "derived",
          key: `sat12:enquiry-ip:${version}:${digest}`,
        };
      } catch {
        return { status: "unavailable", reason: "provider-unavailable" };
      }
    },
  };
}
