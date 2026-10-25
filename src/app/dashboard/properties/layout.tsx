import { redirect } from "next/navigation";
import { AuthorizationError, requireRole } from "@/features/auth/authorization";

export default async function PropertiesLayout({ children }: { children: React.ReactNode }) {
  try { await requireRole(["owner_agent"]); }
  catch (error) { if (error instanceof AuthorizationError) redirect(error.code === "AUTH_REQUIRED" ? "/auth/login?next=%2Fdashboard%2Fproperties" : "/dashboard"); throw error; }
  return children;
}
