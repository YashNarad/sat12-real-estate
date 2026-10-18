"use client";

import { createBrowserClient as createSupabaseBrowserClient } from "@supabase/ssr";

import { getPublicSupabaseEnvironment } from "./config";
import type { Database } from "@/types/database.generated";

export function createBrowserClient() {
  const { url, publishableKey } = getPublicSupabaseEnvironment();
  return createSupabaseBrowserClient<Database>(url, publishableKey);
}
