// src/lib/photo-source.ts
// Capacitor-beroenden borttagna för att stödja Expo/EAS-bygge

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

// ───────────────────────── Web / dev source ─────────────────────────

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

// ───────────────────────── Resolver ─────────────────────────

let cached: PhotoSource | null = null;

/**
 * Returnerar fotokällan. 
 * Eftersom Capacitor är borttaget används nu alltid webSource.
 */
export function getPhotoSource(): PhotoSource {
  if (cached) return cached;
  cached = webSource;
  return cached;
}

/** 
 * Kontrollerar om appen körs i en nativ app-skal.
 * Returnerar false som standard nu när Capacitor är borttaget.
 */
export function isNativeApp(): boolean {
  return false;
}