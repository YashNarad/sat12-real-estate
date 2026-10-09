import { Bell, ChevronDown, Heart } from "lucide-react";

const navItems = ["Buy", "Rent", "New Projects", "Builders", "Locations", "Insights"];

export function Header() {
  return (
    <header className="border-b border-[var(--sat-border)] bg-white">
      <div className="mx-auto flex h-[76px] max-w-[1536px] items-center gap-8 px-5 sm:px-8 lg:px-14">
        <a aria-label="SAT12 home" className="shrink-0 text-[32px] font-black leading-none tracking-[-0.07em] text-[var(--sat-charcoal)]" href="#">
          SAT<span className="text-[var(--sat-red)]">12</span>
        </a>
        <nav aria-label="Primary" className="hidden h-full items-center gap-7 lg:flex">
          {navItems.map((item, index) => (
            <a className={`flex h-full items-center border-b-2 px-1 text-sm font-medium ${index === 0 ? "border-[var(--sat-red)] text-[var(--sat-charcoal)]" : "border-transparent text-zinc-600 hover:text-[var(--sat-charcoal)]"}`} href={`#${item.toLowerCase().replaceAll(" ", "-")}`} key={item}>
              {item}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2 sm:gap-4">
          <a className="hidden items-center gap-2 text-sm text-zinc-700 hover:text-[var(--sat-red)] xl:flex" href="#saved"><Heart size={18} strokeWidth={1.8} />Saved</a>
          <button aria-label="Alerts — coming soon" className="hidden items-center gap-2 text-sm text-zinc-700 disabled:cursor-not-allowed disabled:opacity-55 xl:flex" disabled type="button"><Bell size={18} strokeWidth={1.8} />Alerts</button>
          <button className="hidden h-11 rounded-lg bg-[var(--sat-red)] px-6 text-sm font-semibold text-white hover:bg-[var(--sat-red-dark)] md:block" type="button">List Property</button>
          <span aria-hidden="true" className="grid size-10 place-items-center rounded-full bg-red-50 text-sm font-bold text-[var(--sat-red)]">S</span>
          <span className="hidden text-sm font-medium text-zinc-800 sm:inline">Sunil Verma</span>
          <ChevronDown className="hidden text-zinc-500 sm:block" size={16} />
        </div>
      </div>
    </header>
  );
}
