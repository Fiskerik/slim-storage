import * as MediaLibrary from "expo-media-library";
import * as Haptics from "expo-haptics";
import * as FileSystem from "expo-file-system/legacy";
import { Linking } from "react-native";
import { handlePurchaseMessage } from "./purchases";

type BridgeRequest = {
  id: string;
  method: string;
  data: Record<string, unknown>;
};

type BridgeResponse = {
  __bridge_response: true;
  id: string;
  result?: unknown;
  error?: string;
};

function numberFromData(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function stringArrayFromData(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function stringFromData(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function recordFromData(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function handleBridgeMessage(request: BridgeRequest): Promise<BridgeResponse> {
  const { id, method, data } = request;

  try {
    let result: unknown;

    switch (method) {
      case "requestPermission":
        result = await requestPermission();
        break;
      case "getPhotos":
        result = await getPhotos(
          numberFromData(data.count, 10),
          targetOptionsFromData(recordFromData(data.targeting)),
        );
        break;
      case "getOlderPhotos":
        result = await getOlderPhotos(
          numberFromData(data.beforeYear, 2020),
          numberFromData(data.count, 10),
        );
        break;
      case "getBurstGroups":
        result = await getBurstGroups(numberFromData(data.maxGroups, 5));
        break;
      case "deletePhotos":
        result = await deletePhotos(stringArrayFromData(data.ids));
        break;
      case "replaceAssetWithJpeg":
        result = await replaceAssetWithJpeg(
          stringFromData(data.assetId),
          stringFromData(data.jpegDataUri),
          stringFromData(data.filename, "TrimSwipe photo.jpg"),
        );
        break;
      case "openSubscriptionSettings":
        await Linking.openURL("https://apps.apple.com/account/subscriptions");
        result = { ok: true };
        break;
      case "hapticTap":
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        result = { ok: true };
        break;
      case "hapticSuccess":
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        result = { ok: true };
        break;
      case "hapticError":
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        result = { ok: true };
        break;
      default:
        // Check if it's a purchase-related method
        if (method.startsWith("purchases_")) {
          result = await handlePurchaseMessage(method, data);
          break;
        }
        return { __bridge_response: true, id, error: `Unknown method: ${method}` };
    }

    return { __bridge_response: true, id, result };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { __bridge_response: true, id, error: message };
  }
}

// ─── Permission ──────────────────────────────────

async function requestPermission(): Promise<{
  granted: boolean;
  limited: boolean;
  canAskAgain: boolean;
}> {
  const { status, accessPrivileges, canAskAgain } = await MediaLibrary.requestPermissionsAsync();
  const limited = accessPrivileges === "limited";
  return { granted: status === "granted", limited, canAskAgain };
}

// ─── Photo fetching ──────────────────────────────

type PhotoDTO = {
  id: string;
  uri: string; // base64 data URI for small thumb, or file:// URI
  thumbUri: string;
  title: string;
  year: number;
  month: string;
  device: string;
  sizeMB: number;
  hasGPS: boolean;
  isNative: true;
  nativeId: string;
  isCloudAsset: boolean;
  creationTime: number;
  cleanupReasons: string[];
};

type PhotoTargetMode = "balanced" | "big-or-old" | "old-and-large";

type PhotoTargetOptions = {
  mode: PhotoTargetMode;
  minSizeMB: number;
  minAgeYears: number;
};

type PhotoMetadataCache = {
  version: 1;
  updatedAt: number;
  photos: PhotoDTO[];
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DEFAULT_TARGET_OPTIONS: PhotoTargetOptions = {
  mode: "balanced",
  minSizeMB: 8,
  minAgeYears: 4,
};
const PHOTO_METADATA_CACHE_FILE = "slim-photo-metadata-cache-v1.json";
const PHOTO_METADATA_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const PHOTO_METADATA_CACHE_LIMIT = 600;
const BACKGROUND_CACHE_HYDRATE_LIMIT = 48;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function targetOptionsFromData(data: Record<string, unknown>): PhotoTargetOptions {
  const rawMode = stringFromData(data.mode, DEFAULT_TARGET_OPTIONS.mode);
  const mode: PhotoTargetMode =
    rawMode === "big-or-old" || rawMode === "old-and-large" ? rawMode : "balanced";

  return {
    mode,
    minSizeMB: Math.min(50, Math.max(1, numberFromData(data.minSizeMB, 8))),
    minAgeYears: Math.min(30, Math.max(1, numberFromData(data.minAgeYears, 4))),
  };
}

function hasExifFlag(info: MediaLibrary.AssetInfo, keys: string[]): boolean {
  const exif = (info.exif ?? {}) as Record<string, unknown>;
  return keys.some((key) => {
    const value = exif[key];
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value > 0;
    if (typeof value === "string") return value.length > 0 && value !== "0";
    return false;
  });
}

function classifyAsset(
  asset: MediaLibrary.Asset,
  info: MediaLibrary.AssetInfo,
  sizeMB: number,
  duplicateLookup: Set<string>,
): string[] {
  const reasons = new Set<string>();
  const ageMs = Date.now() - asset.creationTime;
  const ageYears = ageMs / (365.25 * 24 * 60 * 60 * 1000);
  const filename = asset.filename?.toLowerCase() ?? "";
  const width = asset.width || 0;
  const height = asset.height || 0;
  const aspectRatio =
    width > 0 && height > 0 ? Math.max(width, height) / Math.max(1, Math.min(width, height)) : 1;

  if (ageYears >= 5) reasons.add("Old");
  if (sizeMB >= 4) reasons.add("Large");
  if (duplicateLookup.has(duplicateKey(asset))) reasons.add("Duplicate/Similar");
  if (
    hasExifFlag(info, ["Blur", "Blurred", "MotionBlur", "SubjectArea"]) ||
    filename.includes("blur")
  ) {
    reasons.add("Blurry");
  }
  if (hasExifFlag(info, ["BrightnessValue", "ISOSpeedRatings"]) || filename.includes("dark")) {
    const exif = (info.exif ?? {}) as Record<string, unknown>;
    const brightness = Number(exif.BrightnessValue);
    const iso = Number(exif.ISOSpeedRatings);
    if (brightness < -1 || iso >= 1600 || filename.includes("dark")) reasons.add("Dark");
  }
  if (!info.location && !asset.filename && !hasExifFlag(info, ["Model", "LensModel"])) {
    reasons.add("No context");
  }
  if (
    aspectRatio > 2.2 ||
    sizeMB < 0.35 ||
    filename.includes("img_e") ||
    filename.includes("pocket")
  ) {
    reasons.add("Mistake?");
  }

  if (reasons.size === 0) reasons.add("Review");
  return [...reasons].slice(0, 3);
}

function duplicateKey(asset: MediaLibrary.Asset): string {
  const roundedTime = Math.round(asset.creationTime / 3000);
  return `${roundedTime}:${asset.width}x${asset.height}`;
}

function buildDuplicateLookup(assets: MediaLibrary.Asset[]): Set<string> {
  const counts = new Map<string, number>();
  assets.forEach((asset) => {
    const key = duplicateKey(asset);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([key]) => key));
}

function assetMatchesTargetOptions(asset: MediaLibrary.Asset, options: PhotoTargetOptions): boolean {
  if (options.mode === "balanced") return true;

  const isLarge = assetSortSizeMB(asset) >= options.minSizeMB;
  const isOld = photoAgeYears(asset.creationTime) >= options.minAgeYears;
  return options.mode === "old-and-large" ? isLarge && isOld : isLarge || isOld;
}

function targetScoreForAsset(asset: MediaLibrary.Asset, options: PhotoTargetOptions): number {
  return targetScoreForPhoto(
    { creationTime: asset.creationTime, sizeMB: assetSortSizeMB(asset) },
    options,
  );
}

function diversifyAssets(
  assets: MediaLibrary.Asset[],
  count: number,
  options = DEFAULT_TARGET_OPTIONS,
): MediaLibrary.Asset[] {
  const targetCount = Math.max(1, count);
  const duplicateLookup = buildDuplicateLookup(assets);
  const now = Date.now();
  const largeThreshold = options.mode === "balanced" ? 4 : options.minSizeMB;
  const oldThreshold = options.mode === "balanced" ? 5 : options.minAgeYears;
  const buckets: Record<string, MediaLibrary.Asset[]> = {
    Old: [],
    Large: [],
    "Duplicate/Similar": [],
    Blurry: [],
    Dark: [],
    "No context": [],
    "Mistake?": [],
    Recent: [],
  };

  assets.forEach((asset) => {
    const sizeMB = assetSortSizeMB(asset);
    const ageYears = (now - asset.creationTime) / (365.25 * 24 * 60 * 60 * 1000);
    const filename = asset.filename?.toLowerCase() ?? "";
    const aspectRatio =
      asset.width && asset.height
        ? Math.max(asset.width, asset.height) / Math.max(1, Math.min(asset.width, asset.height))
        : 1;
    if (ageYears >= oldThreshold) buckets.Old.push(asset);
    if (sizeMB >= largeThreshold) buckets.Large.push(asset);
    if (duplicateLookup.has(duplicateKey(asset))) buckets["Duplicate/Similar"].push(asset);
    if (filename.includes("blur")) buckets.Blurry.push(asset);
    if (filename.includes("dark") || filename.includes("night")) buckets.Dark.push(asset);
    if (!asset.filename) buckets["No context"].push(asset);
    if (aspectRatio > 2.2 || sizeMB < 0.35 || filename.includes("pocket"))
      buckets["Mistake?"].push(asset);
    if (ageYears < oldThreshold && sizeMB < largeThreshold) buckets.Recent.push(asset);
  });

  Object.keys(buckets).forEach((key) => {
    buckets[key] = shuffle(buckets[key]);
  });

  const selected: MediaLibrary.Asset[] = [];
  const used = new Set<string>();
  const bucketOrder = shuffle(Object.keys(buckets));
  while (selected.length < targetCount && bucketOrder.some((key) => buckets[key].length > 0)) {
    for (const key of bucketOrder) {
      const asset = buckets[key].shift();
      if (!asset || used.has(asset.id)) continue;
      selected.push(asset);
      used.add(asset.id);
      if (selected.length >= targetCount) break;
    }
  }

  if (selected.length < targetCount) {
    shuffle(assets).forEach((asset) => {
      if (selected.length < targetCount && !used.has(asset.id)) selected.push(asset);
    });
  }

  return selected;
}

const WEB_ROOT_DIR = "www";
const PHOTO_CACHE_DIR = "photo-cache";
let photoMetadataCacheMemory: PhotoMetadataCache | null | undefined;

function emptyPhotoMetadataCache(): PhotoMetadataCache {
  return { version: 1, updatedAt: 0, photos: [] };
}

function metadataCacheUri(): string | null {
  const documentDirectory = FileSystem.documentDirectory;
  return documentDirectory ? `${documentDirectory}${PHOTO_METADATA_CACHE_FILE}` : null;
}

function isPhotoDTO(value: unknown): value is PhotoDTO {
  const item = recordFromData(value);
  return (
    typeof item.id === "string" &&
    typeof item.uri === "string" &&
    typeof item.thumbUri === "string" &&
    typeof item.title === "string" &&
    typeof item.nativeId === "string" &&
    typeof item.creationTime === "number"
  );
}

function normalizeCachedPhotos(photos: unknown): PhotoDTO[] {
  if (!Array.isArray(photos)) return [];
  const byId = new Map<string, PhotoDTO>();

  photos.filter(isPhotoDTO).forEach((photo) => {
    byId.set(photo.nativeId || photo.id, {
      ...photo,
      isNative: true,
      nativeId: photo.nativeId || photo.id,
      cleanupReasons: Array.isArray(photo.cleanupReasons) ? photo.cleanupReasons : ["Review"],
    });
  });

  return [...byId.values()];
}

async function readPhotoMetadataCache(): Promise<PhotoMetadataCache> {
  if (photoMetadataCacheMemory !== undefined) return photoMetadataCacheMemory;

  const uri = metadataCacheUri();
  if (!uri) {
    photoMetadataCacheMemory = emptyPhotoMetadataCache();
    return photoMetadataCacheMemory;
  }

  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) {
      photoMetadataCacheMemory = emptyPhotoMetadataCache();
      return photoMetadataCacheMemory;
    }

    const raw = await FileSystem.readAsStringAsync(uri);
    const parsed = JSON.parse(raw) as Partial<PhotoMetadataCache>;
    photoMetadataCacheMemory = {
      version: 1,
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : 0,
      photos: normalizeCachedPhotos(parsed.photos),
    };
  } catch (error) {
    console.log("[Bridge] Could not read photo metadata cache", { error });
    photoMetadataCacheMemory = emptyPhotoMetadataCache();
  }

  return photoMetadataCacheMemory;
}

async function writePhotoMetadataCache(cache: PhotoMetadataCache): Promise<void> {
  const uri = metadataCacheUri();
  if (!uri) return;

  const retained = normalizeCachedPhotos(cache.photos)
    .map((photo) => ({
      photo,
      score: targetScoreForPhoto(photo, { mode: "big-or-old", minSizeMB: 4, minAgeYears: 3 }),
    }))
    .sort((a, b) => {
      const scoreDiff = b.score - a.score;
      if (Math.abs(scoreDiff) > 0.01) return scoreDiff;
      return b.photo.creationTime - a.photo.creationTime;
    })
    .slice(0, PHOTO_METADATA_CACHE_LIMIT)
    .map(({ photo }) => photo);

  photoMetadataCacheMemory = { version: 1, updatedAt: Date.now(), photos: retained };

  try {
    await FileSystem.writeAsStringAsync(uri, JSON.stringify(photoMetadataCacheMemory));
  } catch (error) {
    console.log("[Bridge] Could not write photo metadata cache", { error });
  }
}

async function upsertCachedPhotos(photos: PhotoDTO[]): Promise<void> {
  if (photos.length === 0) return;

  const cache = await readPhotoMetadataCache();
  const byId = new Map(cache.photos.map((photo) => [photo.nativeId || photo.id, photo]));
  photos.forEach((photo) => {
    byId.set(photo.nativeId || photo.id, photo);
  });
  await writePhotoMetadataCache({ version: 1, updatedAt: cache.updatedAt, photos: [...byId.values()] });
}

async function removeCachedPhotoIds(ids: string[]): Promise<void> {
  if (ids.length === 0) return;

  const idSet = new Set(ids);
  const cache = await readPhotoMetadataCache();
  await writePhotoMetadataCache({
    version: 1,
    updatedAt: cache.updatedAt,
    photos: cache.photos.filter((photo) => !idSet.has(photo.nativeId || photo.id)),
  });
}

function publicCacheUriToFileUri(uri: string): string | null {
  const documentDirectory = FileSystem.documentDirectory;
  if (!documentDirectory || !uri.startsWith(`/${PHOTO_CACHE_DIR}/`)) return null;
  return `${documentDirectory}${WEB_ROOT_DIR}${uri}`;
}

async function cachedPhotoHasPreview(photo: PhotoDTO): Promise<boolean> {
  const previewFileUri = publicCacheUriToFileUri(photo.uri);
  if (!previewFileUri) return true;

  try {
    const info = await FileSystem.getInfoAsync(previewFileUri);
    return info.exists;
  } catch {
    return false;
  }
}

function photoAgeYears(creationTime: number): number {
  return (Date.now() - creationTime) / (365.25 * 24 * 60 * 60 * 1000);
}

function photoMatchesTargetOptions(photo: Pick<PhotoDTO, "creationTime" | "sizeMB">, options: PhotoTargetOptions): boolean {
  if (options.mode === "balanced") return true;

  const isLarge = photo.sizeMB >= options.minSizeMB;
  const isOld = photoAgeYears(photo.creationTime) >= options.minAgeYears;
  return options.mode === "old-and-large" ? isLarge && isOld : isLarge || isOld;
}

function targetScoreForPhoto(photo: Pick<PhotoDTO, "creationTime" | "sizeMB">, options: PhotoTargetOptions): number {
  const age = Math.max(0, photoAgeYears(photo.creationTime));
  const sizeRatio = options.minSizeMB > 0 ? photo.sizeMB / options.minSizeMB : 0;
  const ageRatio = options.minAgeYears > 0 ? age / options.minAgeYears : 0;
  const isLarge = photo.sizeMB >= options.minSizeMB;
  const isOld = age >= options.minAgeYears;

  return (
    Math.min(sizeRatio, 4) +
    Math.min(ageRatio, 4) +
    (isLarge ? 2 : 0) +
    (isOld ? 2 : 0) +
    (isLarge && isOld ? 3 : 0)
  );
}

async function getCachedTargetedPhotos(
  count: number,
  options: PhotoTargetOptions,
  excludedIds = new Set<string>(),
): Promise<PhotoDTO[]> {
  const cache = await readPhotoMetadataCache();
  if (cache.photos.length === 0) return [];

  const cacheAgeMs = Date.now() - cache.updatedAt;
  const candidates = cache.photos.filter((photo) => !excludedIds.has(photo.nativeId || photo.id));
  const targeted = candidates.filter((photo) => photoMatchesTargetOptions(photo, options));
  const pool = options.mode === "balanced" ? candidates : targeted;
  const ranked = shuffle(pool)
    .map((photo) => ({
      photo,
      score: targetScoreForPhoto(photo, options) + Math.random() * 0.35,
    }))
    .sort((a, b) => b.score - a.score)
    .map(({ photo }) => photo);

  const selected: PhotoDTO[] = [];
  const seen = new Set<string>();

  for (const photo of ranked) {
    if (selected.length >= count) break;
    const photoId = photo.nativeId || photo.id;
    if (seen.has(photoId)) continue;
    seen.add(photoId);
    if (await cachedPhotoHasPreview(photo)) selected.push(photo);
  }

  console.log("[Bridge] metadata cache candidates", {
    requested: count,
    cacheSize: cache.photos.length,
    cacheAgeHours: +(cacheAgeMs / (60 * 60 * 1000)).toFixed(1),
    cacheFresh: cacheAgeMs <= PHOTO_METADATA_CACHE_TTL_MS,
    targeted: targeted.length,
    returned: selected.length,
    mode: options.mode,
  });

  return selected;
}

function mergePhotoDTOs(photos: PhotoDTO[]): PhotoDTO[] {
  const byId = new Map<string, PhotoDTO>();
  photos.forEach((photo) => byId.set(photo.nativeId || photo.id, photo));
  return [...byId.values()];
}

function warmMetadataCacheFromAssets(
  assets: MediaLibrary.Asset[],
  duplicateLookup: Set<string>,
  skipIds: Set<string>,
) {
  void (async () => {
    try {
      const cache = await readPhotoMetadataCache();
      const cachedIds = new Set(cache.photos.map((photo) => photo.nativeId || photo.id));
      const toHydrate = assets
        .filter((asset) => !skipIds.has(asset.id) && !cachedIds.has(asset.id))
        .slice(0, BACKGROUND_CACHE_HYDRATE_LIMIT);

      if (toHydrate.length === 0) return;

      const hydrated = await mapWithConcurrency(toHydrate, 2, (asset) =>
        assetToDTO(asset, duplicateLookup),
      );
      await upsertCachedPhotos(hydrated);
      console.log("[Bridge] warmed photo metadata cache", {
        hydrated: hydrated.length,
        cacheSize: (await readPhotoMetadataCache()).photos.length,
      });
    } catch (error) {
      console.log("[Bridge] metadata cache warm failed", { error });
    }
  })();
}

function extensionForAsset(asset: MediaLibrary.Asset): string {
  const name = asset.filename?.toLowerCase() || asset.uri.toLowerCase();
  if (name.endsWith(".png")) return "png";
  if (name.endsWith(".heic")) return "heic";
  if (name.endsWith(".heif")) return "heif";
  if (name.endsWith(".webp")) return "webp";
  return "jpg";
}

function cacheKeyForAsset(asset: MediaLibrary.Asset): string {
  const stableKey = [
    asset.id,
    asset.creationTime,
    asset.modificationTime,
    asset.width,
    asset.height,
  ]
    .filter((part) => part !== undefined && part !== null)
    .join("-");
  return stableKey.replace(/[^a-zA-Z0-9._-]/g, "_");
}

async function ensurePhotoCacheDirectory(): Promise<string | null> {
  const documentDirectory = FileSystem.documentDirectory;
  if (!documentDirectory) return null;

  const cacheDirectory = `${documentDirectory}${WEB_ROOT_DIR}/${PHOTO_CACHE_DIR}`;
  const info = await FileSystem.getInfoAsync(cacheDirectory);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(cacheDirectory, { intermediates: true });
  }
  return cacheDirectory;
}

async function cachedAssetUrl(
  asset: MediaLibrary.Asset,
  localUri?: string | null,
): Promise<string> {
  const sourceUri = localUri || asset.uri;
  if (!sourceUri || sourceUri.startsWith("data:")) return sourceUri;

  const cacheDirectory = await ensurePhotoCacheDirectory();
  if (!cacheDirectory || sourceUri.startsWith("ph://")) return sourceUri;

  const filename = `${cacheKeyForAsset(asset)}.${extensionForAsset(asset)}`;
  const cachedUri = `${cacheDirectory}/${filename}`;
  const publicUrl = `/${PHOTO_CACHE_DIR}/${filename}`;

  try {
    const cachedInfo = await FileSystem.getInfoAsync(cachedUri);
    if (!cachedInfo.exists) {
      await FileSystem.copyAsync({ from: sourceUri, to: cachedUri });
      const copiedInfo = await FileSystem.getInfoAsync(cachedUri);
      console.log("[Bridge] cached native photo for WebView", {
        assetId: asset.id,
        publicUrl,
        bytes: "size" in copiedInfo ? copiedInfo.size : undefined,
      });
    }
    return publicUrl;
  } catch (err: unknown) {
    console.log("[Bridge] Could not cache photo for WebView preview", {
      assetId: asset.id,
      uri: sourceUri,
      error: err instanceof Error ? err.message : String(err),
    });
    return sourceUri;
  }
}

async function resolveAssetSizeMB(
  asset: MediaLibrary.Asset,
  localUri?: string | null,
): Promise<number> {
  const assetFileSize = (asset as MediaLibrary.Asset & { fileSize?: number }).fileSize;
  if (typeof assetFileSize === "number" && assetFileSize > 0) {
    return +(assetFileSize / (1024 * 1024)).toFixed(2);
  }

  const candidateUri = localUri || asset.uri;
  if (!candidateUri || candidateUri.startsWith("ph://")) return 0;

  try {
    const info = await FileSystem.getInfoAsync(candidateUri);
    const size = (info as FileSystem.FileInfo & { size?: number }).size;
    if (info.exists && typeof size === "number" && size > 0) {
      return +(size / (1024 * 1024)).toFixed(2);
    }
  } catch (err: unknown) {
    console.log("[Bridge] Could not resolve photo file size", {
      assetId: asset.id,
      uri: candidateUri,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return 0;
}

async function assetToDTO(
  asset: MediaLibrary.Asset,
  duplicateLookup = new Set<string>(),
): Promise<PhotoDTO> {
  // Get asset info for GPS, local file URI, and more metadata.
  const info = await MediaLibrary.getAssetInfoAsync(asset);

  const creationDate = new Date(asset.creationTime);
  const localUri = info.localUri || asset.uri;
  const sizeMB = await resolveAssetSizeMB(asset, localUri);

  // Detect if asset might be iCloud-only (not locally available).
  const isCloudAsset = !localUri || localUri.startsWith("ph://") || sizeMB === 0;
  const previewUri = await cachedAssetUrl(asset, localUri);

  console.log("[Bridge] assetToDTO", {
    assetId: asset.id,
    title: asset.filename,
    year: creationDate.getFullYear(),
    sizeMB,
    isCloudAsset,
  });

  return {
    id: asset.id,
    uri: previewUri,
    thumbUri: previewUri,
    title: asset.filename || "Photo",
    year: creationDate.getFullYear(),
    month: MONTHS[creationDate.getMonth()],
    device:
      typeof (info.exif as Record<string, unknown> | undefined)?.Model === "string"
        ? ((info.exif as Record<string, unknown>).Model as string)
        : "iPhone",
    sizeMB,
    hasGPS: !!(info.location?.latitude && info.location?.longitude),
    isNative: true,
    nativeId: asset.id,
    isCloudAsset,
    creationTime: asset.creationTime,
    cleanupReasons: classifyAsset(asset, info, sizeMB, duplicateLookup),
  };
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

  const workerCount = Math.min(Math.max(1, limit), items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

function assetSortSizeMB(asset: MediaLibrary.Asset): number {
  const fileSize = (asset as MediaLibrary.Asset & { fileSize?: number }).fileSize;
  return typeof fileSize === "number" && fileSize > 0 ? fileSize / (1024 * 1024) : 0;
}

function prioritySortAssets(assets: MediaLibrary.Asset[]): MediaLibrary.Asset[] {
  return [...assets].sort((a, b) => {
    const ageDiff = a.creationTime - b.creationTime;
    if (Math.abs(ageDiff) > 1000 * 60 * 60 * 24 * 30) return ageDiff;
    return assetSortSizeMB(b) - assetSortSizeMB(a);
  });
}

function mergeAssets(assets: MediaLibrary.Asset[]): MediaLibrary.Asset[] {
  const byId = new Map<string, MediaLibrary.Asset>();
  assets.forEach((asset) => byId.set(asset.id, asset));
  return [...byId.values()];
}

async function fetchCandidateAssets(
  targetCount: number,
  options: PhotoTargetOptions,
): Promise<MediaLibrary.Asset[]> {
  const first = Math.min(250, Math.max(targetCount * 8, 80));

  if (options.mode === "balanced") {
    const result = await MediaLibrary.getAssetsAsync({
      mediaType: "photo",
      first,
      sortBy: [[MediaLibrary.SortBy.creationTime, true]],
    });
    return result.assets;
  }

  const cutoffDate = Date.now() - options.minAgeYears * 365.25 * 24 * 60 * 60 * 1000;
  const [recentResult, olderResult] = await Promise.all([
    MediaLibrary.getAssetsAsync({
      mediaType: "photo",
      first,
      sortBy: [[MediaLibrary.SortBy.creationTime, true]],
    }),
    MediaLibrary.getAssetsAsync({
      mediaType: "photo",
      first,
      createdBefore: cutoffDate,
      sortBy: [[MediaLibrary.SortBy.creationTime, true]],
    }),
  ]);

  return mergeAssets([...recentResult.assets, ...olderResult.assets]);
}

function selectAssetsForRound(
  assets: MediaLibrary.Asset[],
  count: number,
  options: PhotoTargetOptions,
): MediaLibrary.Asset[] {
  if (assets.length === 0 || count <= 0) return [];

  const targeted = assets.filter((asset) => assetMatchesTargetOptions(asset, options));
  const fallback = assets.filter((asset) => !targeted.includes(asset));
  const pool = options.mode === "balanced" ? assets : [...targeted, ...fallback];
  const ranked = shuffle(pool).sort((a, b) => targetScoreForAsset(b, options) - targetScoreForAsset(a, options));

  return diversifyAssets(ranked, count, options);
}

async function getPhotos(
  count: number,
  options = DEFAULT_TARGET_OPTIONS,
): Promise<PhotoDTO[]> {
  const targetCount = Math.max(1, count);
  const cached = await getCachedTargetedPhotos(targetCount, options);
  const cachedIds = new Set(cached.map((photo) => photo.nativeId || photo.id));

  if (cached.length >= targetCount) {
    console.log("[Bridge] getPhotos served from metadata cache", {
      requested: targetCount,
      returned: cached.length,
      mode: options.mode,
    });
    return cached.slice(0, targetCount);
  }

  const assets = await fetchCandidateAssets(targetCount, options);
  if (assets.length === 0) return cached;

  const remainingCount = targetCount - cached.length;
  const freshAssets = assets.filter((asset) => !cachedIds.has(asset.id));
  const selected = selectAssetsForRound(freshAssets, remainingCount, options);
  const duplicateLookup = buildDuplicateLookup(assets);
  console.log("[Bridge] getPhotos selected diversified assets", {
    requested: targetCount,
    cached: cached.length,
    fetched: assets.length,
    returned: selected.length,
    firstAssetId: selected[0]?.id,
    mode: options.mode,
    minSizeMB: options.minSizeMB,
    minAgeYears: options.minAgeYears,
  });

  const fresh = await mapWithConcurrency(selected, 3, (asset) => assetToDTO(asset, duplicateLookup));
  const skipWarmIds = new Set([...cachedIds, ...fresh.map((photo) => photo.nativeId || photo.id)]);
  await upsertCachedPhotos(fresh);
  warmMetadataCacheFromAssets(assets, duplicateLookup, skipWarmIds);

  const combined = mergePhotoDTOs([...cached, ...fresh]);
  if (combined.length >= targetCount || options.mode === "balanced") {
    return combined.slice(0, targetCount);
  }

  const combinedIds = new Set(combined.map((photo) => photo.nativeId || photo.id));
  const fallbackCached = await getCachedTargetedPhotos(
    targetCount - combined.length,
    DEFAULT_TARGET_OPTIONS,
    combinedIds,
  );
  return mergePhotoDTOs([...combined, ...fallbackCached]).slice(0, targetCount);
}

async function getOlderPhotos(beforeYear: number, count: number): Promise<PhotoDTO[]> {
  const cutoffDate = new Date(beforeYear, 0, 1).getTime();

  const result = await MediaLibrary.getAssetsAsync({
    mediaType: "photo",
    first: count * 2, // fetch extra to have variety
    createdBefore: cutoffDate,
    sortBy: [[MediaLibrary.SortBy.creationTime, true]], // oldest first
  });

  const selected = shuffle(prioritySortAssets(result.assets)).slice(0, count);
  const duplicateLookup = buildDuplicateLookup(result.assets);
  return mapWithConcurrency(selected, 3, (asset) => assetToDTO(asset, duplicateLookup));
}

async function getBurstGroups(maxGroups: number): Promise<PhotoDTO[][]> {
  // Fetch recent photos and group by timestamp proximity (within 3 seconds)
  const result = await MediaLibrary.getAssetsAsync({
    mediaType: "photo",
    first: 200,
    sortBy: [MediaLibrary.SortBy.creationTime],
  });

  const assets = result.assets;
  const groups: MediaLibrary.Asset[][] = [];
  let currentGroup: MediaLibrary.Asset[] = [];

  for (let i = 0; i < assets.length; i++) {
    if (currentGroup.length === 0) {
      currentGroup.push(assets[i]);
    } else {
      const timeDiff = Math.abs(
        assets[i].creationTime - currentGroup[currentGroup.length - 1].creationTime,
      );
      if (timeDiff < 3000) {
        // within 3 seconds
        currentGroup.push(assets[i]);
      } else {
        if (currentGroup.length >= 2) {
          groups.push(currentGroup);
        }
        currentGroup = [assets[i]];
      }
    }
  }
  if (currentGroup.length >= 2) {
    groups.push(currentGroup);
  }

  const topGroups = groups
    .sort((a, b) => {
      const aOldest = Math.min(...a.map((asset) => asset.creationTime));
      const bOldest = Math.min(...b.map((asset) => asset.creationTime));
      const ageDiff = aOldest - bOldest;
      if (Math.abs(ageDiff) > 1000 * 60 * 60 * 24 * 30) return ageDiff;
      const sizeDiff =
        b.reduce((sum, asset) => sum + assetSortSizeMB(asset), 0) -
        a.reduce((sum, asset) => sum + assetSortSizeMB(asset), 0);
      if (Math.abs(sizeDiff) > 0.1) return sizeDiff;
      return b.length - a.length;
    })
    .slice(0, maxGroups);

  const duplicateLookup = buildDuplicateLookup(assets);
  return Promise.all(
    topGroups.map((group) =>
      mapWithConcurrency(group, 3, (asset) => assetToDTO(asset, duplicateLookup)),
    ),
  );
}

function safeJpegFilename(filename: string): string {
  const trimmed = filename.trim() || "TrimSwipe photo.jpg";
  const withExtension = /\.jpe?g$/i.test(trimmed) ? trimmed : `${trimmed}.jpg`;
  return withExtension.replace(/[^a-zA-Z0-9._ -]/g, "_");
}

function base64FromDataUri(dataUri: string): string | null {
  const match = dataUri.match(/^data:image\/jpe?g;base64,(.+)$/i);
  return match?.[1] ?? null;
}

async function replaceAssetWithJpeg(
  assetId: string,
  jpegDataUri: string,
  filename: string,
): Promise<{ converted: boolean; newAssetId?: string }> {
  const base64 = base64FromDataUri(jpegDataUri);
  if (!assetId || !base64) return { converted: false };

  const cacheDirectory = FileSystem.cacheDirectory;
  if (!cacheDirectory) return { converted: false };

  const targetUri = `${cacheDirectory}${Date.now()}-${safeJpegFilename(filename)}`;

  try {
    await FileSystem.writeAsStringAsync(targetUri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const created = await MediaLibrary.createAssetAsync(targetUri);
    await MediaLibrary.deleteAssetsAsync([assetId]);
    await removeCachedPhotoIds([assetId]);
    await FileSystem.deleteAsync(targetUri, { idempotent: true });

    console.log("[Bridge] replaceAssetWithJpeg completed", {
      originalAssetId: assetId,
      newAssetId: created.id,
      filename,
    });

    return { converted: true, newAssetId: created.id };
  } catch (error) {
    console.log("[Bridge] replaceAssetWithJpeg failed", { assetId, filename, error });
    await FileSystem.deleteAsync(targetUri, { idempotent: true }).catch(() => undefined);
    return { converted: false };
  }
}

async function deletePhotos(ids: string[]): Promise<{ deleted: number }> {
  if (ids.length === 0) return { deleted: 0 };

  try {
    await MediaLibrary.deleteAssetsAsync(ids);
    await removeCachedPhotoIds(ids);
    console.log("[Bridge] deletePhotos completed", { requested: ids.length });
    return { deleted: ids.length };
  } catch (error) {
    console.log("[Bridge] deletePhotos failed", { error });
    return { deleted: 0 };
  }
}
