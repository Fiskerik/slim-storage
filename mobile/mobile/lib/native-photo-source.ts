import * as FileSystem from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library";
import type { NativeSettings, NativeTrimKind } from "./native-store";

export type NativeCleanupCategory =
  | "large"
  | "old"
  | "screenshots"
  | "live"
  | "duplicates"
  | "bursts"
  | "mistakes";

export type NativePhoto = {
  id: string;
  uri: string;
  localUri: string | null;
  title: string;
  year: number;
  month: string;
  device: string;
  sizeMB: number;
  hasGPS: boolean;
  isCloudAsset: boolean;
  creationTime: number;
  cleanupReasons: string[];
  trimState?: NativePhotoTrimState;
};

export type NativePhotoTrimState = {
  applied: NativeTrimKind[];
  updatedAt: string;
};

export type NativePhotoPermission = {
  granted: boolean;
  limited: boolean;
  canAskAgain: boolean;
};

export type NativePhotoRoundOptions = {
  avoidIds?: string[];
};

export type NativeLibraryScanProgress = {
  scanned: number;
  total?: number;
};

export type NativeLibraryScan = {
  assetCount: number;
  localAssetCount: number;
  unknownSizeCount: number;
  totalSizeMB: number;
  deviceCapacityMB: number | null;
  freeSpaceMB: number | null;
  trimSavingsMB: number;
  duplicateDeleteSavingsMB: number;
  mistakeDeleteSavingsMB: number;
  deleteSavingsMB: number;
  duplicateRemovalCount: number;
  mistakeCount: number;
  screenshotCount: number;
  largeCount: number;
  oldCount: number;
  livePhotoCount: number;
  burstCount: number;
  largeSavingsMB: number;
  oldSavingsMB: number;
  screenshotSavingsMB: number;
  livePhotoSavingsMB: number;
  burstDeleteSavingsMB: number;
  scannedAt: string;
};

export type NativeCleanupPlan = {
  category: NativeCleanupCategory;
  title: string;
  candidates: NativePhoto[];
  deleteCandidates: NativePhoto[];
  trimCandidates: NativePhoto[];
  estimatedDeleteSavingsMB: number;
  estimatedTrimSavingsMB: number;
};

type PhotoMetadataCache = {
  version: 1;
  updatedAt: number;
  photos: NativePhoto[];
};

type MediaAlbum = Awaited<ReturnType<typeof MediaLibrary.getAlbumsAsync>>[number];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const CACHE_FILE = "trimswipe-native-photo-cache-v1.json";
const TRIM_TAGS_FILE = "trimswipe-native-trim-tags-v1.json";
const CACHE_LIMIT = 700;
const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_TRIM_KINDS: NativeTrimKind[] = ["metadata", "location", "compression"];

let memoryCache: PhotoMetadataCache | null | undefined;
let memoryTrimTags: Record<string, NativePhotoTrimState> | null | undefined;

function cacheUri(): string | null {
  return FileSystem.documentDirectory ? `${FileSystem.documentDirectory}${CACHE_FILE}` : null;
}

function trimTagsUri(): string | null {
  return FileSystem.documentDirectory ? `${FileSystem.documentDirectory}${TRIM_TAGS_FILE}` : null;
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function ageYears(creationTime: number): number {
  return Math.max(0, (Date.now() - creationTime) / (365.25 * DAY_MS));
}

function assetSizeMB(asset: MediaLibrary.Asset): number {
  const fileSize = (asset as MediaLibrary.Asset & { fileSize?: number }).fileSize;
  return typeof fileSize === "number" && fileSize > 0 ? +(fileSize / (1024 * 1024)).toFixed(2) : 0;
}

function estimatedAssetSizeMB(asset: MediaLibrary.Asset): number {
  const measured = assetSizeMB(asset);
  if (measured > 0) return measured;

  const width = asset.width || 0;
  const height = asset.height || 0;
  if (width <= 0 || height <= 0) return 0;

  const filename = asset.filename?.toLowerCase() ?? "";
  const megapixels = (width * height) / 1_000_000;
  const multiplier = filename.endsWith(".heic") || filename.endsWith(".heif") ? 0.22 : 0.34;
  return +Math.max(0.35, Math.min(25, megapixels * multiplier)).toFixed(2);
}

function normalizeTrimKinds(value: unknown, fallback: NativeTrimKind[] = []): NativeTrimKind[] {
  const allowed: NativeTrimKind[] = ["metadata", "location", "compression"];
  if (!Array.isArray(value)) return fallback;
  const kinds = value.filter((item): item is NativeTrimKind => allowed.includes(item as NativeTrimKind));
  return [...new Set(kinds)];
}

function trimKindsForSettings(settings?: Pick<NativeSettings, "trimKinds"> | NativeTrimKind[]): NativeTrimKind[] {
  const value = Array.isArray(settings) ? settings : settings?.trimKinds;
  const kinds = normalizeTrimKinds(value, DEFAULT_TRIM_KINDS);
  return kinds.length > 0 ? kinds : DEFAULT_TRIM_KINDS;
}

function normalizeTrimState(value: unknown): NativePhotoTrimState | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Partial<NativePhotoTrimState>;
  const applied = normalizeTrimKinds(raw.applied);
  if (applied.length === 0) return undefined;
  return {
    applied,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : new Date().toISOString(),
  };
}

async function readTrimTags(): Promise<Record<string, NativePhotoTrimState>> {
  if (memoryTrimTags != null) return memoryTrimTags;

  const uri = trimTagsUri();
  if (!uri) {
    memoryTrimTags = {};
    return memoryTrimTags;
  }

  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) {
      memoryTrimTags = {};
      return memoryTrimTags;
    }
    const parsed = JSON.parse(await FileSystem.readAsStringAsync(uri)) as Record<string, unknown>;
    memoryTrimTags = Object.fromEntries(
      Object.entries(parsed)
        .map(([id, state]) => [id, normalizeTrimState(state)] as const)
        .filter((entry): entry is [string, NativePhotoTrimState] => Boolean(entry[1])),
    );
    return memoryTrimTags;
  } catch (error) {
    console.log("[NativePhotoSource] Could not read trim tags", { error });
    memoryTrimTags = {};
    return memoryTrimTags;
  }
}

async function writeTrimTags(tags: Record<string, NativePhotoTrimState>): Promise<void> {
  const uri = trimTagsUri();
  memoryTrimTags = tags;
  if (!uri) return;

  try {
    await FileSystem.writeAsStringAsync(uri, JSON.stringify(tags));
  } catch (error) {
    console.log("[NativePhotoSource] Could not write trim tags", { error });
  }
}

async function setTrimTag(id: string, state: NativePhotoTrimState): Promise<void> {
  const tags = await readTrimTags();
  await writeTrimTags({ ...tags, [id]: state });
}

async function removeTrimTagIds(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const tags = await readTrimTags();
  const next = { ...tags };
  ids.forEach((id) => {
    delete next[id];
  });
  await writeTrimTags(next);
}

function stripKindLabel(kind: NativeTrimKind, quality?: number): string {
  if (kind === "metadata") return "Metadata stripped";
  if (kind === "location") return "Location stripped";
  return `Compressed${quality ? ` ${Math.round(quality * 100)}%` : ""}`;
}

function nextKindLabel(kinds: NativeTrimKind[], quality?: number): string {
  if (kinds.length === 0) return "Not-trimmable";
  if (kinds.includes("metadata") && kinds.includes("location")) return "Strip metadata + location";
  if (kinds.includes("metadata")) return "Strip metadata";
  if (kinds.includes("location")) return "Strip location";
  if (kinds.includes("compression")) return `Compress ${Math.round((quality ?? 0.75) * 100)}%`;
  return "Trim";
}

export function getTrimStatus(
  photo: Pick<NativePhoto, "hasGPS" | "isCloudAsset" | "sizeMB" | "trimState">,
  trimKinds: NativeTrimKind[] = DEFAULT_TRIM_KINDS,
  quality?: number,
): {
  canTrim: boolean;
  applied: NativeTrimKind[];
  strippedLabels: string[];
  nextKinds: NativeTrimKind[];
  nextLabel: string;
  statusLabel: string;
} {
  const enabled = trimKindsForSettings(trimKinds);
  const applied = normalizeTrimKinds(photo.trimState?.applied);
  const appliedSet = new Set(applied);
  const pendingStrip = enabled.filter(
    (kind) =>
      (kind === "metadata" || (kind === "location" && (photo.hasGPS || appliedSet.has("location")))) &&
      !appliedSet.has(kind),
  );
  const nextKinds =
    pendingStrip.length > 0
      ? pendingStrip
      : enabled.includes("compression") && !appliedSet.has("compression")
        ? (["compression"] as NativeTrimKind[])
        : [];
  const strippedLabels = applied.map((kind) => stripKindLabel(kind, quality));
  return {
    canTrim: !photo.isCloudAsset && nextKinds.length > 0 && photo.sizeMB > 0,
    applied,
    strippedLabels,
    nextKinds,
    nextLabel: nextKindLabel(nextKinds, quality),
    statusLabel: nextKinds.length > 0 ? nextKindLabel(nextKinds, quality) : "Not-trimmable",
  };
}

function estimateTrimKindSavings(
  photo: Pick<NativePhoto, "sizeMB" | "hasGPS">,
  kind: NativeTrimKind,
): number {
  if (kind === "metadata") {
    return Math.max(photo.hasGPS ? 0.18 : 0.08, Math.min(photo.sizeMB * 0.08, 0.85));
  }
  if (kind === "location") {
    return photo.hasGPS ? Math.max(0.1, Math.min(photo.sizeMB * 0.035, 0.45)) : 0;
  }
  return Math.max(photo.sizeMB * 0.18, Math.min(photo.sizeMB * 0.45, photo.sizeMB * 0.28));
}

function duplicateKey(asset: MediaLibrary.Asset): string {
  return `${Math.round(asset.creationTime / 3000)}:${asset.width}x${asset.height}`;
}

function burstKey(asset: MediaLibrary.Asset): string {
  return `${Math.round(asset.creationTime / 1000)}:${asset.width}x${asset.height}`;
}

function buildDuplicateLookup(assets: MediaLibrary.Asset[]): Set<string> {
  const counts = new Map<string, number>();
  assets.forEach((asset) => {
    const key = duplicateKey(asset);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([key]) => key));
}

function includesReason(photo: Pick<NativePhoto, "cleanupReasons" | "title">, reason: string): boolean {
  const title = photo.title.toLowerCase();
  return (
    photo.cleanupReasons.some((item) => item.toLowerCase() === reason.toLowerCase()) ||
    title.includes(reason.toLowerCase())
  );
}

function matchesPhotoSettings(
  photo: Pick<NativePhoto, "creationTime" | "sizeMB" | "cleanupReasons" | "title" | "isCloudAsset">,
  settings: NativeSettings,
): boolean {
  if (settings.targetMode === "balanced") return true;

  const isLarge = photo.sizeMB >= settings.minSizeMB;
  const isOld = ageYears(photo.creationTime) >= settings.minAgeYears;

  switch (settings.targetMode) {
    case "big-only":
      return isLarge;
    case "old-only":
      return isOld;
    case "old-and-large":
      return isLarge && isOld;
    case "similar":
      return includesReason(photo, "Similar");
    case "screenshots":
      return includesReason(photo, "Screenshot");
    case "live-photos":
      return includesReason(photo, "Live Photo");
    case "bursts":
      return includesReason(photo, "Burst") || includesReason(photo, "Similar");
    case "icloud":
      return photo.isCloudAsset;
    case "mistakes":
      return includesReason(photo, "Mistake?") || includesReason(photo, "Blurry") || includesReason(photo, "Dark");
    case "big-or-old":
    default:
      return isLarge || isOld;
  }
}

function assetLooksLikeScreenshot(asset: MediaLibrary.Asset): boolean {
  const filename = asset.filename?.toLowerCase() ?? "";
  return filename.includes("screenshot") || filename.includes("screen shot");
}

function assetLooksLikeLivePhoto(asset: MediaLibrary.Asset): boolean {
  const subtypes = (asset as MediaLibrary.Asset & { mediaSubtypes?: string[] }).mediaSubtypes ?? [];
  const filename = asset.filename?.toLowerCase() ?? "";
  return subtypes.some((subtype) => subtype.toLowerCase().includes("live")) || filename.includes("live");
}

function assetLooksLikeMistake(asset: MediaLibrary.Asset): boolean {
  const filename = asset.filename?.toLowerCase() ?? "";
  const width = asset.width || 0;
  const height = asset.height || 0;
  const ratio = width > 0 && height > 0 ? Math.max(width, height) / Math.max(1, Math.min(width, height)) : 1;
  const measuredSizeMB = assetSizeMB(asset);
  return (
    ratio > 2.2 ||
    (measuredSizeMB > 0 && measuredSizeMB < 0.35) ||
    filename.includes("blur") ||
    filename.includes("dark")
  );
}

function matchesAssetSettings(
  asset: MediaLibrary.Asset,
  settings: NativeSettings,
  duplicateLookup: Set<string>,
): boolean {
  if (settings.targetMode === "balanced") return true;

  const isLarge = assetSizeMB(asset) >= settings.minSizeMB;
  const isOld = ageYears(asset.creationTime) >= settings.minAgeYears;

  switch (settings.targetMode) {
    case "big-only":
      return isLarge;
    case "old-only":
      return isOld;
    case "old-and-large":
      return isLarge && isOld;
    case "similar":
      return duplicateLookup.has(duplicateKey(asset));
    case "screenshots":
      return assetLooksLikeScreenshot(asset);
    case "live-photos":
      return assetLooksLikeLivePhoto(asset);
    case "bursts":
      return duplicateLookup.has(duplicateKey(asset));
    case "icloud":
      return assetSizeMB(asset) === 0;
    case "mistakes":
      return assetLooksLikeMistake(asset);
    case "big-or-old":
    default:
      return isLarge || isOld;
  }
}

function scorePhoto(
  photo: Pick<NativePhoto, "creationTime" | "sizeMB" | "cleanupReasons" | "title" | "isCloudAsset">,
  settings: NativeSettings,
): number {
  const sizeScore = settings.minSizeMB > 0 ? photo.sizeMB / settings.minSizeMB : 0;
  const ageScore = settings.minAgeYears > 0 ? ageYears(photo.creationTime) / settings.minAgeYears : 0;
  const isLarge = photo.sizeMB >= settings.minSizeMB;
  const isOld = ageYears(photo.creationTime) >= settings.minAgeYears;
  const modeMatch = matchesPhotoSettings(photo, settings) ? 3 : 0;
  return (
    Math.min(sizeScore, 4) +
    Math.min(ageScore, 4) +
    (isLarge ? 2 : 0) +
    (isOld ? 2 : 0) +
    (isLarge && isOld ? 3 : 0) +
    modeMatch
  );
}

function scoreAsset(asset: MediaLibrary.Asset, settings: NativeSettings): number {
  return scorePhoto(
    {
      creationTime: asset.creationTime,
      sizeMB: assetSizeMB(asset),
      cleanupReasons: [],
      title: asset.filename ?? "",
      isCloudAsset: assetSizeMB(asset) === 0,
    },
    settings,
  );
}

function classifyAsset(
  asset: MediaLibrary.Asset,
  info: MediaLibrary.AssetInfo,
  sizeMB: number,
  duplicateLookup: Set<string>,
): string[] {
  const reasons = new Set<string>();
  const filename = asset.filename?.toLowerCase() ?? "";
  const width = asset.width || 0;
  const height = asset.height || 0;
  const ratio = width > 0 && height > 0 ? Math.max(width, height) / Math.max(1, Math.min(width, height)) : 1;

  if (ageYears(asset.creationTime) >= 5) reasons.add("Old");
  if (sizeMB >= 4) reasons.add("Large");
  if (duplicateLookup.has(duplicateKey(asset))) reasons.add("Similar");
  if (assetLooksLikeScreenshot(asset)) reasons.add("Screenshot");
  if (assetLooksLikeLivePhoto(asset)) reasons.add("Live Photo");
  if (duplicateLookup.has(duplicateKey(asset))) reasons.add("Burst");
  if (filename.includes("blur")) reasons.add("Blurry");
  if (filename.includes("dark") || filename.includes("night")) reasons.add("Dark");
  if (ratio > 2.2 || sizeMB < 0.35 || filename.includes("pocket")) reasons.add("Mistake?");
  if (!info.location && !asset.filename) reasons.add("No context");
  if (reasons.size === 0) reasons.add("Review");

  return [...reasons].slice(0, 3);
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

function isNativePhoto(value: unknown): value is NativePhoto {
  const item = value && typeof value === "object" ? (value as Partial<NativePhoto>) : {};
  return typeof item.id === "string" && typeof item.uri === "string" && typeof item.creationTime === "number";
}

function normalizeCachedPhoto(photo: NativePhoto): NativePhoto {
  const trimState = normalizeTrimState(photo.trimState);
  return trimState ? { ...photo, trimState } : { ...photo, trimState: undefined };
}

async function readCache(): Promise<PhotoMetadataCache> {
  if (memoryCache != null) return memoryCache;

  const uri = cacheUri();
  if (!uri) {
    memoryCache = { version: 1, updatedAt: 0, photos: [] };
    return memoryCache;
  }

  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) {
      memoryCache = { version: 1, updatedAt: 0, photos: [] };
      return memoryCache;
    }

    const raw = await FileSystem.readAsStringAsync(uri);
    const parsed = JSON.parse(raw) as Partial<PhotoMetadataCache>;
    const trimTags = await readTrimTags();
    memoryCache = {
      version: 1,
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : 0,
      photos: Array.isArray(parsed.photos)
        ? parsed.photos
            .filter(isNativePhoto)
            .map(normalizeCachedPhoto)
            .map((photo) => (trimTags[photo.id] ? { ...photo, trimState: trimTags[photo.id] } : photo))
        : [],
    };
    return memoryCache;
  } catch (error) {
    console.log("[NativePhotoSource] Could not read metadata cache", { error });
    memoryCache = { version: 1, updatedAt: 0, photos: [] };
    return memoryCache;
  }
}

async function writeCache(photos: NativePhoto[]): Promise<void> {
  const uri = cacheUri();
  const byId = new Map(photos.map((photo) => [photo.id, photo]));
  const retained = [...byId.values()]
    .sort((a, b) => {
      const sizeDiff = b.sizeMB - a.sizeMB;
      if (Math.abs(sizeDiff) > 0.25) return sizeDiff;
      return a.creationTime - b.creationTime;
    })
    .slice(0, CACHE_LIMIT);

  memoryCache = { version: 1, updatedAt: Date.now(), photos: retained };
  if (!uri) return;

  try {
    await FileSystem.writeAsStringAsync(uri, JSON.stringify(memoryCache));
  } catch (error) {
    console.log("[NativePhotoSource] Could not write metadata cache", { error });
  }
}

async function upsertCache(photos: NativePhoto[]): Promise<void> {
  if (photos.length === 0) return;
  const cache = await readCache();
  await writeCache([...cache.photos, ...photos]);
}

async function removeCacheIds(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const idSet = new Set(ids);
  const cache = await readCache();
  await writeCache(cache.photos.filter((photo) => !idSet.has(photo.id)));
}

async function assetToPhoto(
  asset: MediaLibrary.Asset,
  duplicateLookup: Set<string>,
): Promise<NativePhoto> {
  const info = await MediaLibrary.getAssetInfoAsync(asset);
  const localUri = info.localUri || asset.uri || null;
  const candidateUri = localUri || asset.uri;
  let sizeMB = assetSizeMB(asset);

  if (sizeMB === 0 && candidateUri && !candidateUri.startsWith("ph://")) {
    try {
      const fileInfo = await FileSystem.getInfoAsync(candidateUri);
      const bytes = (fileInfo as FileSystem.FileInfo & { size?: number }).size;
      if (fileInfo.exists && typeof bytes === "number" && bytes > 0) {
        sizeMB = +(bytes / (1024 * 1024)).toFixed(2);
      }
    } catch {
      sizeMB = 0;
    }
  }

  const created = new Date(asset.creationTime);
  const trimTags = await readTrimTags();
  const trimState = trimTags[asset.id];
  return {
    id: asset.id,
    uri: candidateUri,
    localUri,
    title: asset.filename || "Photo",
    year: created.getFullYear(),
    month: MONTHS[created.getMonth()] ?? "Jan",
    device:
      typeof (info.exif as Record<string, unknown> | undefined)?.Model === "string"
        ? ((info.exif as Record<string, unknown>).Model as string)
        : "iPhone",
    sizeMB,
    hasGPS: Boolean(info.location?.latitude && info.location?.longitude),
    isCloudAsset: !localUri || localUri.startsWith("ph://") || sizeMB === 0,
    creationTime: asset.creationTime,
    cleanupReasons: classifyAsset(asset, info, sizeMB, duplicateLookup),
    trimState,
  };
}

function usefulSmartAlbumScore(album: MediaAlbum): number {
  const title = String((album as MediaAlbum & { title?: string }).title ?? "").toLowerCase();
  if (title.includes("screenshot") || title.includes("screen shot")) return 10;
  if (title.includes("duplicate") || title.includes("similar")) return 9;
  if (title.includes("burst")) return 8;
  if (title.includes("selfie")) return 6;
  if (title.includes("panorama") || title.includes("slo") || title.includes("time-lapse")) return 4;
  return 0;
}

async function fetchSmartAlbumAssets(first: number): Promise<MediaLibrary.Asset[]> {
  try {
    const albums = await MediaLibrary.getAlbumsAsync({ includeSmartAlbums: true });
    const usefulAlbums = albums
      .map((album) => ({ album, score: usefulSmartAlbumScore(album) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);

    const pages = await Promise.all(
      usefulAlbums.map((item) =>
        MediaLibrary.getAssetsAsync({
          album: item.album,
          first: Math.min(80, first),
          mediaType: "photo",
          sortBy: [[MediaLibrary.SortBy.creationTime, true]],
        }),
      ),
    );

    return pages.flatMap((page) => page.assets);
  } catch (error) {
    console.log("[NativePhotoSource] Could not read smart albums", { error });
    return [];
  }
}

async function fetchCandidateAssets(
  count: number,
  settings: NativeSettings,
): Promise<MediaLibrary.Asset[]> {
  const first = Math.min(250, Math.max(80, count * 8));
  const smartAlbumsPromise = fetchSmartAlbumAssets(first);

  if (settings.targetMode === "balanced") {
    const [result, smartAlbums] = await Promise.all([
      MediaLibrary.getAssetsAsync({
        first,
        mediaType: "photo",
        sortBy: [[MediaLibrary.SortBy.creationTime, true]],
      }),
      smartAlbumsPromise,
    ]);

    const byId = new Map<string, MediaLibrary.Asset>();
    [...result.assets, ...smartAlbums].forEach((asset) => byId.set(asset.id, asset));
    return [...byId.values()];
  }

  const cutoff = Date.now() - settings.minAgeYears * 365.25 * DAY_MS;
  const [recent, older, smartAlbums] = await Promise.all([
    MediaLibrary.getAssetsAsync({
      first,
      mediaType: "photo",
      sortBy: [[MediaLibrary.SortBy.creationTime, true]],
    }),
    MediaLibrary.getAssetsAsync({
      first,
      mediaType: "photo",
      createdBefore: cutoff,
      sortBy: [[MediaLibrary.SortBy.creationTime, true]],
    }),
    smartAlbumsPromise,
  ]);

  const byId = new Map<string, MediaLibrary.Asset>();
  [...recent.assets, ...older.assets, ...smartAlbums].forEach((asset) => byId.set(asset.id, asset));
  return [...byId.values()];
}

async function readDeviceStorageMB(): Promise<{ total: number | null; free: number | null }> {
  const fileSystem = FileSystem as typeof FileSystem & {
    getTotalDiskCapacityAsync?: () => Promise<number>;
    getFreeDiskStorageAsync?: () => Promise<number>;
  };

  const [totalResult, freeResult] = await Promise.allSettled([
    fileSystem.getTotalDiskCapacityAsync?.() ?? Promise.resolve(null),
    fileSystem.getFreeDiskStorageAsync?.() ?? Promise.resolve(null),
  ]);

  const total = totalResult.status === "fulfilled" && typeof totalResult.value === "number"
    ? +(totalResult.value / (1024 * 1024)).toFixed(2)
    : null;
  const free = freeResult.status === "fulfilled" && typeof freeResult.value === "number"
    ? +(freeResult.value / (1024 * 1024)).toFixed(2)
    : null;

  return { total, free };
}

async function fetchAllPhotoAssets(
  onProgress?: (progress: NativeLibraryScanProgress) => void,
): Promise<MediaLibrary.Asset[]> {
  const assets: MediaLibrary.Asset[] = [];
  let after: string | undefined;
  let total: number | undefined;

  do {
    const page = await MediaLibrary.getAssetsAsync({
      after,
      first: 500,
      mediaType: "photo",
      sortBy: [[MediaLibrary.SortBy.creationTime, true]],
    });

    assets.push(...page.assets);
    after = page.hasNextPage ? page.endCursor : undefined;
    total = typeof (page as typeof page & { totalCount?: number }).totalCount === "number"
      ? (page as typeof page & { totalCount?: number }).totalCount
      : total;
    onProgress?.({ scanned: assets.length, total });
  } while (after);

  return assets;
}

export async function scanPhotoLibrary(
  onProgress?: (progress: NativeLibraryScanProgress) => void,
): Promise<NativeLibraryScan> {
  const [assets, storage] = await Promise.all([fetchAllPhotoAssets(onProgress), readDeviceStorageMB()]);
  const groups = new Map<string, Array<{ id: string; sizeMB: number }>>();
  const burstGroups = new Map<string, Array<{ id: string; sizeMB: number }>>();
  const summaries = assets.map((asset) => {
    const measuredSizeMB = assetSizeMB(asset);
    const sizeMB = estimatedAssetSizeMB(asset);
    const key = duplicateKey(asset);
    const burst = burstKey(asset);
    const summary = {
      id: asset.id,
      key,
      burst,
      sizeMB,
      measured: measuredSizeMB > 0,
      mistake: assetLooksLikeMistake(asset),
      screenshot: assetLooksLikeScreenshot(asset),
      large: sizeMB >= 5,
      old: ageYears(asset.creationTime) >= 1,
      live: assetLooksLikeLivePhoto(asset),
    };
    groups.set(key, [...(groups.get(key) ?? []), { id: asset.id, sizeMB }]);
    burstGroups.set(burst, [...(burstGroups.get(burst) ?? []), { id: asset.id, sizeMB }]);
    return summary;
  });

  const duplicateRemovalIds = new Set<string>();
  let duplicateDeleteSavingsMB = 0;
  let duplicateRemovalCount = 0;

  groups.forEach((items) => {
    if (items.length < 2) return;
    const removable = [...items].sort((a, b) => b.sizeMB - a.sizeMB).slice(1);
    duplicateRemovalCount += removable.length;
    removable.forEach((item) => {
      duplicateRemovalIds.add(item.id);
      duplicateDeleteSavingsMB += item.sizeMB;
    });
  });

  let burstDeleteSavingsMB = 0;
  let burstCount = 0;
  burstGroups.forEach((items) => {
    if (items.length < 3) return;
    const removable = [...items].sort((a, b) => b.sizeMB - a.sizeMB).slice(1);
    burstCount += removable.length;
    removable.forEach((item) => {
      if (!duplicateRemovalIds.has(item.id)) burstDeleteSavingsMB += item.sizeMB;
    });
  });

  const totalSizeMB = summaries.reduce((sum, item) => sum + item.sizeMB, 0);
  const trimSavingsMB = summaries.reduce(
    (sum, item) => sum + estimateTrimSavings({ sizeMB: item.sizeMB, hasGPS: false }),
    0,
  );
  const mistakeDeleteSavingsMB = summaries
    .filter((item) => item.mistake && !duplicateRemovalIds.has(item.id))
    .reduce((sum, item) => sum + item.sizeMB, 0);
  const deleteSavingsMB = duplicateDeleteSavingsMB + mistakeDeleteSavingsMB;
  const largeSavingsMB = summaries
    .filter((item) => item.large)
    .reduce((sum, item) => sum + estimateTrimSavings({ sizeMB: item.sizeMB, hasGPS: false }), 0);
  const oldSavingsMB = summaries
    .filter((item) => item.old)
    .reduce((sum, item) => sum + estimateTrimSavings({ sizeMB: item.sizeMB, hasGPS: false }), 0);
  const screenshotSavingsMB = summaries
    .filter((item) => item.screenshot)
    .reduce((sum, item) => sum + item.sizeMB, 0);
  const livePhotoSavingsMB = summaries
    .filter((item) => item.live)
    .reduce((sum, item) => sum + estimateTrimSavings({ sizeMB: item.sizeMB, hasGPS: false }), 0);

  return {
    assetCount: assets.length,
    localAssetCount: summaries.filter((item) => item.measured).length,
    unknownSizeCount: summaries.filter((item) => !item.measured).length,
    totalSizeMB: +totalSizeMB.toFixed(2),
    deviceCapacityMB: storage.total,
    freeSpaceMB: storage.free,
    trimSavingsMB: +trimSavingsMB.toFixed(2),
    duplicateDeleteSavingsMB: +duplicateDeleteSavingsMB.toFixed(2),
    mistakeDeleteSavingsMB: +mistakeDeleteSavingsMB.toFixed(2),
    deleteSavingsMB: +deleteSavingsMB.toFixed(2),
    duplicateRemovalCount,
    mistakeCount: summaries.filter((item) => item.mistake).length,
    screenshotCount: summaries.filter((item) => item.screenshot).length,
    largeCount: summaries.filter((item) => item.large).length,
    oldCount: summaries.filter((item) => item.old).length,
    livePhotoCount: summaries.filter((item) => item.live).length,
    burstCount,
    largeSavingsMB: +largeSavingsMB.toFixed(2),
    oldSavingsMB: +oldSavingsMB.toFixed(2),
    screenshotSavingsMB: +screenshotSavingsMB.toFixed(2),
    livePhotoSavingsMB: +livePhotoSavingsMB.toFixed(2),
    burstDeleteSavingsMB: +burstDeleteSavingsMB.toFixed(2),
    scannedAt: new Date().toISOString(),
  };
}

export async function loadCleanupPlan(
  category: NativeCleanupCategory,
  count: number,
  settings: NativeSettings,
  options: NativePhotoRoundOptions = {},
): Promise<NativeCleanupPlan> {
  const targetModeByCategory: Record<NativeCleanupCategory, NativeSettings["targetMode"]> = {
    large: "big-only",
    old: "old-only",
    screenshots: "screenshots",
    live: "live-photos",
    duplicates: "similar",
    bursts: "bursts",
    mistakes: "mistakes",
  };
  const candidates = await loadPhotoRound(
    count,
    {
      ...settings,
      targetMode: targetModeByCategory[category],
      cardsPerRound: count,
      minSizeMB: category === "large" ? 5 : settings.minSizeMB,
      minAgeYears: category === "old" ? 1 : settings.minAgeYears,
    },
    options,
  );
  const deleteCategories = new Set<NativeCleanupCategory>(["screenshots", "duplicates", "bursts", "mistakes"]);
  const deleteCandidates = deleteCategories.has(category) ? candidates : [];
  const trimCandidates = deleteCategories.has(category)
    ? []
    : candidates.filter((photo) => !photo.isCloudAsset && getTrimStatus(photo, settings.trimKinds).canTrim);
  const estimatedDeleteSavingsMB = deleteCandidates.reduce((sum, photo) => sum + photo.sizeMB, 0);
  const estimatedTrimSavingsMB = trimCandidates.reduce(
    (sum, photo) => sum + estimateTrimSavings(photo, settings.trimKinds),
    0,
  );
  const titleByCategory: Record<NativeCleanupCategory, string> = {
    large: "Photos >5MB",
    old: "Photos >1 year old",
    screenshots: "Screenshots",
    live: "Live Photos",
    duplicates: "Duplicates",
    bursts: "Bursts",
    mistakes: "Likely mistakes",
  };

  return {
    category,
    title: titleByCategory[category],
    candidates,
    deleteCandidates,
    trimCandidates,
    estimatedDeleteSavingsMB: +estimatedDeleteSavingsMB.toFixed(2),
    estimatedTrimSavingsMB: +estimatedTrimSavingsMB.toFixed(2),
  };
}

function chooseAssets(
  assets: MediaLibrary.Asset[],
  count: number,
  settings: NativeSettings,
  duplicateLookup: Set<string>,
): MediaLibrary.Asset[] {
  const targeted = assets.filter((asset) => matchesAssetSettings(asset, settings, duplicateLookup));
  const fallback = assets.filter((asset) => !targeted.some((target) => target.id === asset.id));
  const pool = settings.targetMode === "balanced" ? assets : [...targeted, ...fallback];

  return shuffle(pool)
    .sort((a, b) => scoreAsset(b, settings) - scoreAsset(a, settings))
    .slice(0, count);
}

function relatedPairScore(a: MediaLibrary.Asset, b: MediaLibrary.Asset): number {
  const gapMs = Math.abs(a.creationTime - b.creationTime);
  const sameDuplicateKey = duplicateKey(a) === duplicateKey(b);
  const sameDimensions = a.width === b.width && a.height === b.height;
  const sizeGap = Math.abs(estimatedAssetSizeMB(a) - estimatedAssetSizeMB(b));

  let score = 0;
  if (sameDuplicateKey) score += 120;
  if (gapMs <= 3_000) score += 90;
  else if (gapMs <= 60_000) score += 70;
  else if (gapMs <= 10 * 60_000) score += 45;
  else if (gapMs <= 60 * 60_000) score += 20;
  if (sameDimensions) score += 16;
  if (sizeGap <= 0.35) score += 8;
  return score - gapMs / (60 * 60_000);
}

export async function loadRelatedPhotoPairs(
  pairCount: number,
  settings: NativeSettings,
): Promise<[NativePhoto, NativePhoto][]> {
  const requestedPairs = Math.max(1, pairCount);
  const page = await MediaLibrary.getAssetsAsync({
    first: Math.min(500, Math.max(160, requestedPairs * 36)),
    mediaType: "photo",
    sortBy: [[MediaLibrary.SortBy.creationTime, true]],
  });
  const smartAlbums = await fetchSmartAlbumAssets(Math.min(160, requestedPairs * 24));
  const byId = new Map<string, MediaLibrary.Asset>();
  [...page.assets, ...smartAlbums].forEach((asset) => byId.set(asset.id, asset));
  const assets = [...byId.values()].sort((a, b) => b.creationTime - a.creationTime);

  const candidates: { a: MediaLibrary.Asset; b: MediaLibrary.Asset; score: number }[] = [];
  for (let i = 0; i < assets.length; i += 1) {
    for (let j = i + 1; j < Math.min(assets.length, i + 12); j += 1) {
      const gapMs = Math.abs(assets[i].creationTime - assets[j].creationTime);
      if (gapMs > 6 * 60 * 60_000 && duplicateKey(assets[i]) !== duplicateKey(assets[j])) continue;
      const score = relatedPairScore(assets[i], assets[j]);
      if (score > 0) candidates.push({ a: assets[i], b: assets[j], score });
    }
  }

  const selectedAssets: [MediaLibrary.Asset, MediaLibrary.Asset][] = [];
  const used = new Set<string>();
  candidates
    .sort((a, b) => b.score - a.score)
    .forEach(({ a, b }) => {
      if (selectedAssets.length >= requestedPairs) return;
      if (used.has(a.id) || used.has(b.id)) return;
      selectedAssets.push([a, b]);
      used.add(a.id);
      used.add(b.id);
    });

  if (selectedAssets.length < requestedPairs) {
    const fallback = chooseAssets(
      assets.filter((asset) => !used.has(asset.id)),
      (requestedPairs - selectedAssets.length) * 2,
      { ...settings, targetMode: "balanced" },
      buildDuplicateLookup(assets),
    );
    for (let i = 0; i + 1 < fallback.length && selectedAssets.length < requestedPairs; i += 2) {
      selectedAssets.push([fallback[i], fallback[i + 1]]);
    }
  }

  const duplicateLookup = buildDuplicateLookup(assets);
  const flattened = selectedAssets.flat();
  const photos = await mapWithConcurrency(flattened, 3, (asset) => assetToPhoto(asset, duplicateLookup));
  await upsertCache(photos);

  const photoById = new Map(photos.map((photo) => [photo.id, photo]));
  return selectedAssets
    .map(([a, b]) => [photoById.get(a.id), photoById.get(b.id)] as const)
    .filter((pair): pair is [NativePhoto, NativePhoto] => Boolean(pair[0] && pair[1]));
}

export async function requestPhotoPermission(): Promise<NativePhotoPermission> {
  const permission = await MediaLibrary.requestPermissionsAsync();
  return {
    granted: permission.status === "granted",
    limited: permission.accessPrivileges === "limited",
    canAskAgain: permission.canAskAgain,
  };
}

export async function loadPhotoRound(
  count: number,
  settings: NativeSettings,
  options: NativePhotoRoundOptions = {},
): Promise<NativePhoto[]> {
  const cache = await readCache();
  const avoidIds = new Set(options.avoidIds ?? []);
  const cachedTargeted = shuffle(
    cache.photos.filter((photo) => matchesPhotoSettings(photo, settings) && !avoidIds.has(photo.id)),
  )
    .sort((a, b) => scorePhoto(b, settings) - scorePhoto(a, settings))
    .slice(0, count);

  if (cachedTargeted.length >= count) {
    return cachedTargeted;
  }

  const assets = await fetchCandidateAssets(count, settings);
  const duplicateLookup = buildDuplicateLookup(assets);
  const cachedIds = new Set(cachedTargeted.map((photo) => photo.id));
  const selected = chooseAssets(
    assets.filter((asset) => !cachedIds.has(asset.id) && !avoidIds.has(asset.id)),
    count - cachedTargeted.length,
    settings,
    duplicateLookup,
  );
  const fresh = await mapWithConcurrency(selected, 3, (asset) => assetToPhoto(asset, duplicateLookup));
  await upsertCache(fresh);

  const combined = [...cachedTargeted, ...fresh];
  if (combined.length >= count) return combined.slice(0, count);

  const usedIds = new Set(combined.map((photo) => photo.id));
  const fallback = shuffle(cache.photos.filter((photo) => !usedIds.has(photo.id) && !avoidIds.has(photo.id))).slice(
    0,
    count - combined.length,
  );
  const next = [...combined, ...fallback].slice(0, count);
  if (next.length >= count) return next;

  const nextIds = new Set(next.map((photo) => photo.id));
  const broadAssets = chooseAssets(
    assets.filter((asset) => !nextIds.has(asset.id) && !avoidIds.has(asset.id)),
    count - next.length,
    { ...settings, targetMode: "balanced" },
    duplicateLookup,
  );
  const broadFresh = await mapWithConcurrency(broadAssets, 3, (asset) => assetToPhoto(asset, duplicateLookup));
  await upsertCache(broadFresh);
  const toppedUp = [...next, ...broadFresh].slice(0, count);
  if (toppedUp.length >= count) return toppedUp;

  const relaxedCache = shuffle(cache.photos.filter((photo) => !new Set(toppedUp.map((item) => item.id)).has(photo.id)));
  if (relaxedCache.length > 0) return [...toppedUp, ...relaxedCache].slice(0, count);

  const relaxedAssets = chooseAssets(
    assets.filter((asset) => !new Set(toppedUp.map((item) => item.id)).has(asset.id)),
    count - toppedUp.length,
    { ...settings, targetMode: "balanced" },
    duplicateLookup,
  );
  const relaxedFresh = await mapWithConcurrency(relaxedAssets, 3, (asset) => assetToPhoto(asset, duplicateLookup));
  await upsertCache(relaxedFresh);
  return [...toppedUp, ...relaxedFresh].slice(0, count);
}

export async function deletePhotos(ids: string[]): Promise<{ deleted: number }> {
  if (ids.length === 0) return { deleted: 0 };

  try {
    await MediaLibrary.deleteAssetsAsync(ids);
    await removeCacheIds(ids);
    await removeTrimTagIds(ids);
    return { deleted: ids.length };
  } catch (error) {
    console.log("[NativePhotoSource] Delete failed", { error });
    return { deleted: 0 };
  }
}

export async function trimPhoto(
  photo: NativePhoto,
  quality: number,
  replaceOriginal = true,
  trimKinds: NativeTrimKind[] = DEFAULT_TRIM_KINDS,
): Promise<{ trimmed: boolean; newAssetId?: string; savedMB?: number; error?: string }> {
  const created = await createTrimmedAsset(photo, quality, trimKinds);
  if (!created.success) return { trimmed: false, error: created.error };
  if (!replaceOriginal) {
    return { trimmed: true, newAssetId: created.newAssetId, savedMB: created.savedMB };
  }
  try {
    await MediaLibrary.deleteAssetsAsync([photo.id]);
    await removeCacheIds([photo.id]);
    await removeTrimTagIds([photo.id]);
    return { trimmed: true, newAssetId: created.newAssetId, savedMB: created.savedMB };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { trimmed: false, error: message };
  }
}

type CreatedTrim =
  | { success: true; originalId: string; newAssetId: string; savedMB: number; appliedTrimKinds: NativeTrimKind[] }
  | { success: false; originalId: string; error: string };

async function createTrimmedAsset(
  photo: NativePhoto,
  quality: number,
  trimKinds: NativeTrimKind[] = DEFAULT_TRIM_KINDS,
): Promise<CreatedTrim> {
  const sourceUri = photo.localUri || photo.uri;
  if (!sourceUri || sourceUri.startsWith("ph://")) {
    return { success: false, originalId: photo.id, error: "Photo is not downloaded locally" };
  }
  const status = getTrimStatus(photo, trimKinds, quality);
  if (!status.canTrim) {
    return { success: false, originalId: photo.id, error: "Photo already has all selected trims" };
  }
  const effectiveQuality = status.nextKinds.includes("compression") ? quality : Math.max(quality, 0.94);
  try {
    const imageManipulator = await import("expo-image-manipulator");
    const result = await imageManipulator.manipulateAsync(sourceUri, [], {
      compress: effectiveQuality,
      format: imageManipulator.SaveFormat.JPEG,
    });
    const fileInfo = await FileSystem.getInfoAsync(result.uri);
    const trimmedBytes = (fileInfo as FileSystem.FileInfo & { size?: number }).size ?? 0;
    const originalBytes = Math.max(0, photo.sizeMB * 1024 * 1024);
    if (!fileInfo.exists || trimmedBytes <= 0 || (originalBytes > 0 && trimmedBytes >= originalBytes)) {
      await FileSystem.deleteAsync(result.uri, { idempotent: true }).catch(() => undefined);
      return { success: false, originalId: photo.id, error: "Trim did not produce a smaller image" };
    }
    const created = await MediaLibrary.createAssetAsync(result.uri);
    await FileSystem.deleteAsync(result.uri, { idempotent: true }).catch(() => undefined);
    const appliedTrimKinds = [...new Set([...status.applied, ...status.nextKinds])];
    await setTrimTag(created.id, {
      applied: appliedTrimKinds,
      updatedAt: new Date().toISOString(),
    });
    return {
      success: true,
      originalId: photo.id,
      newAssetId: created.id,
      savedMB: +((originalBytes - trimmedBytes) / (1024 * 1024)).toFixed(2),
      appliedTrimKinds,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, originalId: photo.id, error: message };
  }
}

/**
 * Batch-trim multiple photos with a SINGLE iOS delete confirmation prompt.
 * Phase 1: create new (trimmed) assets for every photo. Phase 2: one
 * MediaLibrary.deleteAssetsAsync() call to remove all originals at once.
 */
export async function commitTrims(
  photos: NativePhoto[],
  quality: number,
  replaceOriginal = true,
  trimKinds: NativeTrimKind[] = DEFAULT_TRIM_KINDS,
): Promise<Array<{ id: string; trimmed: boolean; savedMB?: number; error?: string }>> {
  if (photos.length === 0) return [];
  const results: CreatedTrim[] = [];
  for (const p of photos) {
    // Sequential to avoid hitting expo-image-manipulator concurrency limits.
    results.push(await createTrimmedAsset(p, quality, trimKinds));
  }
  const created = results.filter((r): r is Extract<CreatedTrim, { success: true }> => r.success);
  if (replaceOriginal && created.length > 0) {
    try {
      await MediaLibrary.deleteAssetsAsync(created.map((c) => c.originalId));
      await removeCacheIds(created.map((c) => c.originalId));
      await removeTrimTagIds(created.map((c) => c.originalId));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return results.map((r) => ({
        id: r.originalId,
        trimmed: false,
        error: r.success ? message : r.error,
      }));
    }
  }
  return results.map((r) =>
    r.success
      ? { id: r.originalId, trimmed: true, savedMB: r.savedMB }
      : { id: r.originalId, trimmed: false, error: r.error },
  );
}

export async function commitTrimsAndDeletes(
  deletes: NativePhoto[],
  trims: NativePhoto[],
  quality: number,
  replaceTrimOriginals = true,
  trimKinds: NativeTrimKind[] = DEFAULT_TRIM_KINDS,
): Promise<{
  deletedCount: number;
  deletedPhotos: NativePhoto[];
  trimResults: Array<{ id: string; trimmed: boolean; savedMB?: number; error?: string }>;
}> {
  const deleteIds = new Set(deletes.map((photo) => photo.id));
  const trimCandidates = trims.filter((photo) => !deleteIds.has(photo.id));
  const trimCreates: CreatedTrim[] = [];

  for (const photo of trimCandidates) {
    // Sequential to avoid hitting expo-image-manipulator concurrency limits.
    trimCreates.push(await createTrimmedAsset(photo, quality, trimKinds));
  }

  const createdTrims = trimCreates.filter(
    (result): result is Extract<CreatedTrim, { success: true }> => result.success,
  );
  const idsToDelete = [
    ...deleteIds,
    ...(replaceTrimOriginals ? createdTrims.map((result) => result.originalId) : []),
  ];

  if (idsToDelete.length === 0) {
    if (!replaceTrimOriginals && createdTrims.length > 0) {
      return {
        deletedCount: 0,
        deletedPhotos: [],
        trimResults: trimCreates.map((result) =>
          result.success
            ? { id: result.originalId, trimmed: true, savedMB: result.savedMB }
            : { id: result.originalId, trimmed: false, error: result.error },
        ),
      };
    }
    return {
      deletedCount: 0,
      deletedPhotos: [],
      trimResults: trimCreates.map((result) => ({
        id: result.originalId,
        trimmed: false,
        error: result.success ? "Trim was not applied" : result.error,
      })),
    };
  }

  try {
    await MediaLibrary.deleteAssetsAsync(idsToDelete);
    await removeCacheIds(idsToDelete);
    await removeTrimTagIds(idsToDelete);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      deletedCount: 0,
      deletedPhotos: [],
      trimResults: trimCreates.map((result) => ({
        id: result.originalId,
        trimmed: false,
        error: result.success ? message : result.error,
      })),
    };
  }

  return {
    deletedCount: deletes.length,
    deletedPhotos: deletes,
    trimResults: trimCreates.map((result) =>
      result.success
        ? { id: result.originalId, trimmed: true, savedMB: result.savedMB }
        : { id: result.originalId, trimmed: false, error: result.error },
    ),
  };
}

export function estimateTrimSavings(
  photo: Pick<NativePhoto, "sizeMB" | "hasGPS"> & Partial<Pick<NativePhoto, "isCloudAsset" | "trimState">>,
  trimKinds: NativeTrimKind[] = DEFAULT_TRIM_KINDS,
): number {
  const status = getTrimStatus(
    {
      ...photo,
      isCloudAsset: photo.isCloudAsset ?? false,
      trimState: photo.trimState,
    },
    trimKinds,
  );
  if (!status.canTrim) return 0;
  return +status.nextKinds
    .reduce((sum, kind) => sum + estimateTrimKindSavings(photo, kind), 0)
    .toFixed(2);
}
