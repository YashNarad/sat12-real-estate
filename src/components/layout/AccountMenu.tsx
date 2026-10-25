"use client";

import { ChevronDown, LayoutDashboard, LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import type { HomepageAccount } from "@/features/auth/homepage-account";

export function AccountMenu({
  account,
  logoutAction,
}: {
  account: HomepageAccount | null;
  logoutAction: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstItemRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!open) return;
    firstItemRef.current?.focus();

    const closeFromOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeFromKeyboard = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener("pointerdown", closeFromOutside);
    document.addEventListener("keydown", closeFromKeyboard);
    return () => {
      document.removeEventListener("pointerdown", closeFromOutside);
      document.removeEventListener("keydown", closeFromKeyboard);
    };
  }, [open]);

  if (!account) {
    return (
      <div className="flex items-center gap-2">
        <Link
          className="rounded-lg px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 hover:text-[var(--sat-red)]"
          href="/auth/login"
        >
          Log In
        </Link>
        <Link
          className="rounded-lg bg-[var(--sat-red)] px-3 py-2 text-sm font-semibold text-white hover:bg-[var(--sat-red-dark)] sm:px-4"
          href="/auth/signup"
        >
          Sign Up
        </Link>
      </div>
    );
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        aria-controls="sat12-account-menu"
        aria-expanded={open}
        aria-label={`Account menu for ${account.displayName}`}
        className="flex min-h-11 items-center gap-2 rounded-lg px-1.5 py-1 outline-none hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-[var(--sat-red)] focus-visible:ring-offset-2 sm:gap-3 sm:px-2"
        onClick={() => setOpen((current) => !current)}
        ref={triggerRef}
        type="button"
      >
        <span
          aria-hidden="true"
          className="grid size-10 shrink-0 place-items-center rounded-full bg-red-50 text-sm font-bold text-[var(--sat-red)]"
        >
          {account.initial}
        </span>
        <span className="hidden max-w-36 truncate text-sm font-medium text-zinc-800 sm:inline">
          {account.displayName}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`hidden text-zinc-500 transition-transform sm:block ${open ? "rotate-180" : ""}`}
          size={16}
        />
      </button>

      {open ? (
        <nav
          aria-label="Account options"
          className="absolute right-0 z-[1000] mt-2 w-48 overflow-hidden rounded-xl border border-[var(--sat-border)] bg-white py-1.5 shadow-[0_16px_40px_rgba(24,24,27,0.14)]"
          id="sat12-account-menu"
        >
          <Link
            className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 hover:text-[var(--sat-red)] focus:bg-zinc-50 focus:outline-none"
            href="/account"
            onClick={() => setOpen(false)}
            ref={firstItemRef}
          >
            <UserRound aria-hidden="true" size={17} />
            My Account
          </Link>
          <Link
            className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 hover:text-[var(--sat-red)] focus:bg-zinc-50 focus:outline-none"
            href="/dashboard"
            onClick={() => setOpen(false)}
          >
            <LayoutDashboard aria-hidden="true" size={17} />
            Management Portal
          </Link>
          <form action={logoutAction}>
            <button
              className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-zinc-700 hover:bg-zinc-50 hover:text-[var(--sat-red)] focus:bg-zinc-50 focus:outline-none"
              type="submit"
            >
              <LogOut aria-hidden="true" size={17} />
              Log Out
            </button>
          </form>
        </nav>
      ) : null}
    </div>
  );
}
