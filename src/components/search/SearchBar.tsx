import { Search } from "lucide-react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <label className="relative block min-w-[280px] flex-1">
      <span className="sr-only">Search location</span>
      <Search aria-hidden="true" className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--sat-red)]" size={19} />
      <input aria-label="Search location" className="h-12 w-full rounded-lg border border-[var(--sat-border)] bg-white pl-12 pr-4 text-sm text-[var(--sat-charcoal)] placeholder:text-zinc-400 focus:border-[var(--sat-red)] focus:outline-none" onChange={(event) => onChange(event.target.value)} placeholder="Search city, locality, project or landmark" type="search" value={value} />
    </label>
  );
}
