import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { safeReturnPath } from "@/features/auth/authorization";
import { getTrustedSiteOrigin } from "@/lib/supabase/config";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const next = safeReturnPath(url.searchParams.get("next"));
  const siteOrigin = getTrustedSiteOrigin();
  const client = await createServerClient();
  let error: unknown = null;
  if (code) {
    ({ error } = await client.auth.exchangeCodeForSession(code));
  } else if (tokenHash && type) {
    ({ error } = await client.auth.verifyOtp({ token_hash: tokenHash, type }));
  } else {
    error = new Error("Missing auth callback token");
  }
  if (error) return NextResponse.redirect(new URL("/auth/login?error=callback", siteOrigin));
  return NextResponse.redirect(new URL(next, siteOrigin));
}
