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

export async function handleBridgeMessage(request: BridgeRequest): Promise<BridgeResponse> {
  const { id, method, data } = request;

  try {
    let result: unknown;

    switch (method) {
      case "requestPermission":
        result = await requestPermission();
        break;
      case "getPhotos":
        result = await getPhotos(numberFromData(data.count, 10));
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

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
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

function diversifyAssets(assets: MediaLibrary.Asset[], count: number): MediaLibrary.Asset[] {
  const targetCount = Math.max(1, count);
  const duplicateLookup = buildDuplicateLookup(assets);
  const now = Date.now();
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
    if (ageYears >= 5) buckets.Old.push(asset);
    if (sizeMB >= 4) buckets.Large.push(asset);
    if (duplicateLookup.has(duplicateKey(asset))) buckets["Duplicate/Similar"].push(asset);
    if (filename.includes("blur")) buckets.Blurry.push(asset);
    if (filename.includes("dark") || filename.includes("night")) buckets.Dark.push(asset);
    if (!asset.filename) buckets["No context"].push(asset);
    if (aspectRatio > 2.2 || sizeMB < 0.35 || filename.includes("pocket"))
      buckets["Mistake?"].push(asset);
    if (ageYears < 5 && sizeMB < 4) buckets.Recent.push(asset);
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

function mimeTypeForAsset(asset: MediaLibrary.Asset): string {
  const name = asset.filename?.toLowerCase() || asset.uri.toLowerCase();
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".heic") || name.endsWith(".heif")) return "image/heic";
  if (name.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

async function readableAssetUri(
  asset: MediaLibrary.Asset,
  localUri?: string | null,
): Promise<string> {
  const sourceUri = localUri || asset.uri;
  if (!sourceUri || sourceUri.startsWith("data:")) return sourceUri;

  try {
    const base64 = await FileSystem.readAsStringAsync(sourceUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return `data:${mimeTypeForAsset(asset)};base64,${base64}`;
  } catch (err: unknown) {
    console.log("[Bridge] Could not inline photo for WebView preview", {
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
  const previewUri = await readableAssetUri(asset, localUri);

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

async function getPhotos(count: number): Promise<PhotoDTO[]> {
  const targetCount = Math.max(1, count);
  const result = await MediaLibrary.getAssetsAsync({
    mediaType: "photo",
    first: Math.min(250, Math.max(targetCount * 4, targetCount)),
    sortBy: [[MediaLibrary.SortBy.creationTime, true]],
  });

  if (result.assets.length === 0) return [];

  const selected = diversifyAssets(result.assets, targetCount);
  const duplicateLookup = buildDuplicateLookup(result.assets);
  console.log("[Bridge] getPhotos selected diversified assets", {
    requested: targetCount,
    fetched: result.assets.length,
    returned: selected.length,
    firstAssetId: selected[0]?.id,
  });

  return Promise.all(selected.map((asset) => assetToDTO(asset, duplicateLookup)));
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
  return Promise.all(selected.map((asset) => assetToDTO(asset, duplicateLookup)));
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
    topGroups.map((group) => Promise.all(group.map((asset) => assetToDTO(asset, duplicateLookup)))),
  );
}

async function deletePhotos(ids: string[]): Promise<{ deleted: number }> {
  if (ids.length === 0) return { deleted: 0 };

  try {
    await MediaLibrary.deleteAssetsAsync(ids);
    console.log("[Bridge] deletePhotos completed", { requested: ids.length });
    return { deleted: ids.length };
  } catch (error) {
    console.log("[Bridge] deletePhotos failed", { error });
    return { deleted: 0 };
  }
}
