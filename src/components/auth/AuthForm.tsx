"use client";

import Link from "next/link";
import { useActionState } from "react";

import type { AuthActionState } from "@/features/auth/operations";

type AuthMode = "login" | "signup" | "recover" | "reset";
type AuthAction = (state: AuthActionState, formData: FormData) => Promise<AuthActionState>;

const content: Record<AuthMode, { title: string; intro: string; submit: string }> = {
  login: {
    title: "Welcome back",
    intro: "Sign in to manage your SAT12 account and enquiries.",
    submit: "Sign in",
  },
  signup: {
    title: "Create your SAT12 account",
    intro: "Use a verified email address. Property-owner access requires admin approval.",
    submit: "Create account",
  },
  recover: {
    title: "Reset your password",
    intro: "We will email a secure reset link if an account exists.",
    submit: "Send reset link",
  },
  reset: {
    title: "Choose a new password",
    intro: "Use at least 10 characters with uppercase, lowercase, a number and a symbol.",
    submit: "Update password",
  },
};

const initialState: AuthActionState = { ok: false, message: "" };

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return <p className="mt-1 text-sm text-red-700">{errors[0]}</p>;
}

export function AuthForm({
  action,
  mode,
  next,
}: {
  action: AuthAction;
  mode: AuthMode;
  next?: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const copy = content[mode];
  const asksEmail = mode !== "reset";
  const asksPassword = mode === "login" || mode === "signup" || mode === "reset";

  return (
    <main className="grid min-h-[calc(100vh-76px)] place-items-center bg-[var(--sat-page)] px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-[var(--sat-border)] bg-white p-6 shadow-[0_18px_60px_rgba(24,24,27,0.08)] sm:p-8">
        <Link
          aria-label="SAT12 home"
          className="inline-block text-3xl font-black tracking-[-0.07em] text-[var(--sat-charcoal)]"
          href="/"
        >
          SAT<span className="text-[var(--sat-red)]">12</span>
        </Link>
        <h1 className="mt-7 text-2xl font-bold tracking-tight text-[var(--sat-charcoal)]">{copy.title}</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-600">{copy.intro}</p>

        <form action={formAction} className="mt-7 space-y-5" noValidate>
          {next ? <input name="next" type="hidden" value={next} /> : null}
          {mode === "signup" ? (
            <div>
              <label className="text-sm font-medium text-zinc-800" htmlFor="fullName">Full name</label>
              <input
                autoComplete="name"
                className="mt-2 h-12 w-full rounded-lg border border-[var(--sat-border)] px-4 outline-none transition focus:border-[var(--sat-red)] focus:ring-2 focus:ring-red-100"
                id="fullName"
                name="fullName"
                type="text"
              />
              <FieldError errors={state.fieldErrors?.fullName} />
            </div>
          ) : null}
          {asksEmail ? (
            <div>
              <label className="text-sm font-medium text-zinc-800" htmlFor="email">Email address</label>
              <input
                autoComplete="email"
                className="mt-2 h-12 w-full rounded-lg border border-[var(--sat-border)] px-4 outline-none transition focus:border-[var(--sat-red)] focus:ring-2 focus:ring-red-100"
                id="email"
                inputMode="email"
                name="email"
                type="email"
              />
              <FieldError errors={state.fieldErrors?.email} />
            </div>
          ) : null}
          {asksPassword ? (
            <div>
              <div className="flex items-center justify-between gap-4">
                <label className="text-sm font-medium text-zinc-800" htmlFor="password">
                  {mode === "reset" ? "New password" : "Password"}
                </label>
                {mode === "login" ? (
                  <Link className="text-sm font-medium text-[var(--sat-red)] hover:underline" href="/auth/recover">
                    Forgot password?
                  </Link>
                ) : null}
              </div>
              <input
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                className="mt-2 h-12 w-full rounded-lg border border-[var(--sat-border)] px-4 outline-none transition focus:border-[var(--sat-red)] focus:ring-2 focus:ring-red-100"
                id="password"
                name="password"
                type="password"
              />
              <FieldError errors={state.fieldErrors?.password} />
            </div>
          ) : null}

          {state.message ? (
            <p aria-live="polite" className={`rounded-lg px-4 py-3 text-sm ${state.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`} role="status">
              {state.message}
            </p>
          ) : null}

          <button
            className="h-12 w-full rounded-lg bg-[var(--sat-red)] px-5 font-semibold text-white transition hover:bg-[var(--sat-red-dark)] disabled:cursor-wait disabled:opacity-65"
            disabled={pending}
            type="submit"
          >
            {pending ? "Please wait…" : copy.submit}
          </button>
        </form>

        {mode === "login" ? (
          <p className="mt-6 text-center text-sm text-zinc-600">New to SAT12? <Link className="font-semibold text-[var(--sat-red)] hover:underline" href="/auth/signup">Create an account</Link></p>
        ) : null}
        {mode === "signup" || mode === "recover" ? (
          <p className="mt-6 text-center text-sm text-zinc-600"><Link className="font-semibold text-[var(--sat-red)] hover:underline" href="/auth/login">Return to sign in</Link></p>
        ) : null}
      </section>
    </main>
  );
}
