import { redirect } from "next/navigation";
import { connection } from "next/server";
import { logoutAction } from "@/app/actions/auth";
import { ManagementPortalShell } from "@/components/management/ManagementPortalShell";
import { AuthorizationError, requireUser } from "@/features/auth/authorization";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await connection();
  let principal;
  try { principal = await requireUser(); }
  catch (error) { if (error instanceof AuthorizationError) redirect("/auth/login?next=%2Fdashboard"); throw error; }
  const displayName = principal.fullName?.trim() || principal.email || "SAT12 account";
  return <ManagementPortalShell account={{ aal: principal.aal, displayName, role: principal.role }} logoutAction={logoutAction}>{children}</ManagementPortalShell>;
}
