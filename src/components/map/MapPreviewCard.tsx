"use client";

import Image from "next/image";
import { Bath, BedDouble, MapPin, Maximize, X } from "lucide-react";
import { formatArea, formatINR } from "@/lib/formatters";
import type { Property } from "@/types/property";

interface MapPreviewCardProps {
  property: Property | null;
  onClose: () => void;
  onViewProperty: (id: string) => void;
}

export function MapPreviewCard({ property, onClose, onViewProperty }: MapPreviewCardProps) {
  if (property === null) return null;

  return (
    <section aria-label="Selected property preview" className="absolute bottom-5 left-4 right-4 z-[500] overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl sm:right-auto sm:w-[340px]" role="region">
      <div className="flex gap-3 p-2.5">
        <Image alt={property.image.alt} className="h-24 w-28 shrink-0 rounded-lg object-cover" height={144} src={property.image.src} width={168} />
        <div className="min-w-0 flex-1 py-0.5">
          <button aria-label="Close property preview" className="absolute right-2 top-2 grid size-9 place-items-center rounded-full bg-white/95 text-zinc-700 shadow-sm focus-visible:outline-2 focus-visible:outline-[var(--sat-red)]" onClick={onClose} type="button"><X aria-hidden size={17} /></button>
          <h2 className="truncate pr-8 text-sm font-semibold text-[var(--sat-charcoal)]">{property.title}</h2>
          <strong className="mt-1 block text-lg text-[var(--sat-red)]">{formatINR(property.price, property.listingIntent)}</strong>
          <p className="mt-1 flex items-center gap-1 truncate text-xs text-zinc-600"><MapPin aria-hidden size={13} />{property.locality}, Nagpur</p>
          <div className="mt-2 flex gap-3 text-xs text-zinc-600">
            {property.bedrooms > 0 && <span className="flex items-center gap-1"><BedDouble aria-hidden size={13} />{property.bedrooms}</span>}
            {property.bathrooms > 0 && <span className="flex items-center gap-1"><Bath aria-hidden size={13} />{property.bathrooms}</span>}
            <span className="flex items-center gap-1"><Maximize aria-hidden size={13} />{formatArea(property.areaSqFt)}</span>
          </div>
        </div>
      </div>
      <button className="min-h-11 w-full bg-[var(--sat-red)] px-4 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-white" onClick={() => onViewProperty(property.id)} type="button">View property in list</button>
    </section>
  );
}
