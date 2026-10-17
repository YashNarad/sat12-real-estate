import { describe, expect, it, vi } from "vitest";

import {
  PROPERTY_IMAGE_SIGNED_URL_SECONDS,
  authorizePropertyImageUpload,
  buildPropertyImagePath,
  copyRevisionImages,
  createPropertyImageSignedUrl,
  deletePropertyImage,
  uploadPropertyImage,
  validatePropertyImageFile,
  validatePropertyImageSignature,
} from "./storage";

const ownerId = "31000000-0000-4000-8000-000000000001";
const propertyId = "32000000-0000-4000-8000-000000000001";
const revisionId = "33000000-0000-4000-8000-000000000001";
const imageId = "34000000-0000-4000-8000-000000000001";

const webpSignature = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
]);
const validFile = {
  name: "living-room.webp",
  type: "image/webp",
  size: 400_000,
  arrayBuffer: async () => webpSignature.buffer,
};

describe("property image storage authorization", () => {
  it("builds an immutable revision-scoped path without using the client filename", () => {
    expect(
      buildPropertyImagePath({ ownerId, propertyId, revisionId, imageId, mimeType: "image/webp" }),
    ).toBe(`${ownerId}/${propertyId}/${revisionId}/${imageId}.webp`);
  });

  it.each([
    [{ ...validFile, name: "../home.webp" }, "SAT12_IMAGE_FILENAME_INVALID"],
    [{ ...validFile, type: "image/gif" }, "SAT12_IMAGE_TYPE_INVALID"],
    [{ ...validFile, size: 5_242_881 }, "SAT12_IMAGE_SIZE_INVALID"],
    [{ ...validFile, size: 0 }, "SAT12_IMAGE_SIZE_INVALID"],
    [{ ...validFile, name: "photo.jpg" }, "SAT12_IMAGE_EXTENSION_MISMATCH"],
  ])("rejects unsafe file input", (file, error) => {
    expect(() => validatePropertyImageFile(file)).toThrow(error);
  });

  it("rejects content whose signature does not match its declared image type", () => {
    expect(() =>
      validatePropertyImageSignature(new Uint8Array([0x47, 0x49, 0x46]), "image/webp"),
    ).toThrow("SAT12_IMAGE_CONTENT_INVALID");
    expect(() =>
      validatePropertyImageSignature(
        new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]),
        "image/webp",
      ),
    ).not.toThrow();
  });

  it("authorizes only the authoritative owner and editable revision", () => {
    expect(
      authorizePropertyImageUpload({
        userId: ownerId,
        propertyOwnerId: ownerId,
        propertyId,
        revisionId,
        revisionPropertyId: propertyId,
        revisionStatus: "draft",
        imageId,
        file: validFile,
      }),
    ).toEqual({
      path: `${ownerId}/${propertyId}/${revisionId}/${imageId}.webp`,
      mimeType: "image/webp",
      sizeBytes: 400_000,
    });
  });

  it.each([
    [{ propertyOwnerId: "31000000-0000-4000-8000-000000000002" }, "SAT12_IMAGE_OWNER_FORBIDDEN"],
    [{ revisionPropertyId: "32000000-0000-4000-8000-000000000002" }, "SAT12_IMAGE_REVISION_MISMATCH"],
    [{ revisionStatus: "submitted" }, "SAT12_IMAGE_REVISION_LOCKED"],
    [{ revisionStatus: "published" }, "SAT12_IMAGE_REVISION_LOCKED"],
  ])("rejects unauthorized upload context", (override, error) => {
    expect(() =>
      authorizePropertyImageUpload({
        userId: ownerId,
        propertyOwnerId: ownerId,
        propertyId,
        revisionId,
        revisionPropertyId: propertyId,
        revisionStatus: "draft",
        imageId,
        file: validFile,
        ...override,
      }),
    ).toThrow(error);
  });
});

describe("property image object workflows", () => {
  it("deletes metadata before the object and never removes an object when metadata deletion fails", async () => {
    const calls: string[] = [];
    const remove = vi.fn(async () => {
      calls.push("object");
      return { error: null };
    });
    const deleteMetadata = vi.fn(async () => calls.push("metadata"));

    await deletePropertyImage({
      path: `${ownerId}/${propertyId}/${revisionId}/${imageId}.webp`,
      deleteMetadata,
      storage: { remove },
    });
    expect(calls).toEqual(["metadata", "object"]);

    deleteMetadata.mockRejectedValueOnce(new Error("metadata blocked"));
    await expect(
      deletePropertyImage({
        path: `${ownerId}/${propertyId}/${revisionId}/${imageId}.webp`,
        deleteMetadata,
        storage: { remove },
      }),
    ).rejects.toThrow("metadata blocked");
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it("uses a fixed ten-minute signed URL lifetime and rejects unsafe responses", async () => {
    const createSignedUrl = vi.fn().mockResolvedValue({
      data: { signedUrl: "https://mveicefdvdgeyxalgnue.supabase.co/storage/v1/object/sign/property-images/x" },
      error: null,
    });

    await expect(
      createPropertyImageSignedUrl(
        { createSignedUrl },
        "safe/path.webp",
        "https://mveicefdvdgeyxalgnue.supabase.co",
      ),
    ).resolves.toContain("/storage/v1/object/sign/");
    expect(createSignedUrl).toHaveBeenCalledWith(
      "safe/path.webp",
      PROPERTY_IMAGE_SIGNED_URL_SECONDS,
    );

    createSignedUrl.mockResolvedValueOnce({ data: { signedUrl: "javascript:alert(1)" }, error: null });
    await expect(
      createPropertyImageSignedUrl(
        { createSignedUrl },
        "safe/path.webp",
        "https://mveicefdvdgeyxalgnue.supabase.co",
      ),
    ).rejects.toThrow("SAT12_IMAGE_SIGNING_FAILED");
  });

  it("uploads the object before metadata and cleans up an orphan on metadata failure", async () => {
    const calls: string[] = [];
    const storage = {
      upload: vi.fn(async () => {
        calls.push("upload");
        return { error: null };
      }),
      remove: vi.fn(async () => {
        calls.push("remove");
        return { error: null };
      }),
    };
    const recordMetadata = vi.fn(async () => {
      calls.push("metadata");
      throw new Error("metadata failed");
    });

    await expect(
      uploadPropertyImage({
        authorization: {
          path: `${ownerId}/${propertyId}/${revisionId}/${imageId}.webp`,
          mimeType: "image/webp",
          sizeBytes: validFile.size,
        },
        file: validFile,
        storage,
        recordMetadata,
      }),
    ).rejects.toThrow("metadata failed");
    expect(calls).toEqual(["upload", "metadata", "remove"]);
    expect(storage.upload).toHaveBeenCalledWith(expect.any(String), validFile, {
      contentType: "image/webp",
      upsert: false,
    });
  });

  it("copies each object before recording new revision metadata", async () => {
    const calls: string[] = [];
    const storage = {
      copy: vi.fn(async () => {
        calls.push("copy");
        return { error: null };
      }),
      remove: vi.fn(async () => {
        calls.push("remove");
        return { error: null };
      }),
    };
    const recordMetadata = vi.fn(async () => calls.push("metadata"));

    await copyRevisionImages({
      sourceImages: [
        {
          path: `${ownerId}/${propertyId}/33000000-0000-4000-8000-000000000009/34000000-0000-4000-8000-000000000009.webp`,
          altText: "Living room",
          position: 0,
          width: 1200,
          height: 800,
          sizeBytes: 400_000,
          mimeType: "image/webp",
        },
      ],
      destination: { ownerId, propertyId, revisionId },
      createImageId: () => imageId,
      storage,
      recordMetadata,
    });

    expect(calls).toEqual(["copy", "metadata"]);
    expect(storage.copy).toHaveBeenCalledWith(
      expect.stringContaining("33000000-0000-4000-8000-000000000009"),
      `${ownerId}/${propertyId}/${revisionId}/${imageId}.webp`,
    );
  });
});
