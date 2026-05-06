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

async function bridgeCall(method: string, data?: Record<string, unknown>): Promise<unknown> {
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
    return { deleted: ids.length };
  },
};

// ─── Resolver ───────────────────────────────────

let cached: PhotoSource | null = null;

function waitForBridge(timeoutMs = 5000): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve(false);
      return;
    }

    if (hasBridge()) {
      resolve(true);
      return;
    }

    const onReady = () => {
      resolve(true);
    };
    window.addEventListener("slimBridgeReady", onReady, { once: true });

    setTimeout(() => {
      window.removeEventListener("slimBridgeReady", onReady);
      resolve(hasBridge());
    }, timeoutMs);
  });
}

if (typeof window !== "undefined") {
  window.addEventListener(
    "slimBridgeReady",
    () => {
      if (cached === webSource) cached = nativeBridgeSource;
    },
    { once: true },
  );
}

export async function getPhotoSourceAsync(): Promise<PhotoSource> {
  if (cached) return cached;
  // If native markers are already set by the bundled HTML, use bridge immediately.
  if (hasNativeMarker()) {
    cached = nativeBridgeSource;
    return cached;
  }
  const bridgeReady = await waitForBridge(5000);
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
