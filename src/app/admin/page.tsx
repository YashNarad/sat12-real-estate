import { ArrowUpRight, ShieldCheck, UserCog, Users } from "lucide-react";
import Link from "next/link";

import { requireAal2Admin } from "@/features/auth/authorization";

const destinations = [
  { href: "/admin/listings", icon: ShieldCheck, label: "Submitted properties", description: "Review submitted revisions and make audited lifecycle decisions." },
  { href: "/admin/users", icon: Users, label: "User approvals", description: "Approve eligible owner and agent accounts through the audited role workflow." },
  { href: "/account", icon: UserCog, label: "Account settings", description: "Review your authoritative profile and current security level." },
  { href: "/auth/mfa?next=%2Fadmin", icon: ShieldCheck, label: "Security / MFA", description: "Maintain the recent AAL2 session required by Admin tools." },
] as const;

export default async function AdminPage() {
  await requireAal2Admin();
  return <main className="px-5 py-10 sm:px-8 lg:px-10"><div className="mx-auto max-w-6xl"><p className="text-sm font-semibold text-[var(--sat-red)]">SAT12 ADMIN</p><h1 className="mt-2 text-3xl font-bold">Administration overview</h1><p className="mt-3 max-w-2xl leading-7 text-zinc-600">Review listings and account approvals through AAL2-protected, audited workflows.</p><section aria-label="Admin destinations" className="mt-8 grid gap-4 md:grid-cols-2">{destinations.map(({ href, icon: Icon, label, description }) => <article className="rounded-2xl border border-zinc-200 bg-white p-6" key={href}><Icon aria-hidden="true" className="text-[var(--sat-red)]" size={26} /><h2 className="mt-4 text-xl font-bold">{label}</h2><p className="mt-2 text-sm leading-6 text-zinc-600">{description}</p><Link className="mt-5 inline-flex min-h-11 items-center gap-2 font-semibold text-[var(--sat-red)]" href={href}>{label}<ArrowUpRight aria-hidden="true" size={17} /></Link></article>)}</section></div></main>;
}
