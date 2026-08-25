const META_PLACEMENT_ID_PATTERN = /^\d+_\d+$/;

/** Meta placement IDs contain the numeric property ID and placement ID. */
export function normalizeMetaMrecPlacementId(value: string | undefined): string | null {
  const placementId = value?.trim();
  if (!placementId || !META_PLACEMENT_ID_PATTERN.test(placementId)) return null;
  return placementId;
}

export function resolveMetaMrecPlacementId(...values: (string | undefined)[]): string | null {
  for (const value of values) {
    const placementId = normalizeMetaMrecPlacementId(value);
    if (placementId) return placementId;
  }
  return null;
}

export const META_IOS_MREC_PLACEMENT_ID = resolveMetaMrecPlacementId(
  process.env.EXPO_PUBLIC_META_IOS_MREC_PLACEMENT_ID,
  process.env.EXPO_PUBLIC_META_IOS_NATIVE_PLACEMENT_ID,
);
