export type PhotoProtectionRecord = {
  assetId: string;
  protectedAt: string;
  reason?: "protected" | "decide-later";
};

export type PhotoProtectionStore = {
  version: 1;
  updatedAt: string;
  records: Record<string, PhotoProtectionRecord>;
};

const emptyStore = (): PhotoProtectionStore => ({ version: 1, updatedAt: new Date().toISOString(), records: {} });

function validDate(value: unknown): string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : new Date().toISOString();
}

function validId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function normalizePhotoProtectionStore(value: unknown): PhotoProtectionStore {
  if (!value || typeof value !== "object") return emptyStore();
  const raw = value as Partial<PhotoProtectionStore>;
  const source = raw.records && typeof raw.records === "object" && !Array.isArray(raw.records) ? raw.records : {};
  const records = Object.fromEntries(
    Object.entries(source)
      .filter(([assetId, record]) => validId(assetId) && record && typeof record === "object")
      .map(([assetId, record]) => {
        const item = record as Partial<PhotoProtectionRecord>;
        return [assetId, { assetId, protectedAt: validDate(item.protectedAt), reason: item.reason === "decide-later" ? "decide-later" : "protected" } satisfies PhotoProtectionRecord] as const;
      }),
  );
  return { version: 1, updatedAt: validDate(raw.updatedAt), records };
}

export function setPhotoProtection(store: PhotoProtectionStore, assetId: string, protectedState: boolean, reason: PhotoProtectionRecord["reason"] = "protected"): PhotoProtectionStore {
  if (!validId(assetId)) return store;
  const records = { ...store.records };
  if (protectedState) records[assetId] = { assetId, protectedAt: new Date().toISOString(), reason };
  else delete records[assetId];
  return { ...store, updatedAt: new Date().toISOString(), records };
}

export function protectedPhotoIds(store: PhotoProtectionStore): Set<string> {
  return new Set(Object.keys(store.records));
}
