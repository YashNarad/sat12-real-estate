"use client";

import { List, Map } from "lucide-react";
import type { MobileResultsView } from "@/types/map";

interface ViewToggleProps {
  value: MobileResultsView;
  onChange: (value: MobileResultsView) => void;
}

export function ViewToggle({ value, onChange }: ViewToggleProps) {
  return (
    <div aria-label="Property results view" className="sticky top-0 z-20 grid grid-cols-2 gap-1 rounded-xl border border-zinc-200 bg-white p-1 shadow-sm lg:hidden" role="group">
      {([ ["list", List], ["map", Map] ] as const).map(([option, Icon]) => {
        const active = value === option;
        const label = option === "list" ? "List" : "Map";
        return (
          <button
            aria-pressed={active}
            className={`flex min-h-11 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sat-red)] ${active ? "bg-[var(--sat-red)] text-white" : "text-zinc-700 hover:bg-zinc-100"}`}
            key={option}
            onClick={() => onChange(option)}
            type="button"
          >
            <Icon aria-hidden size={17} />{label}
          </button>
        );
      })}
    </div>
  );
}
