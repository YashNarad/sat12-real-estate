import Link from "next/link";
import type { ReactNode } from "react";

import type { ListingIntent } from "@/types/property";

interface HeaderProps {
  accountControl: ReactNode;
  currentIntent: ListingIntent;
  onIntentChange: (intent: ListingIntent) => void;
}

export function Header({ accountControl, currentIntent, onIntentChange }: HeaderProps) {
  return (
    <header className="border-b border-[var(--sat-border)] bg-white">
      <div className="mx-auto flex h-[76px] max-w-[1536px] items-center gap-8 px-5 sm:px-8 lg:px-14">
        <Link aria-label="SAT12 home" className="shrink-0 text-[32px] font-black leading-none tracking-[-0.07em] text-[var(--sat-charcoal)]" href="/">
          SAT<span className="text-[var(--sat-red)]">12</span>
        </Link>
        <nav aria-label="Primary" className="hidden h-full items-center gap-7 lg:flex">
          {(["Buy", "Rent"] as const).map((intent) => (
            <button aria-pressed={currentIntent === intent} className={`flex h-full items-center border-b-2 px-1 text-sm font-medium ${currentIntent === intent ? "border-[var(--sat-red)] text-[var(--sat-charcoal)]" : "border-transparent text-zinc-600 hover:text-[var(--sat-charcoal)]"}`} key={intent} onClick={() => onIntentChange(intent)} type="button">{intent}</button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2 sm:gap-4">
          <Link className="hidden h-11 items-center rounded-lg bg-[var(--sat-red)] px-6 text-sm font-semibold text-white hover:bg-[var(--sat-red-dark)] md:flex" href="/dashboard/properties/new">List Property</Link>
          {accountControl}
        </div>
      </div>
    </header>
  );
}
