import { ArrowUpRight, Building2, ShieldCheck, UserCog } from "lucide-react";
import Link from "next/link";
import { requireUser } from "@/features/auth/authorization";

export default async function DashboardPage() {
  const principal = await requireUser();
  const primary = principal.role === "admin"
    ? { description: "Review submitted listings and keep publication decisions auditable.", href: "/admin/listings", icon: ShieldCheck, label: "Review properties" }
    : principal.role === "owner_agent"
      ? { description: "Create drafts, add photos, and submit listings for SAT12 review.", href: "/dashboard/properties", icon: Building2, label: "Manage properties" }
      : { description: "Review your identity, role, and account security settings.", href: "/account", icon: UserCog, label: "Account settings" };
  const Icon = primary.icon;
  return <main className="px-5 py-10 sm:px-8 lg:px-10"><div className="mx-auto max-w-6xl"><p className="text-sm font-semibold text-[var(--sat-red)]">SAT12 MANAGEMENT</p><h1 className="mt-2 max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl">Everything you can manage, in one place.</h1><p className="mt-3 max-w-2xl leading-7 text-zinc-600">Your portal reflects your verified SAT12 role. Every protected action is still authorized on the server.</p><section className="mt-10 overflow-hidden rounded-2xl border border-zinc-200 bg-white"><div className="grid md:grid-cols-[220px_1fr]"><div className="grid min-h-48 place-items-center bg-zinc-950 text-white"><Icon aria-hidden="true" size={54} strokeWidth={1.4} /></div><div className="p-7 sm:p-10"><h2 className="text-2xl font-bold">Your next workspace</h2><p className="mt-3 max-w-xl leading-7 text-zinc-600">{primary.description}</p><Link className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--sat-red)] px-5 py-3 font-semibold text-white hover:bg-[var(--sat-red-dark)]" href={primary.href}>{primary.label}<ArrowUpRight aria-hidden="true" size={18} /></Link></div></div></section></div></main>;
}
