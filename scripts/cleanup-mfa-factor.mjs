import { pathToFileURL } from "node:url";

import { createClient } from "@supabase/supabase-js";

import { validateTargetFromEnvironment } from "./supabase-target.mjs";

function required(name, value) {
  if (!value?.trim()) throw new Error(`SAT12_MFA_CLEANUP_CONFIGURATION_INVALID: ${name}`);
  return value.trim();
}

export function buildMfaCleanupConfiguration(env = process.env) {
  const { projectRef } = validateTargetFromEnvironment("mfa-factor-cleanup", env);
  return {
    projectRef,
    projectUrl: required("NEXT_PUBLIC_SUPABASE_URL", env.NEXT_PUBLIC_SUPABASE_URL),
    serviceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY", env.SUPABASE_SERVICE_ROLE_KEY),
    email: required("SAT12_MFA_CLEANUP_EMAIL", env.SAT12_MFA_CLEANUP_EMAIL).toLowerCase(),
  };
}

async function listAllUsers(client) {
  const users = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 100 });
    if (error || !data?.users) throw new Error("SAT12_MFA_CLEANUP_USER_LOOKUP_FAILED");
    users.push(...data.users);
    if (data.users.length < 100) return users;
  }
}

export function createMfaCleanupOperator(client) {
  return {
    listUsers: () => listAllUsers(client),
    async getRoleState(userId) {
      const [profileResult, adminResult] = await Promise.all([
        client.from("profiles").select("role").eq("id", userId).maybeSingle(),
        client.from("profiles").select("id", { count: "exact", head: true }).eq("role", "admin"),
      ]);
      if (profileResult.error || !profileResult.data || adminResult.error || adminResult.count === null) {
        throw new Error("SAT12_MFA_CLEANUP_ROLE_LOOKUP_FAILED");
      }
      return { role: profileResult.data.role, adminCount: adminResult.count };
    },
    async listFactors(userId) {
      const { data, error } = await client.auth.admin.mfa.listFactors({ userId });
      if (error || !data?.factors) throw new Error("SAT12_MFA_CLEANUP_FACTOR_LOOKUP_FAILED");
      return data.factors;
    },
    async deleteFactor(userId, id) {
      const { data, error } = await client.auth.admin.mfa.deleteFactor({ userId, id });
      if (error || data?.id !== id) throw new Error("SAT12_MFA_CLEANUP_DELETE_FAILED");
      return data;
    },
  };
}

function resolveTargetUser(users, email) {
  const matches = users.filter((user) => user.email?.trim().toLowerCase() === email);
  if (matches.length !== 1) throw new Error("SAT12_MFA_CLEANUP_USER_NOT_EXACT");
  if (!matches[0].email_confirmed_at) throw new Error("SAT12_MFA_CLEANUP_USER_UNCONFIRMED");
  return matches[0];
}

function assertRoleState(state) {
  if (state.adminCount !== 0) throw new Error("SAT12_MFA_CLEANUP_ADMIN_EXISTS");
  if (state.role !== "user") throw new Error("SAT12_MFA_CLEANUP_ROLE_INVALID");
}

function resolveOnlyStaleTotp(factors) {
  if (factors.length !== 1) throw new Error("SAT12_MFA_CLEANUP_FACTOR_COUNT_INVALID");
  const [candidate] = factors;
  if (candidate.factor_type !== "totp" || candidate.status !== "unverified") {
    throw new Error("SAT12_MFA_CLEANUP_FACTOR_NOT_STALE_TOTP");
  }
  return candidate;
}

export async function runMfaFactorCleanup(env = process.env, options = {}) {
  try {
    const configuration = buildMfaCleanupConfiguration(env);
    const client = options.operator
      ? null
      : createClient(configuration.projectUrl, configuration.serviceRoleKey, {
        auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
      });
    const operator = options.operator ?? createMfaCleanupOperator(client);
    const target = resolveTargetUser(await operator.listUsers(), configuration.email);
    assertRoleState(await operator.getRoleState(target.id));
    const candidate = resolveOnlyStaleTotp(await operator.listFactors(target.id));

    try {
      await operator.deleteFactor(target.id, candidate.id);
    } catch {
      throw new Error("SAT12_MFA_CLEANUP_DELETE_FAILED");
    }

    const [remainingFactors, finalRoleState] = await Promise.all([
      operator.listFactors(target.id),
      operator.getRoleState(target.id),
    ]);
    if (remainingFactors.length !== 0
      || finalRoleState.role !== "user"
      || finalRoleState.adminCount !== 0) {
      throw new Error("SAT12_MFA_CLEANUP_POSTCHECK_FAILED");
    }
    (options.write ?? ((message) => process.stdout.write(message)))(
      "SAT12 stale unverified TOTP factor removed and verified.\n",
    );
  } finally {
    delete env.SAT12_REMOTE_OPERATION_APPROVED;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runMfaFactorCleanup().catch((error) => {
    const message = error instanceof Error && error.message.startsWith("SAT12_")
      ? error.message
      : "SAT12_MFA_CLEANUP_FAILED";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
