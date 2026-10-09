import { Bath, BedDouble, Heart, MapPin, Maximize } from "lucide-react";
import Image from "next/image";
import { formatArea, formatINR } from "@/lib/formatters";
import type { Property } from "@/types/property";

interface PropertyCardProps {
  property: Property;
  selected: boolean;
  favorite: boolean;
  view: "grid" | "list";
  onSelect: (id: string) => void;
  onToggleFavorite: (id: string) => void;
}

export function PropertyCard({ property, selected, favorite, view, onSelect, onToggleFavorite }: PropertyCardProps) {
  return (
    <article className={`relative overflow-hidden rounded-[10px] border bg-white transition-colors ${selected ? "border-[var(--sat-red)] ring-1 ring-[var(--sat-red)]" : "border-[var(--sat-border)] hover:border-zinc-300"} ${view === "list" ? "min-h-44" : ""}`} data-testid="property-card">
      <button aria-label={`View ${property.title} in ${property.locality}`} className={`block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--sat-red)] ${view === "list" ? "sm:grid sm:grid-cols-[240px_1fr]" : ""}`} onClick={() => onSelect(property.id)} type="button">
        <span className={`relative block overflow-hidden ${view === "list" ? "h-48 sm:h-full" : "aspect-[1.72/1]"}`}>
          <Image alt={property.image.alt} className="object-cover" fill sizes={view === "list" ? "240px" : "(min-width: 1280px) 22vw, (min-width: 768px) 40vw, 100vw"} src={property.image.src} />
          {property.badge && <span className={`absolute left-3 top-3 rounded-md px-3 py-1 text-xs font-semibold ${property.badge === "Featured" ? "bg-[var(--sat-red)] text-white" : "bg-red-50 text-[var(--sat-red)]"}`}>{property.badge}</span>}
        </span>
        <span className="block p-4">
          <span className="block text-[15px] font-semibold text-zinc-900">{property.title}</span>
          <strong className="mt-1 block text-xl font-bold text-[var(--sat-red)]">{formatINR(property.price, property.listingIntent)}</strong>
          <span className="mt-2 flex items-center gap-1.5 text-xs text-zinc-600"><MapPin size={14} />{property.locality}, {property.city}</span>
          <span className="mt-4 flex items-center gap-5 border-b border-zinc-100 pb-4 text-xs text-zinc-600">
            {property.bedrooms > 0 && <span className="flex items-center gap-1.5"><BedDouble size={16} />{property.bedrooms}</span>}
            {property.bathrooms > 0 && <span className="flex items-center gap-1.5"><Bath size={16} />{property.bathrooms}</span>}
            <span className="flex items-center gap-1.5"><Maximize size={15} />{formatArea(property.areaSqFt)}</span>
          </span>
          <span className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500"><span>{property.status}</span>{property.reraApproved && <><span aria-hidden="true" className="h-3 w-px bg-zinc-300" /><span>RERA Approved</span></>}</span>
        </span>
      </button>
      <button aria-label={`${favorite ? "Remove" : "Save"} ${property.title}`} aria-pressed={favorite} className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-white/95 text-zinc-700 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sat-red)]" onClick={() => onToggleFavorite(property.id)} type="button"><Heart fill={favorite ? "#DC0011" : "none"} size={20} stroke={favorite ? "#DC0011" : "currentColor"} /></button>
    </article>
  );
}
