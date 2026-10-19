import "server-only";

import { AuthorizationError, requireUser } from "./authorization";

export interface HomepageAccount {
  displayName: string;
  initial: string;
}

export async function getHomepageAccount(
  options: { client?: unknown } = {},
): Promise<HomepageAccount | null> {
  try {
    const principal = await requireUser(options);
    const displayName = principal.fullName?.trim() || principal.email || "Account";
    return {
      displayName,
      initial: displayName.slice(0, 1).toLocaleUpperCase() || "A",
    };
  } catch (error) {
    if (error instanceof AuthorizationError) return null;
    throw error;
  }
}
