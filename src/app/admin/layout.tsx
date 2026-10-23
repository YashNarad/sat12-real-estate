import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import {
  AuthorizationError,
  requireAal2Admin,
} from "@/features/auth/authorization";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await connection();
  try {
    await requireAal2Admin();
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

  return (
    <div className="min-h-screen bg-[var(--sat-canvas)]">
      <header className="border-b border-[var(--sat-border)] bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <Link className="text-2xl font-black tracking-[-0.06em]" href="/">
            SAT<span className="text-[var(--sat-red)]">12</span>
          </Link>
          <nav aria-label="Admin dashboard">
            <Link className="font-semibold text-zinc-700" href="/admin/users">
              Account approvals
            </Link>
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
