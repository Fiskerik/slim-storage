export const MIDSET_MIN_HOLD_SECONDS = 5;
export const MIDSET_MAX_HOLD_SECONDS = 10;

export function midsetHoldSeconds(randomValue = Math.random()): number {
  const normalized = Math.min(0.999999, Math.max(0, randomValue));
  return MIDSET_MIN_HOLD_SECONDS + Math.floor(
    normalized * (MIDSET_MAX_HOLD_SECONDS - MIDSET_MIN_HOLD_SECONDS + 1),
  );
}

export function hasReachedMidset(initialCount: number, remainingCount: number): boolean {
  if (initialCount < 2) return false;
  const reviewedCount = Math.max(0, initialCount - remainingCount);
  return reviewedCount >= Math.ceil(initialCount / 2);
}

export function shouldPresentMidsetAd({
  initialCount,
  remainingCount,
  isPro,
  dismissed,
  loaded,
  hasCurrentPhoto,
}: {
  initialCount: number;
  remainingCount: number;
  isPro: boolean;
  dismissed: boolean;
  loaded: boolean;
  hasCurrentPhoto: boolean;
}): boolean {
  if (isPro || dismissed || !loaded || !hasCurrentPhoto || initialCount < 2) return false;
  return hasReachedMidset(initialCount, remainingCount);
}
