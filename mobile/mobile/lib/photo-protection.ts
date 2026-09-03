import * as FileSystem from "expo-file-system/legacy";
import { normalizePhotoProtectionStore, protectedPhotoIds, setPhotoProtection, type PhotoProtectionStore } from "./photo-protection-policy";

export { normalizePhotoProtectionStore, protectedPhotoIds, setPhotoProtection } from "./photo-protection-policy";
export type { PhotoProtectionRecord, PhotoProtectionStore } from "./photo-protection-policy";

const STORE_FILE = "trimswipe-photo-protection-v1.json";

function storeUri(): string | null {
  return FileSystem.documentDirectory ? `${FileSystem.documentDirectory}${STORE_FILE}` : null;
}

export async function loadPhotoProtectionStore(): Promise<PhotoProtectionStore> {
  const uri = storeUri();
  if (!uri) return normalizePhotoProtectionStore(null);
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) return normalizePhotoProtectionStore(null);
    return normalizePhotoProtectionStore(JSON.parse(await FileSystem.readAsStringAsync(uri)));
  } catch (error) {
    console.log("[PhotoProtection] Could not load protection store", { error });
    return normalizePhotoProtectionStore(null);
  }
}

export async function savePhotoProtectionStore(store: PhotoProtectionStore): Promise<void> {
  const uri = storeUri();
  if (!uri) return;
  try {
    await FileSystem.writeAsStringAsync(uri, JSON.stringify({ ...store, version: 1, updatedAt: new Date().toISOString() }));
  } catch (error) {
    console.log("[PhotoProtection] Could not save protection store", { error });
  }
}

export function isPhotoProtected(store: PhotoProtectionStore, assetId: string): boolean {
  return protectedPhotoIds(store).has(assetId);
}
