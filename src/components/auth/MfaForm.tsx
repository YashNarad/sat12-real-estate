"use client";

import { useActionState } from "react";

import type { AuthActionState } from "@/features/auth/operations";

type Action = (state: AuthActionState, formData: FormData) => Promise<AuthActionState>;
const initialState: AuthActionState = { ok: false, message: "" };
const SUPABASE_SVG_QR_PREFIX = "data:image/svg+xml;utf-8,";

function isSafeSupabaseSvgQr(qrCode: string | undefined): qrCode is string {
  if (!qrCode?.startsWith(SUPABASE_SVG_QR_PREFIX)) return false;

  const payload = qrCode.slice(SUPABASE_SVG_QR_PREFIX.length);
  let svg = payload;
  try {
    svg = decodeURIComponent(payload);
  } catch {
    // Supabase Auth currently returns the SVG markup without URI-encoding it.
  }

  const normalized = svg.trim().toLowerCase();
  return normalized.startsWith("<svg")
    && normalized.endsWith("</svg>")
    && !/<script\b/.test(normalized)
    && !/\son[a-z]+\s*=/.test(normalized)
    && !/\s(?:href|xlink:href)\s*=/.test(normalized);
}

export function TotpQrCode({ qrCode }: { qrCode?: string }) {
  if (!isSafeSupabaseSvgQr(qrCode)) return null;

  return (
    // The Auth SDK returns a local SVG data URI. next/image rejects SVG data URIs;
    // this narrowly validated native image avoids enabling SVG globally.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt="SAT12 authenticator QR code"
      className="mx-auto size-48"
      decoding="async"
      height={192}
      src={qrCode}
      width={192}
    />
  );
}

export function MfaEnrollmentForm({
  enrollAction,
  verifyAction,
  next,
  replaceFactorId,
}: {
  enrollAction: (state: AuthActionState) => Promise<AuthActionState>;
  verifyAction: Action;
  next: string;
  replaceFactorId?: string;
}) {
  const [enrollment, enroll, enrolling] = useActionState(enrollAction, initialState);
  const [verification, verify, verifying] = useActionState(verifyAction, initialState);

  if (!enrollment.data?.factorId) {
    return (
      <form action={enroll}>
        <button className="h-12 w-full rounded-lg bg-[var(--sat-red)] font-semibold text-white disabled:opacity-60" disabled={enrolling} type="submit">
          {enrolling ? "Preparing…" : replaceFactorId ? "Add replacement authenticator" : "Set up authenticator"}
        </button>
        {enrollment.message ? <p aria-live="polite" className="mt-3 text-sm text-red-700">{enrollment.message}</p> : null}
      </form>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl bg-zinc-50 p-4 text-center">
        <TotpQrCode qrCode={enrollment.data.qrCode} />
        <p className="mt-3 text-xs text-zinc-500">Manual key</p>
        <code className="mt-1 block break-all text-sm text-zinc-800">{enrollment.data.secret}</code>
      </div>
      <TotpChallengeForm action={verify} factorId={enrollment.data.factorId} next={next} pending={verifying} replaceFactorId={replaceFactorId} state={verification} />
    </div>
  );
}

export function TotpChallengeForm({
  action,
  factorId,
  next,
  pending,
  replaceFactorId,
  state,
}: {
  action: (formData: FormData) => void;
  factorId: string;
  next: string;
  pending?: boolean;
  replaceFactorId?: string;
  state?: AuthActionState;
}) {
  return (
    <form action={action} className="space-y-4">
      <input name="factorId" type="hidden" value={factorId} />
      <input name="next" type="hidden" value={next} />
      {replaceFactorId ? <input name="replaceFactorId" type="hidden" value={replaceFactorId} /> : null}
      <div>
        <label className="text-sm font-medium text-zinc-800" htmlFor="code">Six-digit code</label>
        <input autoComplete="one-time-code" className="mt-2 h-12 w-full rounded-lg border border-[var(--sat-border)] px-4 tracking-[0.35em] outline-none focus:border-[var(--sat-red)] focus:ring-2 focus:ring-red-100" id="code" inputMode="numeric" maxLength={6} name="code" pattern="[0-9]{6}" required />
        {state?.fieldErrors?.code ? <p className="mt-1 text-sm text-red-700">{state.fieldErrors.code[0]}</p> : null}
      </div>
      {state?.message && !state.ok ? <p aria-live="polite" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">{state.message}</p> : null}
      <button className="h-12 w-full rounded-lg bg-[var(--sat-red)] font-semibold text-white disabled:opacity-60" disabled={pending} type="submit">{pending ? "Verifying…" : "Verify authenticator"}</button>
    </form>
  );
}
