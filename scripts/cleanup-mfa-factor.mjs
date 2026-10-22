import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { Client } from "pg";
import { createClient } from "@supabase/supabase-js";

import { buildVerifiedTlsConfig } from "./cloud-db-test-runner.mjs";
import {
  validateDatabaseUrl,
  validateTargetFromEnvironment,
} from "./supabase-target.mjs";

const SUPABASE_ROOT_CA_PATH = path.resolve("certificates/supabase-root-2021-ca.crt");

function required(name, value) {
  if (!value?.trim()) throw new Error(`SAT12_MFA_CLEANUP_CONFIGURATION_INVALID: ${name}`);
  return value.trim();
}

export function buildMfaCleanupConfiguration(env = process.env) {
  const { projectRef } = validateTargetFromEnvironment("mfa-factor-cleanup", env);
  const databaseUrl = required("SUPABASE_DB_URL", env.SUPABASE_DB_URL);
  validateDatabaseUrl(databaseUrl, projectRef);
  return {
    projectRef,
    projectUrl: required("NEXT_PUBLIC_SUPABASE_URL", env.NEXT_PUBLIC_SUPABASE_URL),
    serviceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY", env.SUPABASE_SERVICE_ROLE_KEY),
    databaseUrl,
    certificatePath: env.SUPABASE_SSL_ROOT_CERT || SUPABASE_ROOT_CA_PATH,
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

export function createMfaCleanupRoleReader(database) {
  return {
    async getRoleState(userId) {
      try {
        await database.query("begin read only");
        const result = await database.query(
          `select
             (select role::text from public.profiles where id = $1) as role,
             (select count(*)::int from public.profiles where role = 'admin') as admin_count`,
          [userId],
        );
        const state = result.rows?.[0];
        if (result.rowCount !== 1
          || typeof state?.role !== "string"
          || !Number.isInteger(state?.admin_count)
          || state.admin_count < 0) {
          throw new Error("SAT12_MFA_CLEANUP_ROLE_LOOKUP_FAILED");
        }
        await database.query("commit");
        return { role: state.role, adminCount: state.admin_count };
      } catch {
        await database.query("rollback").catch(() => {});
        throw new Error("SAT12_MFA_CLEANUP_ROLE_LOOKUP_FAILED");
      }
    },
  };
}

async function openMfaCleanupRoleReader(configuration) {
  const certificate = await readFile(configuration.certificatePath, "utf8");
  const database = new Client({
    connectionString: configuration.databaseUrl,
    ssl: buildVerifiedTlsConfig(certificate),
  });
  await database.connect();
  return {
    ...createMfaCleanupRoleReader(database),
    close: () => database.end(),
  };
}

export function createMfaCleanupOperator(client, roleReader) {
  return {
    listUsers: () => listAllUsers(client),
    getRoleState: (userId) => roleReader.getRoleState(userId),
    async listFactors(userId) {
      const { data, error } = await client.auth.admin.mfa.listFactors({ userId });
      if (error || !data?.factors) throw new Error("SAT12_MFA_CLEANUP_FACTOR_LOOKUP_FAILED");
      return data.factors;
    },
    async deleteFactor(userId, id) {
      try {
        const { data, error } = await client.auth.admin.mfa.deleteFactor({ userId, id });
        if (error) throw new Error("SAT12_MFA_CLEANUP_DELETE_FAILED");
        const responseId = data?.id ?? data?.data?.id;
        return { acknowledged: responseId === id };
      } catch {
        throw new Error("SAT12_MFA_CLEANUP_DELETE_FAILED");
      }
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
  let roleReader;
  try {
    const configuration = buildMfaCleanupConfiguration(env);
    const client = options.operator
      ? null
      : createClient(configuration.projectUrl, configuration.serviceRoleKey, {
        auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
      });
    roleReader = options.operator ? null : await openMfaCleanupRoleReader(configuration);
    const operator = options.operator ?? createMfaCleanupOperator(client, roleReader);
    const target = resolveTargetUser(await operator.listUsers(), configuration.email);
    assertRoleState(await operator.getRoleState(target.id));
    const candidate = resolveOnlyStaleTotp(await operator.listFactors(target.id));

    await operator.deleteFactor(target.id, candidate.id).catch(() => null);

    let remainingFactors;
    let finalRoleState;
    try {
      [remainingFactors, finalRoleState] = await Promise.all([
        operator.listFactors(target.id),
        operator.getRoleState(target.id),
      ]);
    } catch {
      throw new Error("SAT12_MFA_CLEANUP_OUTCOME_UNCERTAIN");
    }
    if (finalRoleState.role !== "user" || finalRoleState.adminCount !== 0) {
      throw new Error("SAT12_MFA_CLEANUP_POSTCHECK_FAILED");
    }
    if (remainingFactors.some((factor) => factor.id === candidate.id)) {
      throw new Error("SAT12_MFA_CLEANUP_DELETE_FAILED");
    }
    if (remainingFactors.length !== 0) throw new Error("SAT12_MFA_CLEANUP_POSTCHECK_FAILED");
    (options.write ?? ((message) => process.stdout.write(message)))(
      "SAT12 stale unverified TOTP factor removed and verified.\n",
    );
  } finally {
    try {
      await roleReader?.close();
    } finally {
      delete env.SAT12_REMOTE_OPERATION_APPROVED;
    }
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
