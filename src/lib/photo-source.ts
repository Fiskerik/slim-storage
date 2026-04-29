// Platform-aware photo source.
// On iOS (Capacitor), reads the user's real photo library via @capacitor-community/media.
// In the web/dev preview, returns the bundled SAMPLE_PHOTOS dummy library.

import { Capacitor } from "@capacitor/core";
import { SAMPLE_PHOTOS, BURST_GROUPS, MEMORY_POOL, type SamplePhoto } from "@/lib/photos";

export type LibraryPhoto = SamplePhoto & {
  /** True if this photo lives in the device's photo library (iOS), not bundled samples. */
  isNative: boolean;
  /** Native asset identifier — required to delete via PHPhotoLibrary. */
  nativeId?: string;
};

export type PhotoSource = {
  isNative: boolean;
  /** Permission gate. Returns true if access is granted (or N/A on web). */
  requestPermission: () => Promise<boolean>;
  /** Random sample of `count` photos suitable for the Swipe deck. */
  getRandom: (count: number) => Promise<LibraryPhoto[]>;
  /** Photos older than the cutoff year (memory game). */
  getOlder: (beforeYear: number, count: number) => Promise<LibraryPhoto[]>;
  /** Burst / multi-shot groups (This-or-That). */
  getBurstGroups: (maxGroups: number) => Promise<LibraryPhoto[][]>;
  /** Permanently delete a list of photos from the device library. No-op on web. */
  deletePhotos: (ids: string[]) => Promise<{ deleted: number }>;
};

// ───────────────────────── Web / dev fallback ─────────────────────────

function toLib(p: SamplePhoto): LibraryPhoto {
  return { ...p, isNative: false };
}

const webSource: PhotoSource = {
  isNative: false,
  async requestPermission() {
    return true;
  },
  async getRandom(count) {
    const shuffled = [...SAMPLE_PHOTOS].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count).map(toLib);
  },
  async getOlder(beforeYear, count) {
    const pool = MEMORY_POOL.filter((p) => p.year < beforeYear);
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count).map(toLib);
  },
  async getBurstGroups(maxGroups) {
    return BURST_GROUPS.slice(0, maxGroups).map((g) => g.map(toLib));
  },
  async deletePhotos(ids) {
    // Web preview: nothing to actually delete on the device.
    return { deleted: ids.length };
  },
};

// ───────────────────────── Native (iOS) source ─────────────────────────

type NativeAsset = {
  identifier: string;
  creationDate?: string;
  fullWidth?: number;
  fullHeight?: number;
  location?: { latitude: number; longitude: number } | null;
  data?: string; // base64 thumbnail when requested
};

async function nativeFetchAssets(limit: number): Promise<NativeAsset[]> {
  const { Media } = await import("@capacitor-community/media");
  // Returns most recent first.
  const res = await (Media as unknown as {
    getMedias: (opts: { quantity: number; thumbnailWidth?: number; thumbnailHeight?: number }) => Promise<{ medias: NativeAsset[] }>;
  }).getMedias({ quantity: limit, thumbnailWidth: 400, thumbnailHeight: 500 });
  return res.medias ?? [];
}

function assetToPhoto(a: NativeAsset, idx: number): LibraryPhoto {
  const date = a.creationDate ? new Date(a.creationDate) : new Date();
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const w = a.fullWidth ?? 1200;
  const h = a.fullHeight ?? 1600;
  // Estimate file size: ~0.25 bytes per pixel for HEIC/JPEG → MB
  const sizeMB = +(((w * h) * 0.25) / (1024 * 1024)).toFixed(1) || 1.5;
  const url = a.data ? `data:image/jpeg;base64,${a.data}` : "";
  return {
    id: a.identifier,
    nativeId: a.identifier,
    isNative: true,
    url,
    thumb: url,
    title: `${months[date.getMonth()]} ${date.getDate()}`,
    year: date.getFullYear(),
    month: months[date.getMonth()],
    device: "iPhone",
    sizeMB,
    hasGPS: !!a.location,
    burstId: undefined,
    burstOffset: idx,
  };
}

const nativeSource: PhotoSource = {
  isNative: true,
  async requestPermission() {
    try {
      const { Media } = await import("@capacitor-community/media");
      const m = Media as unknown as {
        getMedias?: (o: { quantity: number }) => Promise<unknown>;
      };
      // Triggers the iOS permission prompt on first call.
      await m.getMedias?.({ quantity: 1 });
      return true;
    } catch (e) {
      console.warn("[Slim] photo permission denied", e);
      return false;
    }
  },
  async getRandom(count) {
    const assets = await nativeFetchAssets(Math.max(count * 2, 30));
    const shuffled = assets.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count).map(assetToPhoto);
  },
  async getOlder(beforeYear, count) {
    const assets = await nativeFetchAssets(300);
    const filtered = assets.filter((a) => {
      if (!a.creationDate) return false;
      return new Date(a.creationDate).getFullYear() < beforeYear;
    });
    return filtered.sort(() => Math.random() - 0.5).slice(0, count).map(assetToPhoto);
  },
  async getBurstGroups(maxGroups) {
    // Group by creationDate within ±3 seconds → burst-like.
    const assets = await nativeFetchAssets(200);
    const sorted = assets
      .filter((a) => a.creationDate)
      .sort((a, b) => new Date(a.creationDate!).getTime() - new Date(b.creationDate!).getTime());
    const groups: NativeAsset[][] = [];
    let current: NativeAsset[] = [];
    let lastTs = 0;
    for (const a of sorted) {
      const ts = new Date(a.creationDate!).getTime();
      if (ts - lastTs < 3000 && current.length > 0) {
        current.push(a);
      } else {
        if (current.length >= 2) groups.push(current);
        current = [a];
      }
      lastTs = ts;
    }
    if (current.length >= 2) groups.push(current);
    return groups.slice(0, maxGroups).map((g) => g.map(assetToPhoto));
  },
  async deletePhotos(ids) {
    if (ids.length === 0) return { deleted: 0 };
    try {
      const { Media } = await import("@capacitor-community/media");
      const m = Media as unknown as {
        deleteMedias?: (o: { identifiers: string[] }) => Promise<unknown>;
      };
      if (typeof m.deleteMedias === "function") {
        await m.deleteMedias({ identifiers: ids });
        return { deleted: ids.length };
      }
      console.warn("[Slim] deleteMedias not available on this plugin version");
      return { deleted: 0 };
    } catch (e) {
      console.warn("[Slim] failed to delete from library", e);
      return { deleted: 0 };
    }
  },
};

// ───────────────────────── Resolver ─────────────────────────

let cached: PhotoSource | null = null;

export function getPhotoSource(): PhotoSource {
  if (cached) return cached;
  if (typeof window !== "undefined" && Capacitor.isNativePlatform()) {
    cached = nativeSource;
  } else {
    cached = webSource;
  }
  return cached;
}

/** True if the runtime is the native iOS shell. */
export function isNativeApp(): boolean {
  return typeof window !== "undefined" && Capacitor.isNativePlatform();
}
