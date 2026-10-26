import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Bath, BedDouble, Building2, CheckCircle2, MapPin, Maximize, ShieldCheck } from "lucide-react";

import { HeaderAccount, HeaderAccountFallback } from "@/components/layout/HeaderAccount";
import { PropertyImageGallery } from "@/components/listings/PropertyImageGallery";
import { PropertyLocationMap } from "@/components/properties/PropertyLocationMap";
import { getPublishedProperty } from "@/features/properties/supabase-repository";
import { formatArea, formatINR } from "@/lib/formatters";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PropertyDetailsContent({ propertyId }: { propertyId: string }) {
  if (!UUID_PATTERN.test(propertyId)) notFound();
  await connection();
  const property = await getPublishedProperty(propertyId);
  if (!property) notFound();

  const images = property.images?.length ? property.images : [property.image];
  const location = [property.locality, property.city, property.state, property.postalCode].filter(Boolean).join(", ");
  const facts = [
    { label: "Bedrooms", value: property.bedrooms || "—", icon: BedDouble },
    { label: "Bathrooms", value: property.bathrooms || "—", icon: Bath },
    { label: "Area", value: formatArea(property.areaSqFt), icon: Maximize },
    { label: "Property type", value: property.propertyType, icon: Building2 },
  ];

  return (
    <div className="min-h-screen bg-[var(--sat-canvas)]">
      <header className="border-b border-[var(--sat-border)] bg-white">
        <div className="mx-auto flex min-h-16 max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-10">
          <Link className="text-xl font-black tracking-[-0.04em] text-[var(--sat-charcoal)]" href="/">SAT<span className="text-[var(--sat-red)]">12</span></Link>
          <Suspense fallback={<HeaderAccountFallback />}><HeaderAccount /></Suspense>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        <nav aria-label="Breadcrumb" className="mb-5 text-sm text-zinc-600">
          <Link className="font-medium hover:text-[var(--sat-red)]" href="/">Properties</Link>
          <span aria-hidden="true" className="mx-2">/</span>
          <span aria-current="page">{property.title}</span>
        </nav>

        <section className="grid gap-8 lg:grid-cols-[minmax(0,1.65fr)_minmax(320px,.75fr)] lg:items-start">
          <div className="min-w-0 space-y-8">
            <div className="relative h-[320px] overflow-hidden rounded-2xl bg-zinc-200 shadow-sm sm:h-[480px] lg:h-[620px]">
              <PropertyImageGallery eager images={images} propertyTitle={property.title} sizes="(min-width: 1024px) 68vw, 100vw" />
              {property.badge && <span className="absolute left-4 top-4 rounded-full bg-[var(--sat-red)] px-4 py-2 text-xs font-bold uppercase tracking-wide text-white">{property.badge}</span>}
            </div>

            <section aria-labelledby="description-heading" className="rounded-2xl border border-[var(--sat-border)] bg-white p-6 sm:p-8">
              <h2 className="text-xl font-bold" id="description-heading">About this property</h2>
              <p className="mt-4 whitespace-pre-line leading-7 text-zinc-600">{property.description ?? "This published listing does not include a description."}</p>
            </section>

            <section aria-labelledby="location-heading" className="space-y-4">
              <div>
                <h2 className="text-xl font-bold" id="location-heading">Location</h2>
                <p className="mt-1 flex items-center gap-2 text-sm text-zinc-600"><MapPin aria-hidden="true" size={16} />{location}</p>
              </div>
              <PropertyLocationMap property={property} />
            </section>
          </div>

          <aside className="space-y-5 lg:sticky lg:top-6">
            <section className="rounded-2xl border border-[var(--sat-border)] bg-white p-6 shadow-sm sm:p-8">
              <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--sat-red)]">For {property.listingIntent}</p>
              <h1 className="mt-3 text-3xl font-bold leading-tight tracking-[-0.04em] text-[var(--sat-charcoal)]">{property.title}</h1>
              <p className="mt-3 flex items-start gap-2 text-sm leading-6 text-zinc-600"><MapPin aria-hidden="true" className="mt-1 shrink-0" size={16} />{location}</p>
              <p className="mt-6 text-3xl font-black tracking-[-0.04em] text-[var(--sat-red)]">{formatINR(property.price, property.listingIntent)}</p>

              <dl className="mt-7 grid grid-cols-2 gap-3">
                {facts.map(({ label, value, icon: Icon }) => <div className="rounded-xl bg-zinc-50 p-4" key={label}><Icon aria-hidden="true" className="text-[var(--sat-red)]" size={18} /><dt className="mt-3 text-xs text-zinc-500">{label}</dt><dd className="mt-1 text-sm font-bold text-zinc-900">{value}</dd></div>)}
              </dl>

              <div className="mt-6 space-y-3 border-t border-zinc-100 pt-5 text-sm">
                <p className="flex items-center gap-2"><CheckCircle2 aria-hidden="true" className="text-emerald-600" size={18} /><span>{property.status}</span></p>
                <p className="flex items-center gap-2"><ShieldCheck aria-hidden="true" className="text-emerald-600" size={18} /><span>{property.reraApproved ? "RERA approved" : "RERA approval not stated"}</span></p>
                {property.reraNumber && <p className="pl-7 text-xs text-zinc-500">RERA number: <span className="font-semibold text-zinc-700">{property.reraNumber}</span></p>}
              </div>
            </section>

            <section className="rounded-2xl bg-[var(--sat-charcoal)] p-6 text-white sm:p-8">
              <h2 className="text-xl font-bold">Interested in this property?</h2>
              <p className="mt-3 text-sm leading-6 text-zinc-300">Secure enquiries are coming soon. We will never display an owner’s private contact information on a public listing.</p>
              <Link className="mt-5 inline-flex min-h-11 items-center rounded-lg bg-white px-5 text-sm font-bold text-[var(--sat-charcoal)] focus-visible:ring-2 focus-visible:ring-white" href="/auth/login">Sign in to SAT12</Link>
            </section>
          </aside>
        </section>
      </main>
    </div>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ propertyId: string }> }): Promise<Metadata> {
  const { propertyId } = await params;
  if (!UUID_PATTERN.test(propertyId)) return { title: "Property not found | SAT12" };
  const property = await getPublishedProperty(propertyId);
  if (!property) return { title: "Property not found | SAT12" };
  const description = property.description ?? `${property.propertyType} for ${property.listingIntent.toLowerCase()} in ${property.locality}, ${property.city}.`;
  return {
    title: `${property.title} | SAT12`,
    description,
    alternates: { canonical: `/properties/${property.id}` },
    openGraph: { title: property.title, description, type: "website", url: `/properties/${property.id}` },
  };
}

async function ResolvedPropertyPage({ params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params;
  return <PropertyDetailsContent propertyId={propertyId} />;
}

export default function PropertyDetailsPage({ params }: { params: Promise<{ propertyId: string }> }) {
  return <Suspense fallback={<PropertyDetailsLoading />}><ResolvedPropertyPage params={params} /></Suspense>;
}

function PropertyDetailsLoading() {
  return <div aria-label="Loading property details" className="min-h-screen animate-pulse bg-zinc-100" role="status" />;
}
