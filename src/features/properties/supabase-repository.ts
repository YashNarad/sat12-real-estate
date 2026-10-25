import "server-only";

import { createServerClient } from "@/lib/supabase/server";
import { getPublicSupabaseEnvironment } from "@/lib/supabase/config";
import {
  PROPERTY_IMAGE_BUCKET,
  PROPERTY_IMAGE_CACHE_SECONDS,
  PROPERTY_IMAGE_SIGNED_URL_SECONDS,
  createPropertyImageSignedUrl,
} from "@/features/property-images/storage";
import type { PropertyRepository } from "./repository";
import { mapPublishedProperty, type PublishedPropertyImageRow, type PublishedPropertyRow } from "./mapper";

export const PUBLIC_PROPERTY_SELECT = `
  id, created_at, archived_at, published_revision_id,
  published_revision:property_revisions!properties_published_revision_fk(
    id, property_id, title, listing_intent, property_type, price_inr,
    locality, city, latitude, longitude, bedrooms, bathrooms, area_sq_ft,
    construction_status, rera_approved, badge, status, published_at
  )
`.replace(/\s+/g, " ").trim();
export const PUBLIC_PROPERTY_IMAGE_SELECT = "id, storage_path, alt_text, position, source_kind";

interface PublicPropertyClient {
  from(table: string): unknown;
  storage: {
    from(bucket: string): {
      createSignedUrl(path: string, expiresIn: number): Promise<{ data: { signedUrl?: string } | null; error: unknown }>;
    };
  };
}

interface PropertyQuery {
  select(columns: string): {
    is(column: string, value: null): {
      not(column: string, operator: "is", value: null): {
        order(column: string, options: { ascending: false }): Promise<{ data: unknown; error: unknown }>;
      };
    };
  };
}

interface PropertyImageQuery {
  select(columns: string): {
    eq(column: "revision_id", value: string): {
      order(column: "position", options: { ascending: true }): Promise<{ data: unknown; error: unknown }>;
    };
  };
}

function isPublicRow(row: PublishedPropertyRow) {
  return row.archived_at === null && row.published_revision !== null &&
    row.published_revision_id === row.published_revision.id &&
    row.id === row.published_revision.property_id && row.published_revision.status === "published";
}

export function createSupabasePropertyRepository(
  client: PublicPropertyClient,
  projectUrl = getPublicSupabaseEnvironment().url,
): PropertyRepository {
  const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

  return {
    async listPublished() {
      const propertiesQuery = client.from("properties") as PropertyQuery;
      const { data, error } = await propertiesQuery.select(PUBLIC_PROPERTY_SELECT)
        .is("archived_at", null).not("published_revision_id", "is", null)
        .order("created_at", { ascending: false });
      if (error || !Array.isArray(data)) throw new Error("SAT12_PROPERTIES_LOAD_FAILED");

      const rows = (data as PublishedPropertyRow[]).filter(isPublicRow)
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
      const properties = await Promise.all(rows.map(async (row) => {
        const revision = row.published_revision!;
        const imagesQuery = client.from("property_images") as PropertyImageQuery;
        const imageResult = await imagesQuery.select(PUBLIC_PROPERTY_IMAGE_SELECT)
          .eq("revision_id", revision.id).order("position", { ascending: true });
        const images = !imageResult.error && Array.isArray(imageResult.data)
          ? imageResult.data as PublishedPropertyImageRow[]
          : [];
        const signedUrls = await Promise.all(images.map(async (metadata) => {
          const cached = signedUrlCache.get(metadata.storage_path);
          if (cached && cached.expiresAt > Date.now()) return cached.url;
          try {
            const url = await createPropertyImageSignedUrl(
              client.storage.from(PROPERTY_IMAGE_BUCKET), metadata.storage_path, projectUrl,
            );
            signedUrlCache.set(metadata.storage_path, { url, expiresAt: Date.now() + PROPERTY_IMAGE_CACHE_SECONDS * 1000 });
            return url;
          } catch {
            return undefined;
          }
        }));
        return mapPublishedProperty({
          ...row,
          published_revision: { ...revision, property_images: images },
        }, signedUrls);
      }));
      return Object.freeze(properties);
    },
  };
}

export async function getPublishedProperties() {
  const client = await createServerClient();
  return createSupabasePropertyRepository(client as unknown as PublicPropertyClient).listPublished();
}

export const PUBLIC_IMAGE_SIGNED_URL_SECONDS = PROPERTY_IMAGE_SIGNED_URL_SECONDS;
