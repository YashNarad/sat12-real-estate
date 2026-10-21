"use client";

import { useActionState, useState } from "react";
import { recordPropertyImage } from "@/app/actions/properties";
import type { ActionState } from "@/types/managed-property";
import { SubmissionStatus } from "./SubmissionStatus";

const initialState: ActionState = { ok: false, code: "VALIDATION", message: "" };

export function PropertyImageManager({ propertyId, revisionId, editable, nextPosition = 0 }: { propertyId: string; revisionId: string; editable: boolean; nextPosition?: number }) {
  const action = recordPropertyImage.bind(null, revisionId, propertyId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  if (!editable) return <p className="text-sm text-zinc-600">Images are locked while this revision is under review or published.</p>;
  if (nextPosition >= 12) return <p className="text-sm text-zinc-600">This revision already has the maximum of 12 images.</p>;
  return <form action={formAction} className="grid gap-4 rounded-xl border border-[var(--sat-border)] bg-zinc-50 p-5">
    <h2 className="text-lg font-bold">Add property image</h2>
    <label className="text-sm font-semibold">Property image<input accept="image/jpeg,image/png,image/webp" className="mt-2 block w-full font-normal" name="image" onChange={(event) => {
      const file = event.target.files?.[0]; if (!file) return;
      const image = new Image(); image.onload = () => { setDimensions({ width: image.naturalWidth, height: image.naturalHeight }); URL.revokeObjectURL(image.src); }; image.src = URL.createObjectURL(file);
    }} required type="file" /></label>
    <input name="width" type="hidden" value={dimensions.width} /><input name="height" type="hidden" value={dimensions.height} /><input name="position" type="hidden" value={nextPosition} />
    <label className="text-sm font-semibold">Image description<input className="mt-2 h-11 w-full rounded-lg border border-[var(--sat-border)] bg-white px-3" name="altText" required /></label>
    <SubmissionStatus message={state.message} ok={state.ok} />
    <button className="h-11 rounded-lg border border-[var(--sat-red)] px-5 font-semibold text-[var(--sat-red)] disabled:opacity-60 sm:w-fit" disabled={pending || dimensions.width < 1 || dimensions.height < 1} type="submit">{pending ? "Uploading…" : "Upload image"}</button>
  </form>;
}
