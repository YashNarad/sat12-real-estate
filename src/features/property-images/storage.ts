export const PROPERTY_IMAGE_BUCKET = "property-images";
export const PROPERTY_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const PROPERTY_IMAGE_SIGNED_URL_SECONDS = 10 * 60;
export const PROPERTY_IMAGE_CACHE_SECONDS = 5 * 60;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FILE_NAME_PATTERN = /^[^/\\\0]+$/u;
const EDITABLE_REVISION_STATUSES = new Set(["draft", "rejected"]);
const MIME_EXTENSIONS = {
  "image/jpeg": new Set(["jpg", "jpeg"]),
  "image/png": new Set(["png"]),
  "image/webp": new Set(["webp"]),
} as const;

export type PropertyImageMimeType = keyof typeof MIME_EXTENSIONS;

export interface PropertyImageFile {
  readonly name: string;
  readonly type: string;
  readonly size: number;
  arrayBuffer?(): Promise<ArrayBuffer>;
}

export interface PropertyImageAuthorization {
  readonly path: string;
  readonly mimeType: PropertyImageMimeType;
  readonly sizeBytes: number;
}

export interface PropertyImageMetadata {
  readonly path: string;
  readonly altText: string;
  readonly position: number;
  readonly width: number;
  readonly height: number;
  readonly sizeBytes: number;
  readonly mimeType: PropertyImageMimeType;
}

function requireUuid(label: string, value: string) {
  if (!UUID_PATTERN.test(value)) throw new Error(`SAT12_IMAGE_${label}_INVALID`);
  return value.toLowerCase();
}

function canonicalExtension(mimeType: PropertyImageMimeType) {
  return mimeType === "image/jpeg" ? "jpg" : mimeType.slice("image/".length);
}

export function validatePropertyImageFile(file: PropertyImageFile) {
  if (!FILE_NAME_PATTERN.test(file.name) || file.name === "." || file.name === "..") {
    throw new Error("SAT12_IMAGE_FILENAME_INVALID");
  }
  if (!(file.type in MIME_EXTENSIONS)) throw new Error("SAT12_IMAGE_TYPE_INVALID");
  if (!Number.isSafeInteger(file.size) || file.size < 1 || file.size > PROPERTY_IMAGE_MAX_BYTES) {
    throw new Error("SAT12_IMAGE_SIZE_INVALID");
  }
  const extension = file.name.split(".").at(-1)?.toLowerCase();
  const mimeType = file.type as PropertyImageMimeType;
  if (!extension || !MIME_EXTENSIONS[mimeType].has(extension as never)) {
    throw new Error("SAT12_IMAGE_EXTENSION_MISMATCH");
  }
  return { mimeType, sizeBytes: file.size } as const;
}

export function validatePropertyImageSignature(
  bytes: Uint8Array,
  mimeType: PropertyImageMimeType,
) {
  const matches =
    (mimeType === "image/jpeg" &&
      bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff) ||
    (mimeType === "image/png" &&
      bytes.length >= 8 &&
      [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every(
        (value, index) => bytes[index] === value,
      )) ||
    (mimeType === "image/webp" &&
      bytes.length >= 12 &&
      [0x52, 0x49, 0x46, 0x46].every((value, index) => bytes[index] === value) &&
      [0x57, 0x45, 0x42, 0x50].every((value, index) => bytes[index + 8] === value));
  if (!matches) throw new Error("SAT12_IMAGE_CONTENT_INVALID");
}

export function buildPropertyImagePath(input: {
  ownerId: string;
  propertyId: string;
  revisionId: string;
  imageId: string;
  mimeType: PropertyImageMimeType;
}) {
  const ownerId = requireUuid("OWNER", input.ownerId);
  const propertyId = requireUuid("PROPERTY", input.propertyId);
  const revisionId = requireUuid("REVISION", input.revisionId);
  const imageId = requireUuid("ID", input.imageId);
  if (!(input.mimeType in MIME_EXTENSIONS)) throw new Error("SAT12_IMAGE_TYPE_INVALID");
  return `${ownerId}/${propertyId}/${revisionId}/${imageId}.${canonicalExtension(input.mimeType)}`;
}

export function authorizePropertyImageUpload(input: {
  userId: string;
  propertyOwnerId: string;
  propertyId: string;
  revisionId: string;
  revisionPropertyId: string;
  revisionStatus: string;
  imageId: string;
  file: PropertyImageFile;
}): PropertyImageAuthorization {
  const userId = requireUuid("OWNER", input.userId);
  if (requireUuid("OWNER", input.propertyOwnerId) !== userId) {
    throw new Error("SAT12_IMAGE_OWNER_FORBIDDEN");
  }
  const propertyId = requireUuid("PROPERTY", input.propertyId);
  if (requireUuid("PROPERTY", input.revisionPropertyId) !== propertyId) {
    throw new Error("SAT12_IMAGE_REVISION_MISMATCH");
  }
  if (!EDITABLE_REVISION_STATUSES.has(input.revisionStatus)) {
    throw new Error("SAT12_IMAGE_REVISION_LOCKED");
  }
  const { mimeType, sizeBytes } = validatePropertyImageFile(input.file);
  return {
    path: buildPropertyImagePath({
      ownerId: userId,
      propertyId,
      revisionId: input.revisionId,
      imageId: input.imageId,
      mimeType,
    }),
    mimeType,
    sizeBytes,
  };
}

interface SignedUrlClient {
  createSignedUrl(
    path: string,
    expiresIn: number,
  ): Promise<{ data: { signedUrl?: string } | null; error: unknown }>;
}

export async function createPropertyImageSignedUrl(
  client: SignedUrlClient,
  path: string,
  expectedProjectUrl: string,
) {
  const { data, error } = await client.createSignedUrl(path, PROPERTY_IMAGE_SIGNED_URL_SECONDS);
  if (error || !data?.signedUrl) throw new Error("SAT12_IMAGE_SIGNING_FAILED");
  try {
    const url = new URL(data.signedUrl);
    const projectUrl = new URL(expectedProjectUrl);
    if (
      url.protocol !== "https:" ||
      projectUrl.protocol !== "https:" ||
      url.hostname !== projectUrl.hostname ||
      !projectUrl.hostname.endsWith(".supabase.co")
    ) {
      throw new Error();
    }
  } catch {
    throw new Error("SAT12_IMAGE_SIGNING_FAILED");
  }
  return data.signedUrl;
}

interface UploadStorageClient {
  upload(
    path: string,
    file: PropertyImageFile,
    options: { contentType: string; upsert: false },
  ): Promise<{ error: unknown }>;
  remove(paths: string[]): Promise<{ error: unknown }>;
}

interface RemoveStorageClient {
  remove(paths: string[]): Promise<{ error: unknown }>;
}

export async function deletePropertyImage(input: {
  path: string;
  deleteMetadata: (path: string) => Promise<unknown>;
  storage: RemoveStorageClient;
}) {
  await input.deleteMetadata(input.path);
  const removed = await input.storage.remove([input.path]);
  if (removed.error) {
    // Metadata is already gone, so this is an unreferenced orphan that can be
    // retried safely by the retention workflow; no broken database reference remains.
    throw new Error("SAT12_IMAGE_OBJECT_DELETE_FAILED");
  }
}

export async function uploadPropertyImage(input: {
  authorization: PropertyImageAuthorization;
  file: PropertyImageFile;
  storage: UploadStorageClient;
  recordMetadata: (authorization: PropertyImageAuthorization) => Promise<unknown>;
}) {
  if (!input.file.arrayBuffer) throw new Error("SAT12_IMAGE_CONTENT_INVALID");
  validatePropertyImageSignature(
    new Uint8Array(await input.file.arrayBuffer()),
    input.authorization.mimeType,
  );
  const uploaded = await input.storage.upload(input.authorization.path, input.file, {
    contentType: input.authorization.mimeType,
    upsert: false,
  });
  if (uploaded.error) throw new Error("SAT12_IMAGE_UPLOAD_FAILED");
  try {
    return await input.recordMetadata(input.authorization);
  } catch (error) {
    await input.storage.remove([input.authorization.path]);
    throw error;
  }
}

interface CopyStorageClient {
  copy(sourcePath: string, destinationPath: string): Promise<{ error: unknown }>;
  remove(paths: string[]): Promise<{ error: unknown }>;
}

export async function copyRevisionImages(input: {
  sourceImages: readonly PropertyImageMetadata[];
  destination: { ownerId: string; propertyId: string; revisionId: string };
  createImageId: () => string;
  storage: CopyStorageClient;
  recordMetadata: (metadata: PropertyImageMetadata) => Promise<unknown>;
}) {
  if (input.sourceImages.length > 12) throw new Error("SAT12_IMAGE_COUNT_INVALID");
  const results: unknown[] = [];
  for (const source of input.sourceImages) {
    const path = buildPropertyImagePath({
      ...input.destination,
      imageId: input.createImageId(),
      mimeType: source.mimeType,
    });
    const copied = await input.storage.copy(source.path, path);
    if (copied.error) throw new Error("SAT12_IMAGE_COPY_FAILED");
    try {
      results.push(await input.recordMetadata({ ...source, path }));
    } catch (error) {
      await input.storage.remove([path]);
      throw error;
    }
  }
  return results;
}
