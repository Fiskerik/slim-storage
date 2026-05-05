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

// ─── Bridge detection ───────────────────────────

declare global {
  interface Window {
    __SLIM_NATIVE__?: boolean;
    __SLIM_SAFE_AREA__?: { top: number; bottom: number; left: number; right: number };
    __slimBridgeCall?: (method: string, data?: Record<string, unknown>) => Promise<unknown>;
    ReactNativeWebView?: { postMessage: (msg: string) => void };
  }
}

function hasBridge(): boolean {
  if (typeof window === "undefined") return false;

  const hasCallableBridge = typeof window.__slimBridgeCall === "function";
  const hasRNWebView = typeof window.ReactNativeWebView?.postMessage === "function";
  const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
  const uaLooksNative = /ReactNative|Expo|CFNetwork/i.test(ua);

  // Some TestFlight/App Store wrappers may not set __SLIM_NATIVE__ consistently.
  // Treat a working bridge (or known native wrapper UA) as native.
  return hasCallableBridge || hasRNWebView || !!window.__SLIM_NATIVE__ || uaLooksNative;
}

async function bridgeCall(method: string, data?: Record<string, unknown>): Promise<unknown> {
  if (!window.__slimBridgeCall) {
    console.log("[photo-source] bridge missing", {
      nativeFlag: window.__SLIM_NATIVE__,
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
    const result = await bridgeCall("requestPermission");
    return {
      granted: result?.granted === true,
      limited: result?.limited === true,
      canAskAgain: result?.canAskAgain !== false,
    };
  },

  async getRandom(count) {
    const photos = await bridgeCall("getPhotos", { count });
    return (photos || []).map(dtoToLibraryPhoto);
  },

  async getOlder(beforeYear, count) {
    const photos = await bridgeCall("getOlderPhotos", { beforeYear, count });
    return (photos || []).map(dtoToLibraryPhoto);
  },

  async getBurstGroups(maxGroups) {
    const groups = await bridgeCall("getBurstGroups", { maxGroups });
    return ((groups as Record<string, unknown>[][] | null | undefined) || []).map((g) =>
      g.map(dtoToLibraryPhoto),
    );
  },

  async deletePhotos(ids) {
    const result = await bridgeCall("deletePhotos", { ids });
    return result || { deleted: 0 };
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

function waitForBridge(timeoutMs = 3000): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve(false);
      return;
    }

    if (typeof window.__slimBridgeCall === "function") {
      resolve(true);
      return;
    }

    const onReady = () => { resolve(true); };
    window.addEventListener("slimBridgeReady", onReady, { once: true });

    setTimeout(() => {
      window.removeEventListener("slimBridgeReady", onReady);
      resolve(typeof window.__slimBridgeCall === "function");
    }, timeoutMs);
  });
}

export async function getPhotoSourceAsync(): Promise<PhotoSource> {
  if (cached) return cached;
  const bridgeReady = await waitForBridge(3000);
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
