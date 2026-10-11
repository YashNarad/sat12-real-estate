"use client";

import { LocateFixed, Minus, Plus } from "lucide-react";

interface MapControlsProps {
  searchAsMapMoves: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  onSearchAsMapMovesChange: (enabled: boolean) => void;
}

const controlButtonClass = "grid size-11 place-items-center bg-white text-[var(--sat-charcoal)] transition-colors hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sat-red)]";

export function MapControls({ searchAsMapMoves, onZoomIn, onZoomOut, onReset, onSearchAsMapMovesChange }: MapControlsProps) {
  return (
    <>
      <label className="absolute left-4 top-4 z-[500] flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium shadow-md">
        <input
          checked={searchAsMapMoves}
          className="size-4 accent-[var(--sat-red)]"
          onChange={(event) => onSearchAsMapMovesChange(event.target.checked)}
          type="checkbox"
        />
        Search as I move the map
      </label>
      <div className="absolute right-4 top-4 z-[500] overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-md" role="group" aria-label="Map controls">
        <button aria-label="Zoom in" className={controlButtonClass} onClick={onZoomIn} type="button"><Plus aria-hidden size={20} /></button>
        <button aria-label="Zoom out" className={`${controlButtonClass} border-t border-zinc-200`} onClick={onZoomOut} type="button"><Minus aria-hidden size={20} /></button>
        <button aria-label="Reset map" className={`${controlButtonClass} border-t border-zinc-200`} onClick={onReset} type="button"><LocateFixed aria-hidden size={19} /></button>
      </div>
    </>
  );
}
