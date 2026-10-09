import { ChevronDown } from "lucide-react";
import type { SelectHTMLAttributes } from "react";

interface FilterButtonProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
}

export function FilterButton({ label, children, className = "", ...props }: FilterButtonProps) {
  return (
    <label className={`relative block shrink-0 ${className}`}>
      <span className="sr-only">{label}</span>
      <select aria-label={label} className="h-12 min-w-28 appearance-none rounded-lg border border-[var(--sat-border)] bg-white pl-4 pr-10 text-sm font-medium text-zinc-800 focus:border-[var(--sat-red)] focus:outline-none" {...props}>{children}</select>
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
    </label>
  );
}
