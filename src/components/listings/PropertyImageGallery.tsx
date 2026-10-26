"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import { PROPERTY_IMAGE_PLACEHOLDER } from "@/features/properties/mapper";
import type { PropertyImage } from "@/types/property";

interface PropertyImageGalleryProps {
  eager?: boolean;
  fallbackSrc?: string;
  images: readonly PropertyImage[];
  propertyTitle: string;
  sizes: string;
}

export function PropertyImageGallery({ eager = false, fallbackSrc = PROPERTY_IMAGE_PLACEHOLDER, images, propertyTitle, sizes }: PropertyImageGalleryProps) {
  const [index, setIndex] = useState(0);
  const [failedIndexes, setFailedIndexes] = useState<ReadonlySet<number>>(() => new Set());
  const safeImages = images.length > 0 ? images : [{ src: fallbackSrc, alt: `Image unavailable for ${propertyTitle}`, kind: "listing" as const }];
  const safeIndex = Math.min(index, safeImages.length - 1);
  const current = failedIndexes.has(safeIndex)
    ? { src: fallbackSrc, alt: `Image unavailable for ${propertyTitle}`, kind: "listing" as const }
    : safeImages[safeIndex];

  const move = (direction: -1 | 1) => {
    setIndex((currentIndex) => (currentIndex + direction + safeImages.length) % safeImages.length);
  };

  return (
    <span
      aria-label={`Property images for ${propertyTitle}`}
      className="relative block h-full overflow-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--sat-red)]"
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") { event.preventDefault(); move(-1); }
        if (event.key === "ArrowRight") { event.preventDefault(); move(1); }
      }}
      role="group"
      tabIndex={safeImages.length > 1 ? 0 : undefined}
    >
      <Image
        alt={current.alt}
        className="object-cover"
        fill
        loading={eager ? "eager" : "lazy"}
        onError={() => setFailedIndexes((currentFailures) => new Set(currentFailures).add(safeIndex))}
        sizes={sizes}
        src={current.src}
      />
      {safeImages.length > 1 && (
        <>
          <span aria-live="polite" className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-2.5 py-1 text-xs font-semibold text-white">{safeIndex + 1} / {safeImages.length}</span>
          <button aria-label={`Previous image for ${propertyTitle}`} className="absolute left-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-zinc-900 shadow focus-visible:ring-2 focus-visible:ring-[var(--sat-red)]" onClick={(event) => { event.stopPropagation(); move(-1); }} type="button"><ChevronLeft aria-hidden="true" size={20} /></button>
          <button aria-label={`Next image for ${propertyTitle}`} className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-zinc-900 shadow focus-visible:ring-2 focus-visible:ring-[var(--sat-red)]" onClick={(event) => { event.stopPropagation(); move(1); }} type="button"><ChevronRight aria-hidden="true" size={20} /></button>
        </>
      )}
    </span>
  );
}
