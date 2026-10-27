"use client";

import { Building2, ChevronRight, ImageIcon, Inbox, LayoutDashboard, LogOut, Menu, ShieldCheck, UserCog, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type PortalRole = "user" | "owner_agent" | "admin";
export interface PortalAccount { aal: "aal1" | "aal2"; displayName: string; role: PortalRole }
interface PortalLink { href: string; icon: typeof Building2; label: string; roles?: PortalRole[] }

const links: PortalLink[] = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Overview" },
  { href: "/dashboard/properties", icon: Building2, label: "My properties", roles: ["owner_agent"] },
  { href: "/dashboard/properties", icon: ImageIcon, label: "Property images", roles: ["owner_agent"] },
  { href: "/dashboard/enquiries", icon: Inbox, label: "Buyer enquiries", roles: ["owner_agent"] },
  { href: "/admin/listings", icon: ShieldCheck, label: "Property moderation", roles: ["admin"] },
  { href: "/admin/users", icon: Users, label: "User approvals", roles: ["admin"] },
  { href: "/account", icon: UserCog, label: "Account settings" },
  { href: "/auth/mfa?next=%2Fdashboard", icon: ShieldCheck, label: "Security / MFA" },
];

function roleLabel(role: PortalRole) {
  if (role === "owner_agent") return "Owner / Agent";
  return role === "admin" ? "Administrator" : "User";
}

function PortalNavigation({ account, mobile = false }: { account: PortalAccount; mobile?: boolean }) {
  const pathname = usePathname();
  return <nav aria-label={mobile ? "Mobile management navigation" : "Management navigation"} className="grid gap-1">{links.filter((link) => !link.roles || link.roles.includes(account.role)).map((link) => {
    const active = pathname === link.href || (link.href !== "/dashboard" && pathname.startsWith(link.href));
    const Icon = link.icon;
    return <Link aria-current={active ? "page" : undefined} className={`flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-[var(--sat-red)] ${active ? "bg-red-50 text-[var(--sat-red)]" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"}`} href={link.href} key={`${mobile ? "mobile" : "desktop"}-${link.label}`}><Icon aria-hidden="true" size={18} />{link.label}</Link>;
  })}</nav>;
}

function SignOut({ action }: { action: () => Promise<void> }) {
  return <form action={action}><button className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-zinc-200 px-3 text-sm font-semibold text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50" type="submit"><LogOut aria-hidden="true" size={17} /> Sign out</button></form>;
}

function breadcrumbLabel(pathname: string) {
  if (pathname.startsWith("/dashboard/properties/")) return "Property editor";
  if (pathname === "/dashboard/properties") return "My properties";
  if (pathname === "/dashboard/enquiries") return "Buyer enquiries";
  if (pathname === "/admin/listings") return "Property moderation";
  if (pathname === "/admin/users") return "User approvals";
  if (pathname === "/auth/mfa") return "Security / MFA";
  if (pathname === "/account") return "Account settings";
  return "Overview";
}

export function ManagementPortalShell({ account, children, logoutAction }: { account: PortalAccount; children: React.ReactNode; logoutAction: () => Promise<void> }) {
  const pathname = usePathname();
  const initial = account.displayName.slice(0, 1).toLocaleUpperCase() || "A";
  return <div className="min-h-screen bg-[var(--sat-canvas)] text-[var(--sat-charcoal)]">
    <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/95 backdrop-blur"><div className="mx-auto flex min-h-16 max-w-[1500px] items-center gap-4 px-4 sm:px-6"><Link className="text-2xl font-black tracking-[-0.06em]" href="/">SAT<span className="text-[var(--sat-red)]">12</span></Link><span className="hidden h-7 w-px bg-zinc-200 sm:block" /><p className="hidden text-sm font-semibold text-zinc-600 sm:block">Management Portal</p><div className="ml-auto flex items-center gap-3"><div aria-hidden="true" className="grid size-9 place-items-center rounded-full bg-zinc-900 text-sm font-bold text-white">{initial}</div><div className="hidden text-right sm:block"><p className="max-w-48 truncate text-sm font-semibold">{account.displayName}</p><p className="text-xs text-zinc-500">{roleLabel(account.role)} · <span className="uppercase">{account.aal}</span></p></div></div></div></header>
    <div className="mx-auto grid max-w-[1500px] lg:grid-cols-[260px_minmax(0,1fr)]"><aside className="hidden min-h-[calc(100vh-4rem)] border-r border-zinc-200 bg-white p-5 lg:flex lg:flex-col"><PortalNavigation account={account} /><div className="mt-auto border-t border-zinc-200 pt-5"><SignOut action={logoutAction} /></div></aside><div className="min-w-0"><details className="border-b border-zinc-200 bg-white px-4 py-3 lg:hidden"><summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 font-semibold"><Menu aria-hidden="true" size={19} /> Menu</summary><div className="grid gap-4 pb-2 pt-3"><PortalNavigation account={account} mobile /><SignOut action={logoutAction} /></div></details><div className="border-b border-zinc-200 bg-white px-5 py-3 sm:px-8"><nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-zinc-500"><Link className="font-medium hover:text-[var(--sat-red)]" href="/dashboard">Dashboard</Link><ChevronRight aria-hidden="true" size={15} /><span aria-current="page" className="font-semibold text-zinc-800">{breadcrumbLabel(pathname)}</span></nav></div>{children}</div></div>
  </div>;
}
