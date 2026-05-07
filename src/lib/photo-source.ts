// src/lib/photo-source.ts
// Bridges to native iOS photo library when running inside the Expo WebView,
// falls back to sample photos for web preview.

import { SAMPLE_PHOTOS, BURST_GROUPS, MEMORY_POOL, type SamplePhoto } from "@/lib/photos";

export type LibraryPhoto = SamplePhoto & {
  /** True if this photo lives in the device's photo library (iOS), not bundled samples. */
  isNative: boolean;
  /** Native asset identifier — required to delete via PHPhotoLibrary. */
  nativeId?: string;
  /** True if the photo is only in iCloud and not downloaded locally. */
  isCloudAsset?: boolean;
};

export type PhotoPermission = {
  granted: boolean;
  limited: boolean;
  canAskAgain: boolean;
};

export type PhotoSource = {
  isNative: boolean;
  requestPermission: () => Promise<PhotoPermission>;
  getRandom: (count: number) => Promise<LibraryPhoto[]>;
  getOlder: (beforeYear: number, count: number) => Promise<LibraryPhoto[]>;
  getBurstGroups: (maxGroups: number) => Promise<LibraryPhoto[][]>;
  deletePhotos: (ids: string[]) => Promise<{ deleted: number }>;
};

type BridgeDeleteResult = { deleted?: number };

// ─── Bridge detection ───────────────────────────

declare global {
  interface Window {
    __SLIM_NATIVE__?: boolean;
    __SLIM_BUNDLED_NATIVE__?: boolean;
    __SLIM_BRIDGE_VERSION__?: number;
    __SLIM_SAFE_AREA__?: { top: number; bottom: number; left: number; right: number };
    __slimBridgeCall?: (method: string, data?: Record<string, unknown>) => Promise<unknown>;
    ReactNativeWebView?: { postMessage: (msg: string) => void };
  }
}

function hasNativeMarker(): boolean {
  if (typeof window === "undefined") return false;
  if (window.__SLIM_NATIVE__ === true) return true;
  if (window.__SLIM_BUNDLED_NATIVE__ === true) return true;

  const nativeMeta = window.document?.querySelector('meta[name="slim-native"]');
  return nativeMeta?.getAttribute("content") === "true";
}

function hasBridge(): boolean {
  if (typeof window === "undefined") return false;
  if (hasNativeMarker()) return true;
  if (typeof window.__slimBridgeCall === "function") return true;
  if (typeof window.ReactNativeWebView?.postMessage === "function") return true;
  return false;
}

function hasCallableBridge(): boolean {
  return typeof window !== "undefined" && typeof window.__slimBridgeCall === "function";
}

async function bridgeCall(method: string, data?: Record<string, unknown>): Promise<unknown> {
  if (!hasCallableBridge()) {
    await waitForBridgeCall(5000);
  }

  if (!window.__slimBridgeCall) {
    console.log("[photo-source] bridge missing", {
      nativeFlag: window.__SLIM_NATIVE__,
      bundledNativeFlag: window.__SLIM_BUNDLED_NATIVE__,
      nativeMeta: window.document
        ?.querySelector('meta[name="slim-native"]')
        ?.getAttribute("content"),
      hasRNWebView: !!window.ReactNativeWebView,
      method,
    });
    throw new Error("Bridge not available");
  }
  return window.__slimBridgeCall(method, data);
}

// ─── Native bridge source ───────────────────────

function dtoToLibraryPhoto(dto: Record<string, unknown>): LibraryPhoto {
  return {
    id: String(dto.id ?? ""),
    url: String(dto.uri ?? ""),
    thumb: String(dto.thumbUri ?? dto.uri ?? ""),
    title: String(dto.title ?? "Photo"),
    year: Number(dto.year ?? new Date().getFullYear()),
    month: String(dto.month ?? "Jan"),
    device: String(dto.device ?? "iPhone"),
    sizeMB: Number(dto.sizeMB ?? 0),
    hasGPS: Boolean(dto.hasGPS),
    isNative: true,
    nativeId: String(dto.nativeId ?? dto.id ?? ""),
    isCloudAsset: Boolean(dto.isCloudAsset),
    cleanupReasons: Array.isArray(dto.cleanupReasons)
      ? dto.cleanupReasons.filter((item): item is string => typeof item === "string")
      : [],
  };
}

const nativeBridgeSource: PhotoSource = {
  isNative: true,

  async requestPermission() {
    const result = (await bridgeCall("requestPermission")) as Partial<PhotoPermission> | null;
    return {
      granted: result?.granted === true,
      limited: result?.limited === true,
      canAskAgain: result?.canAskAgain !== false,
    };
  },

  async getRandom(count) {
    const photos = (await bridgeCall("getPhotos", { count })) as Record<string, unknown>[] | null;
    return (photos || []).map(dtoToLibraryPhoto);
  },

  async getOlder(beforeYear, count) {
    const photos = (await bridgeCall("getOlderPhotos", { beforeYear, count })) as
      | Record<string, unknown>[]
      | null;
    return (photos || []).map(dtoToLibraryPhoto);
  },

  async getBurstGroups(maxGroups) {
    const groups = await bridgeCall("getBurstGroups", { maxGroups });
    return ((groups as Record<string, unknown>[][] | null | undefined) || []).map((g) =>
      g.map(dtoToLibraryPhoto),
    );
  },

  async deletePhotos(ids) {
    const result = (await bridgeCall("deletePhotos", { ids })) as BridgeDeleteResult | null;
    return { deleted: result?.deleted ?? 0 };
  },
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function reasonForSample(photo: SamplePhoto): string {
  if (photo.cleanupReasons?.length) return photo.cleanupReasons[0];
  if (photo.burstId) return "Duplicate/Similar";
  if (photo.sizeMB >= 4) return "Large";
  if (photo.year <= new Date().getFullYear() - 5) return "Old";
  return "Review";
}

function diversifiedSamplePhotos(count: number): SamplePhoto[] {
  const buckets = new Map<string, SamplePhoto[]>();
  shuffle(SAMPLE_PHOTOS).forEach((photo) => {
    const reason = reasonForSample(photo);
    buckets.set(reason, [...(buckets.get(reason) ?? []), photo]);
  });

  const selected: SamplePhoto[] = [];
  const used = new Set<string>();
  const bucketEntries = shuffle([...buckets.entries()]);

  while (selected.length < count && bucketEntries.some(([, photos]) => photos.length > 0)) {
    for (const [, photos] of bucketEntries) {
      const photo = photos.shift();
      if (!photo || used.has(photo.id)) continue;
      selected.push(photo);
      used.add(photo.id);
      if (selected.length >= count) break;
    }
  }

  if (selected.length < count) {
    shuffle(SAMPLE_PHOTOS).forEach((photo) => {
      if (selected.length < count && !used.has(photo.id)) selected.push(photo);
    });
  }

  return selected;
}

// ─── Web / dev fallback source ──────────────────

function toLib(p: SamplePhoto): LibraryPhoto {
  return { ...p, isNative: false };
}

const webSource: PhotoSource = {
  isNative: false,
  async requestPermission() {
    return { granted: true, limited: false, canAskAgain: true };
  },
  async getRandom(count) {
    return diversifiedSamplePhotos(count).map(toLib);
  },
  async getOlder(beforeYear, count) {
    const pool = MEMORY_POOL.filter((p) => p.year < beforeYear);
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count).map(toLib);
  },
  async getBurstGroups(maxGroups) {
    return shuffle(BURST_GROUPS)
      .slice(0, maxGroups)
      .map((g) => shuffle(g).map(toLib));
  },
  async deletePhotos(ids) {
    return { deleted: ids.length };
  },
};

// ─── Resolver ───────────────────────────────────

let cached: PhotoSource | null = null;

function waitForBridgeCall(timeoutMs = 5000): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve(false);
      return;
    }

    if (hasCallableBridge()) {
      resolve(true);
      return;
    }

    const onReady = () => {
      resolve(true);
    };
    window.addEventListener("slimBridgeReady", onReady, { once: true });

    setTimeout(() => {
      window.removeEventListener("slimBridgeReady", onReady);
      resolve(hasCallableBridge());
    }, timeoutMs);
  });
}

if (typeof window !== "undefined") {
  window.addEventListener(
    "slimBridgeReady",
    () => {
      if (hasCallableBridge() && cached === webSource) cached = nativeBridgeSource;
    },
    { once: true },
  );
}

export async function getPhotoSourceAsync(): Promise<PhotoSource> {
  if (cached) return cached;
  if (hasCallableBridge()) {
    cached = nativeBridgeSource;
    return cached;
  }
  const bridgeReady = await waitForBridgeCall(hasNativeMarker() ? 7000 : 5000);
  cached = bridgeReady ? nativeBridgeSource : webSource;
  return cached;
}

export function getPhotoSource(): PhotoSource {
  if (cached) return cached;
  cached = hasBridge() ? nativeBridgeSource : webSource;
  return cached;
}

export async function initPhotoSource(): Promise<void> {
  await getPhotoSourceAsync();
}

export function isNativeApp(): boolean {
  return hasBridge();
}

/** Safe area insets provided by the native shell, or zeros on web. */
export function getSafeAreaInsets() {
  if (typeof window !== "undefined" && window.__SLIM_SAFE_AREA__) {
    return window.__SLIM_SAFE_AREA__;
  }
  return { top: 0, bottom: 0, left: 0, right: 0 };
}
