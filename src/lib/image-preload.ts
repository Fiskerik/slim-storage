import type { LibraryPhoto } from "@/lib/photo-source";

export type PreloadablePhoto = Pick<LibraryPhoto, "url" | "thumb">;

export function displayPhotoUrl(photo: PreloadablePhoto): string {
  return photo.thumb || photo.url;
}

export function preloadPhotoImages(photos: PreloadablePhoto[], limit = photos.length) {
  if (typeof window === "undefined") return;

  photos.slice(0, limit).forEach((photo) => {
    const image = new Image();
    image.decoding = "async";
    image.loading = "eager";
    image.src = displayPhotoUrl(photo);
    image.decode?.().catch(() => undefined);
  });
}
