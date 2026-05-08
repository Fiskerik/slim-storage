import { displayPhotoUrl } from "@/lib/image-preload";
import type { LibraryPhoto } from "@/lib/photo-source";

export type JpegConversionResult = {
  converted: number;
  skipped: number;
  failed: number;
};

declare global {
  interface Window {
    __slimBridgeCall?: (method: string, data?: Record<string, unknown>) => Promise<unknown>;
  }
}

function isHeicFilename(name: string): boolean {
  return /\.(heic|heif)(?:$|[?#])/i.test(name.trim());
}

export function isHeicPhoto(photo: LibraryPhoto): boolean {
  return isHeicFilename(photo.title) || isHeicFilename(photo.url) || isHeicFilename(photo.thumb);
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load image for JPEG conversion: ${url}`));
    image.decoding = "async";
    image.src = url;
  });
}

async function photoToJpegDataUrl(photo: LibraryPhoto): Promise<string> {
  const image = await loadImage(displayPhotoUrl(photo));
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable for JPEG conversion");

  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.84);
}

function jpegFilenameForPhoto(photo: LibraryPhoto): string {
  const base = photo.title.replace(/\.[^.]+$/, "").trim() || "TrimSwipe photo";
  return `${base}.jpg`;
}

export async function convertHeicPhotosToJpeg(
  photos: LibraryPhoto[],
): Promise<JpegConversionResult> {
  const candidates = photos.filter(
    (photo, index, all) =>
      photo.isNative &&
      !!photo.nativeId &&
      isHeicPhoto(photo) &&
      all.findIndex((item) => item.nativeId === photo.nativeId) === index,
  );

  if (candidates.length === 0) return { converted: 0, skipped: 0, failed: 0 };

  if (typeof window === "undefined" || typeof window.__slimBridgeCall !== "function") {
    console.log("[photo-conversion] native bridge unavailable; skipping HEIC conversion", {
      candidates: candidates.length,
    });
    return { converted: 0, skipped: candidates.length, failed: 0 };
  }

  let converted = 0;
  let failed = 0;

  for (const photo of candidates) {
    try {
      console.log("[photo-conversion] converting HEIC to JPEG", {
        nativeId: photo.nativeId,
        title: photo.title,
      });
      const jpegDataUri = await photoToJpegDataUrl(photo);
      const result = (await window.__slimBridgeCall("replaceAssetWithJpeg", {
        assetId: photo.nativeId,
        filename: jpegFilenameForPhoto(photo),
        jpegDataUri,
      })) as { converted?: boolean } | null;

      if (result?.converted) converted += 1;
      else failed += 1;
    } catch (error) {
      failed += 1;
      console.log("[photo-conversion] HEIC conversion failed", {
        nativeId: photo.nativeId,
        title: photo.title,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { converted, skipped: candidates.length - converted - failed, failed };
}
