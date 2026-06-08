import * as FileSystem from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library";
import type { NativeSettings } from "./native-store";

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
  scannedAt: string;
};

type PhotoMetadataCache = {
  version: 1;
  updatedAt: number;
  photos: NativePhoto[];
};

type MediaAlbum = Awaited<ReturnType<typeof MediaLibrary.getAlbumsAsync>>[number];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const CACHE_FILE = "trimswipe-native-photo-cache-v1.json";
const CACHE_LIMIT = 700;
const DAY_MS = 24 * 60 * 60 * 1000;

let memoryCache: PhotoMetadataCache | null | undefined;

function cacheUri(): string | null {
  return FileSystem.documentDirectory ? `${FileSystem.documentDirectory}${CACHE_FILE}` : null;
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

function duplicateKey(asset: MediaLibrary.Asset): string {
  return `${Math.round(asset.creationTime / 3000)}:${asset.width}x${asset.height}`;
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
    memoryCache = {
      version: 1,
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : 0,
      photos: Array.isArray(parsed.photos) ? parsed.photos.filter(isNativePhoto) : [],
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
  const summaries = assets.map((asset) => {
    const measuredSizeMB = assetSizeMB(asset);
    const sizeMB = estimatedAssetSizeMB(asset);
    const key = duplicateKey(asset);
    const summary = {
      id: asset.id,
      key,
      sizeMB,
      measured: measuredSizeMB > 0,
      mistake: assetLooksLikeMistake(asset),
      screenshot: assetLooksLikeScreenshot(asset),
    };
    groups.set(key, [...(groups.get(key) ?? []), { id: asset.id, sizeMB }]);
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

  const totalSizeMB = summaries.reduce((sum, item) => sum + item.sizeMB, 0);
  const trimSavingsMB = summaries.reduce(
    (sum, item) => sum + estimateTrimSavings({ sizeMB: item.sizeMB, hasGPS: false }),
    0,
  );
  const mistakeDeleteSavingsMB = summaries
    .filter((item) => item.mistake && !duplicateRemovalIds.has(item.id))
    .reduce((sum, item) => sum + item.sizeMB, 0);
  const deleteSavingsMB = duplicateDeleteSavingsMB + mistakeDeleteSavingsMB;

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
    scannedAt: new Date().toISOString(),
  };
}

function chooseAssets(
  assets: MediaLibrary.Asset[],
  count: number,
  settings: NativeSettings,
  duplicateLookup: Set<string>,
): MediaLibrary.Asset[] {
  const targeted = assets.filter((asset) => matchesAssetSettings(asset, settings, duplicateLookup));
  const pool = settings.targetMode === "balanced" ? assets : targeted.length > 0 ? targeted : assets;

  return shuffle(pool)
    .sort((a, b) => scoreAsset(b, settings) - scoreAsset(a, settings))
    .slice(0, count);
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
  if (combined.length >= count || settings.targetMode === "balanced") return combined.slice(0, count);

  const usedIds = new Set(combined.map((photo) => photo.id));
  const fallback = shuffle(cache.photos.filter((photo) => !usedIds.has(photo.id) && !avoidIds.has(photo.id))).slice(
    0,
    count - combined.length,
  );
  const next = [...combined, ...fallback].slice(0, count);
  if (next.length > 0) return next;

  return shuffle(cache.photos.filter((photo) => matchesPhotoSettings(photo, settings))).slice(0, count);
}

export async function deletePhotos(ids: string[]): Promise<{ deleted: number }> {
  if (ids.length === 0) return { deleted: 0 };

  try {
    await MediaLibrary.deleteAssetsAsync(ids);
    await removeCacheIds(ids);
    return { deleted: ids.length };
  } catch (error) {
    console.log("[NativePhotoSource] Delete failed", { error });
    return { deleted: 0 };
  }
}

export async function trimPhoto(
  photo: NativePhoto,
  quality: number,
): Promise<{ trimmed: boolean; newAssetId?: string; savedMB?: number; error?: string }> {
  const sourceUri = photo.localUri || photo.uri;
  if (!sourceUri || sourceUri.startsWith("ph://")) {
    return { trimmed: false, error: "Photo is not downloaded locally" };
  }

  try {
    const imageManipulator = await import("expo-image-manipulator");
    const manipulateAsync = imageManipulator.manipulateAsync;
    const saveFormat = imageManipulator.SaveFormat.JPEG;
    const result = await manipulateAsync(sourceUri, [], {
      compress: quality,
      format: saveFormat,
    });
    const fileInfo = await FileSystem.getInfoAsync(result.uri);
    const trimmedBytes = (fileInfo as FileSystem.FileInfo & { size?: number }).size ?? 0;
    const originalBytes = Math.max(0, photo.sizeMB * 1024 * 1024);

    if (!fileInfo.exists || trimmedBytes <= 0 || (originalBytes > 0 && trimmedBytes >= originalBytes)) {
      await FileSystem.deleteAsync(result.uri, { idempotent: true }).catch(() => undefined);
      return { trimmed: false, error: "Trim did not produce a smaller image" };
    }

    const created = await MediaLibrary.createAssetAsync(result.uri);
    await MediaLibrary.deleteAssetsAsync([photo.id]);
    await removeCacheIds([photo.id]);
    await FileSystem.deleteAsync(result.uri, { idempotent: true }).catch(() => undefined);

    return {
      trimmed: true,
      newAssetId: created.id,
      savedMB: +((originalBytes - trimmedBytes) / (1024 * 1024)).toFixed(2),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log("[NativePhotoSource] Trim failed", { id: photo.id, error: message });
    return { trimmed: false, error: message };
  }
}

export function estimateTrimSavings(photo: Pick<NativePhoto, "sizeMB" | "hasGPS">): number {
  const metadataSavings = photo.hasGPS ? 0.18 : 0.08;
  const compressionSavings = photo.sizeMB * 0.28;
  return +Math.max(
    metadataSavings,
    Math.min(photo.sizeMB * 0.45, metadataSavings + compressionSavings),
  ).toFixed(2);
}
