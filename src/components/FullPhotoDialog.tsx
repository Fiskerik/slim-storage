import { X } from "lucide-react";
import { displayPhotoUrl } from "@/lib/image-preload";
import type { LibraryPhoto } from "@/lib/photo-source";

export function FullPhotoDialog({
  photo,
  onClose,
}: {
  photo: LibraryPhoto | null;
  onClose: () => void;
}) {
  if (!photo) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Full photo: ${photo.title}`}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-[calc(var(--safe-area-top,env(safe-area-inset-top))+1rem)] rounded-full bg-white/12 p-2 text-white backdrop-blur transition hover:bg-white/20"
        aria-label="Close full photo"
      >
        <X className="h-5 w-5" />
      </button>
      <div
        className="flex max-h-full w-full max-w-4xl flex-col items-center gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={displayPhotoUrl(photo)}
          alt={photo.title}
          className="max-h-[82vh] w-full rounded-2xl object-contain shadow-card"
        />
        <div className="rounded-full bg-black/55 px-4 py-2 text-center text-xs font-medium text-white backdrop-blur">
          {photo.title} · {photo.month} {photo.year} · {photo.sizeMB.toFixed(1)} MB
        </div>
      </div>
    </div>
  );
}
