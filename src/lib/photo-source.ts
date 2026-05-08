// src/lib/photo-source.ts
// Bridges to native iOS photo library when running inside the Expo WebView,
// falls back to sample photos for web preview.

import type { SamplePhoto } from "@/lib/photos";
import { softDelete } from "@/lib/storage";

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
  trimPhotos: (ids: string[], photos?: LibraryPhoto[]) => Promise<{ trimmed: number }>;
};

export type PhotoSourceSummary = {
  label: string;
  hasPhotos: boolean;
  isNative: boolean;
};

type BridgeDeleteResult = { deleted?: number };
type BridgeTrimResult = { converted?: boolean };

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

  async trimPhotos(ids, photos = []) {
    let trimmed = 0;
    const photoById = new Map(photos.map((photo) => [photo.nativeId ?? photo.id, photo]));

    for (const id of ids) {
      const photo = photoById.get(id);
      if (!photo) {
        console.log("[photo-source] native trim skipped; photo data unavailable", { id });
        continue;
      }

      try {
        const jpegDataUri = await photoToJpegDataUri(photo.url || photo.thumb, 0.82);
        const result = (await bridgeCall("replaceAssetWithJpeg", {
          assetId: id,
          filename: jpegFilenameForPhoto(photo),
          jpegDataUri,
        })) as BridgeTrimResult | null;
        if (result?.converted) trimmed += 1;
      } catch (error) {
        console.log("[photo-source] native trim failed", { id, error });
      }
    }

    console.log("[photo-source] native trim completed", { requested: ids.length, trimmed });
    return { trimmed };
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

// ─── Web / dev fallback source ──────────────────

type WebFolderFile = File & { webkitRelativePath?: string };

type FileSystemWritableFileStreamLike = {
  write: (data: Blob | string) => Promise<void>;
  close: () => Promise<void>;
};

type FileSystemFileHandleLike = {
  kind?: string;
  name: string;
  getFile: () => Promise<File>;
  createWritable?: () => Promise<FileSystemWritableFileStreamLike>;
};

type FileSystemDirectoryHandleLike = {
  name?: string;
  values: () => AsyncIterable<FileSystemDirectoryHandleLike | FileSystemFileHandleLike>;
  getDirectoryHandle?: (
    name: string,
    options?: { create?: boolean },
  ) => Promise<FileSystemDirectoryHandleLike>;
  getFileHandle?: (
    name: string,
    options?: { create?: boolean },
  ) => Promise<FileSystemFileHandleLike>;
  removeEntry?: (name: string) => Promise<void>;
};

type WebFolderEntry = {
  file: WebFolderFile;
  fileHandle?: FileSystemFileHandleLike;
  directoryHandle?: FileSystemDirectoryHandleLike;
};

let webFolderPhotos: LibraryPhoto[] = [];
let webFolderEntries = new Map<string, WebFolderEntry>();
let webObjectUrls: string[] = [];
let webFolderName = "No folder selected";

const IMAGE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "heic",
  "heif",
  "bmp",
  "avif",
]);
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function isImageFile(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  const ext = file.name.split(".").pop()?.toLowerCase();
  return ext ? IMAGE_EXTENSIONS.has(ext) : false;
}

function notifyPhotoSourceChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("slimPhotoSourceChanged"));
  }
}

function replaceWebFolderPhotos(entries: WebFolderEntry[], folderName: string) {
  webObjectUrls.forEach((url) => URL.revokeObjectURL(url));
  webObjectUrls = [];
  webFolderEntries = new Map();
  webFolderPhotos = entries
    .filter(({ file }) => isImageFile(file))
    .map(({ file, fileHandle, directoryHandle }, index) => {
      const url = URL.createObjectURL(file);
      webObjectUrls.push(url);
      const date = new Date(file.lastModified || Date.now());
      const title = (file.webkitRelativePath || file.name).split("/").pop() || `Photo ${index + 1}`;
      const id = `web-folder-${index}-${file.name}-${file.lastModified}`;
      webFolderEntries.set(id, { file, fileHandle, directoryHandle });
      return {
        id,
        nativeId: id,
        url,
        thumb: url,
        title,
        year: date.getFullYear(),
        month: MONTHS[date.getMonth()] ?? "Jan",
        device: "Selected folder",
        sizeMB: +(file.size / 1_000_000).toFixed(2),
        hasGPS: false,
        cleanupReasons: file.size / 1_000_000 >= 4 ? ["Large"] : ["Review"],
        isNative: false,
      };
    });
  webFolderName = folderName || "Selected folder";
  console.log("[photo-source] loaded web folder", {
    folderName: webFolderName,
    imageCount: webFolderPhotos.length,
  });
  notifyPhotoSourceChanged();
}

async function collectDirectoryFiles(
  handle: FileSystemDirectoryHandleLike,
): Promise<WebFolderEntry[]> {
  const files: WebFolderEntry[] = [];
  for await (const entry of handle.values()) {
    if (entry.kind === "directory" && "values" in entry) {
      files.push(...(await collectDirectoryFiles(entry)));
    } else if (entry.kind === "file" && "getFile" in entry) {
      files.push({
        file: (await entry.getFile()) as WebFolderFile,
        fileHandle: entry,
        directoryHandle: handle,
      });
    }
  }
  return files;
}

function chooseFolderWithInput(): Promise<WebFolderFile[]> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = "image/*";
    input.style.display = "none";
    input.setAttribute("webkitdirectory", "");
    input.addEventListener("change", () => {
      resolve(Array.from(input.files ?? []) as WebFolderFile[]);
      input.remove();
    });
    document.body.appendChild(input);
    input.click();
  });
}

async function requestWebFolder(): Promise<PhotoPermission> {
  if (typeof window === "undefined") return { granted: false, limited: false, canAskAgain: true };
  try {
    const showDirectoryPicker = (
      window as unknown as {
        showDirectoryPicker?: (options?: {
          mode?: "read" | "readwrite";
        }) => Promise<FileSystemDirectoryHandleLike>;
      }
    ).showDirectoryPicker;
    const pickedDirectory = showDirectoryPicker
      ? await showDirectoryPicker({ mode: "readwrite" })
      : null;
    const files = pickedDirectory
      ? await collectDirectoryFiles(pickedDirectory)
      : (await chooseFolderWithInput()).map((file) => ({ file }));
    const fallbackFolderName =
      files[0]?.file.webkitRelativePath?.split("/").filter(Boolean)[0] ?? "Selected folder";
    replaceWebFolderPhotos(files, pickedDirectory?.name ?? fallbackFolderName);
    return { granted: webFolderPhotos.length > 0, limited: false, canAskAgain: true };
  } catch (error) {
    console.log("[photo-source] web folder selection cancelled or failed", { error });
    return { granted: webFolderPhotos.length > 0, limited: false, canAskAgain: true };
  }
}

export async function selectPhotoSourceFolder(): Promise<PhotoPermission> {
  if (isNativeApp()) return nativeBridgeSource.requestPermission();
  return requestWebFolder();
}

export function getPhotoSourceSummary(): PhotoSourceSummary {
  if (isNativeApp()) {
    return { label: "iPhone storage", hasPhotos: true, isNative: true };
  }
  return { label: webFolderName, hasPhotos: webFolderPhotos.length > 0, isNative: false };
}

function webPhotoPool(): LibraryPhoto[] {
  return webFolderPhotos;
}

const webSource: PhotoSource = {
  isNative: false,
  async requestPermission() {
    if (webFolderPhotos.length > 0) {
      return { granted: true, limited: false, canAskAgain: true };
    }
    return requestWebFolder();
  },
  async getRandom(count) {
    return shuffle(webPhotoPool()).slice(0, count);
  },
  async getOlder(beforeYear, count) {
    const pool = webPhotoPool().filter((p) => p.year < beforeYear);
    return shuffle(pool).slice(0, count);
  },
  async getBurstGroups(maxGroups) {
    const photos = shuffle(webPhotoPool());
    const groups: LibraryPhoto[][] = [];
    for (let i = 0; i + 1 < photos.length && groups.length < maxGroups; i += 2) {
      groups.push([photos[i], photos[i + 1]]);
    }
    return groups;
  },
  async deletePhotos(ids) {
    let deleted = 0;
    const deletedIds = new Set<string>();

    for (const id of ids) {
      const entry = webFolderEntries.get(id);
      const photo = webFolderPhotos.find((item) => (item.nativeId ?? item.id) === id);
      if (!entry || !photo) {
        console.log("[photo-source] web delete skipped; photo entry unavailable", { id });
        continue;
      }

      try {
        const movedToTrash = await moveWebEntryToSlimTrash(entry);
        let removedFromFolder = movedToTrash;

        if (!movedToTrash && entry.directoryHandle?.removeEntry) {
          await entry.directoryHandle.removeEntry(entry.file.name);
          removedFromFolder = true;
        }

        if (!removedFromFolder) {
          console.log("[photo-source] web delete using soft-delete fallback", {
            id,
            hasDirectoryHandle: Boolean(entry.directoryHandle),
          });
        }

        softDelete({ id: photo.id, title: photo.title, sizeMB: photo.sizeMB });
        webFolderEntries.delete(id);
        deletedIds.add(id);
        deleted += 1;
      } catch (error) {
        console.log("[photo-source] web delete failed", { id, error });
      }
    }

    if (deletedIds.size > 0) {
      webFolderPhotos = webFolderPhotos.filter(
        (photo) => !deletedIds.has(photo.nativeId ?? photo.id),
      );
      notifyPhotoSourceChanged();
    }

    console.log("[photo-source] web delete completed", { requested: ids.length, deleted });
    return { deleted };
  },

  async trimPhotos(ids) {
    let trimmed = 0;
    for (const id of ids) {
      const entry = webFolderEntries.get(id);
      if (!entry?.fileHandle?.createWritable) {
        console.log("[photo-source] web trim skipped; writable file handle unavailable", { id });
        continue;
      }

      try {
        const photo = webFolderPhotos.find((item) => (item.nativeId ?? item.id) === id);
        const blob = await trimWebImageToJpeg(photo?.url ?? URL.createObjectURL(entry.file));
        if (!blob || blob.size >= entry.file.size) {
          console.log("[photo-source] web trim skipped; no smaller JPEG produced", {
            id,
            originalSize: entry.file.size,
            trimmedSize: blob?.size ?? 0,
          });
          continue;
        }
        const writable = await entry.fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        trimmed += 1;
      } catch (error) {
        console.log("[photo-source] web trim failed", { id, error });
      }
    }
    console.log("[photo-source] web trim completed", { requested: ids.length, trimmed });
    return { trimmed };
  },
};

function jpegFilenameForPhoto(photo: Pick<LibraryPhoto, "title">): string {
  const base = photo.title.replace(/\.[^.]+$/, "").trim() || "TrimSwipe photo";
  return `${base}.jpg`;
}

function photoToJpegDataUri(url: string, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth || image.width;
      canvas.height = image.naturalHeight || image.height;
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("Canvas is unavailable for trimming"));
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    image.onerror = () => reject(new Error(`Could not load image for trimming: ${url}`));
    image.decoding = "async";
    image.src = url;
  });
}

async function moveWebEntryToSlimTrash(entry: WebFolderEntry): Promise<boolean> {
  const parent = entry.directoryHandle;
  if (!parent?.getDirectoryHandle || !parent.getFileHandle || !parent.removeEntry) return false;

  const trash = await parent.getDirectoryHandle("_Slim_Recycle_Bin", { create: true });
  if (!trash.getFileHandle) return false;

  const targetName = `${Date.now()}-${entry.file.name}`;
  const targetHandle = await trash.getFileHandle(targetName, { create: true });
  if (!targetHandle.createWritable) return false;

  const writable = await targetHandle.createWritable();
  await writable.write(entry.file);
  await writable.close();
  await parent.removeEntry(entry.file.name);
  console.log("[photo-source] web file moved to Slim recycle bin", {
    from: entry.file.name,
    to: `_Slim_Recycle_Bin/${targetName}`,
  });
  return true;
}

function trimWebImageToJpeg(url: string): Promise<Blob | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth || image.width;
      canvas.height = image.naturalHeight || image.height;
      const context = canvas.getContext("2d");
      if (!context) {
        resolve(null);
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.82);
    };
    image.onerror = () => resolve(null);
    image.decoding = "async";
    image.src = url;
  });
}

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
