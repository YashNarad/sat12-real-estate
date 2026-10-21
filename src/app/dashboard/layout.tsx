import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthorizationError, requireRole } from "@/features/auth/authorization";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  try { await requireRole(["owner_agent", "admin"]); }
  catch (error) { if (error instanceof AuthorizationError) redirect(error.code === "AUTH_REQUIRED" ? "/auth/login?next=%2Fdashboard%2Fproperties" : "/account"); throw error; }
  return <div className="min-h-screen bg-[var(--sat-canvas)]"><header className="border-b border-[var(--sat-border)] bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4"><Link className="text-2xl font-black tracking-[-0.06em]" href="/">SAT<span className="text-[var(--sat-red)]">12</span></Link><nav aria-label="Owner dashboard"><Link className="font-semibold text-zinc-700" href="/dashboard/properties">My properties</Link></nav></div></header>{children}</div>;
}
