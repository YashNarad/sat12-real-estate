import { redirect } from "next/navigation";
import { connection } from "next/server";

import { logoutAction } from "@/app/actions/auth";
import { ManagementPortalShell } from "@/components/management/ManagementPortalShell";
import {
  AuthorizationError,
  requireAal2Admin,
} from "@/features/auth/authorization";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await connection();
  let principal;
  try {
    principal = await requireAal2Admin();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      if (error.code === "AUTH_REQUIRED") {
        redirect("/auth/login?next=%2Fadmin%2Fusers");
      }
      if (error.code === "MFA_REQUIRED") {
        redirect("/auth/mfa?next=%2Fadmin%2Fusers");
      }
      redirect("/account");
    }
    throw error;
  }

  const displayName = principal.fullName?.trim() || principal.email || "SAT12 administrator";
  return <ManagementPortalShell account={{ aal: principal.aal, displayName, role: principal.role }} logoutAction={logoutAction}>{children}</ManagementPortalShell>;
}
