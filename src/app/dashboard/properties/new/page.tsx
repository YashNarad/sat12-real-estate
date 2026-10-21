import Link from "next/link";
import { createDraft } from "@/app/actions/properties";
import { PropertyEditor } from "@/components/dashboard/PropertyEditor";

export default function NewPropertyPage() { return <main className="mx-auto max-w-4xl px-5 py-10"><Link className="text-sm font-semibold text-[var(--sat-red)]" href="/dashboard/properties">← My properties</Link><section className="mt-5 rounded-2xl border border-[var(--sat-border)] bg-white p-6 sm:p-8"><h1 className="text-2xl font-bold">Create a property draft</h1><p className="mt-2 mb-8 text-sm text-zinc-600">Your listing stays private until SAT12 reviews and publishes it.</p><PropertyEditor action={createDraft} /></section></main>; }
