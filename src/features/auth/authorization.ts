import type { Database } from "@/types/database.generated";

export type AppRole = Database["public"]["Enums"]["app_role"];
export type AssuranceLevel = "aal1" | "aal2";

export interface AuthPrincipal {
  id: string;
  email: string | null;
  fullName: string | null;
  role: AppRole;
  aal: AssuranceLevel;
  mfaVerifiedAt: number | null;
}

export type AuthorizationCode =
  | "AUTH_REQUIRED"
  | "PROFILE_REQUIRED"
  | "ROLE_REQUIRED"
  | "MFA_REQUIRED";

export class AuthorizationError extends Error {
  constructor(public readonly code: AuthorizationCode) {
    super(code);
    this.name = "AuthorizationError";
  }
}

interface ClaimsResult {
  data: { claims?: Record<string, unknown> } | null;
  error: unknown;
}

interface UserResult {
  data: { user: { id: string; email?: string | null } | null };
  error: unknown;
}

interface ProfileResult {
  data: { role: AppRole; full_name: string | null } | null;
  error: unknown;
}

interface AuthorizationClient {
  auth: {
    getClaims(): Promise<ClaimsResult>;
    getUser(): Promise<UserResult>;
  };
  from(table: "profiles"): {
    select(columns: "role, full_name"): {
      eq(column: "id", value: string): { single(): PromiseLike<ProfileResult> };
    };
  };
}

interface AuthorizationOptions {
  client?: unknown;
  session?: unknown;
}

async function defaultClient(): Promise<AuthorizationClient> {
  const { createServerClient } = await import("@/lib/supabase/server");
  return (await createServerClient()) as unknown as AuthorizationClient;
}

function assuranceLevel(value: unknown): AssuranceLevel {
  return value === "aal2" ? "aal2" : "aal1";
}

function verifiedSubject(claims: Record<string, unknown> | undefined): string | null {
  if (!claims || typeof claims.sub !== "string" || claims.sub.length === 0) return null;
  if (typeof claims.exp !== "number" || claims.exp <= Math.floor(Date.now() / 1000)) return null;
  return claims.sub;
}

function latestTotpVerification(claims: Record<string, unknown> | undefined): number | null {
  if (!Array.isArray(claims?.amr)) return null;
  const timestamps = claims.amr.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const method = "method" in entry ? entry.method : undefined;
    const timestamp = "timestamp" in entry ? entry.timestamp : undefined;
    return (method === "totp" || method === "mfa/totp") && typeof timestamp === "number"
      ? [timestamp]
      : [];
  });
  return timestamps.length ? Math.max(...timestamps) : null;
}

export function safeReturnPath(value: string | null | undefined, fallback = "/"): string {
  if (!value || /[\\\u0000-\u001f]/u.test(value)) return fallback;
  try {
    const base = new URL("https://sat12.local");
    const target = new URL(value, base);
    if (target.origin !== base.origin || !value.startsWith("/")) return fallback;
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return fallback;
  }
}

export async function requireUser(options: AuthorizationOptions = {}): Promise<AuthPrincipal> {
  void options.session;
  const client = (options.client ?? (await defaultClient())) as AuthorizationClient;
  const claimsResult = await client.auth.getClaims();
  if (claimsResult.error) throw new AuthorizationError("AUTH_REQUIRED");
  const claims = claimsResult.data?.claims;
  const id = verifiedSubject(claims);
  if (!id) throw new AuthorizationError("AUTH_REQUIRED");

  // getClaims verifies the token locally, but only getUser asks Supabase Auth
  // whether that identity is still active (for example, not banned/disabled).
  const userResult = await client.auth.getUser();
  if (userResult.error || !userResult.data.user || userResult.data.user.id !== id) {
    throw new AuthorizationError("AUTH_REQUIRED");
  }

  const profileResult = await client
    .from("profiles")
    .select("role, full_name")
    .eq("id", id)
    .single();
  if (profileResult.error || !profileResult.data) {
    throw new AuthorizationError("PROFILE_REQUIRED");
  }

  return {
    id,
    email:
      userResult.data.user.email ??
      (typeof claims?.email === "string" ? claims.email : null),
    fullName: profileResult.data.full_name,
    role: profileResult.data.role,
    aal: assuranceLevel(claims?.aal),
    mfaVerifiedAt: latestTotpVerification(claims),
  };
}

export async function requireRole(
  roles: readonly AppRole[],
  options: AuthorizationOptions = {},
): Promise<AuthPrincipal> {
  const principal = await requireUser(options);
  if (!roles.includes(principal.role)) throw new AuthorizationError("ROLE_REQUIRED");
  return principal;
}

export function hasRecentMfa(principal: AuthPrincipal, now = Math.floor(Date.now() / 1000)) {
  return (
    principal.aal === "aal2" &&
    principal.mfaVerifiedAt !== null &&
    principal.mfaVerifiedAt >= now - 15 * 60
  );
}

export async function requireAal2Admin(
  options: AuthorizationOptions = {},
): Promise<AuthPrincipal> {
  const principal = await requireRole(["admin"], options);
  if (!hasRecentMfa(principal)) {
    throw new AuthorizationError("MFA_REQUIRED");
  }
  return principal;
}
