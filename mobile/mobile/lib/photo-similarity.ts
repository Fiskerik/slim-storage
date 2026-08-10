export type SimilarityItem = {
  id: string;
  creationTime: number;
  width: number;
  height: number;
  sizeMB: number;
};

export type VerifiedSimilarityPair = {
  firstAssetId: string;
  secondAssetId: string;
  distance: number;
};

const CANDIDATE_WINDOW_MS = 90 * 1000;
const CONSERVATIVE_WINDOW_MS = 12 * 1000;

function normalizedDimensions(item: SimilarityItem): [number, number] {
  return [Math.max(item.width, item.height), Math.min(item.width, item.height)];
}

function dimensionsClose(a: SimilarityItem, b: SimilarityItem): boolean {
  const [aw, ah] = normalizedDimensions(a);
  const [bw, bh] = normalizedDimensions(b);
  if (aw <= 0 || ah <= 0 || bw <= 0 || bh <= 0) return false;
  const widthDiff = Math.abs(aw - bw) / Math.max(aw, bw);
  const heightDiff = Math.abs(ah - bh) / Math.max(ah, bh);
  const aspectA = aw / ah;
  const aspectB = bw / bh;
  return widthDiff <= 0.08 && heightDiff <= 0.08 && Math.abs(aspectA - aspectB) <= 0.06;
}

function sizesClose(a: SimilarityItem, b: SimilarityItem, maximumDifference: number): boolean {
  if (a.sizeMB <= 0 || b.sizeMB <= 0) return false;
  return Math.abs(a.sizeMB - b.sizeMB) / Math.max(a.sizeMB, b.sizeMB) <= maximumDifference;
}

function exactDimensions(a: SimilarityItem, b: SimilarityItem): boolean {
  const [aw, ah] = normalizedDimensions(a);
  const [bw, bh] = normalizedDimensions(b);
  return aw > 0 && ah > 0 && aw === bw && ah === bh;
}

function buildGroups(
  items: SimilarityItem[],
  windowMs: number,
  matches: (anchor: SimilarityItem, candidate: SimilarityItem) => boolean,
): SimilarityItem[][] {
  const sorted = [...items].sort((a, b) => b.creationTime - a.creationTime);
  const used = new Set<string>();
  const groups: SimilarityItem[][] = [];

  for (let index = 0; index < sorted.length; index += 1) {
    const anchor = sorted[index];
    if (used.has(anchor.id)) continue;
    const group = [anchor];

    for (let candidateIndex = index + 1; candidateIndex < sorted.length; candidateIndex += 1) {
      const candidate = sorted[candidateIndex];
      const gapMs = Math.abs(anchor.creationTime - candidate.creationTime);
      if (gapMs > windowMs) break;
      if (!used.has(candidate.id) && matches(anchor, candidate)) group.push(candidate);
    }

    if (group.length >= 2) {
      group.forEach((item) => used.add(item.id));
      groups.push(group);
    }
  }

  return groups;
}

/**
 * Produces a broad, inexpensive candidate set. These groups are never safe to
 * present as visually similar until `clusterVerifiedSimilarityPairs` confirms them.
 */
export function buildSimilarityCandidateGroups(items: SimilarityItem[]): SimilarityItem[][] {
  return buildGroups(
    items,
    CANDIDATE_WINDOW_MS,
    (anchor, candidate) =>
      Math.abs(anchor.creationTime - candidate.creationTime) <= CANDIDATE_WINDOW_MS &&
      dimensionsClose(anchor, candidate) &&
      sizesClose(anchor, candidate, 0.35),
  );
}

/**
 * Last-resort grouping for builds without the native Vision module. This is
 * intentionally strict and should always be described as a capture sequence,
 * not as a verified duplicate group.
 */
export function buildConservativeCaptureGroups(items: SimilarityItem[]): SimilarityItem[][] {
  return buildGroups(
    items,
    CONSERVATIVE_WINDOW_MS,
    (anchor, candidate) =>
      Math.abs(anchor.creationTime - candidate.creationTime) <= CONSERVATIVE_WINDOW_MS &&
      exactDimensions(anchor, candidate) &&
      sizesClose(anchor, candidate, 0.12),
  );
}

function pairKey(firstId: string, secondId: string): string {
  return firstId < secondId ? `${firstId}\u0000${secondId}` : `${secondId}\u0000${firstId}`;
}

/**
 * Uses complete-link clustering: every photo added to a group must have a
 * Vision-confirmed edge to every existing member. This prevents transitive
 * A≈B≈C chains from incorrectly implying that A≈C.
 */
export function clusterVerifiedSimilarityPairs(
  candidateGroups: SimilarityItem[][],
  pairs: VerifiedSimilarityPair[],
): SimilarityItem[][] {
  const pairDistances = new Map<string, number>();
  pairs.forEach((pair) => {
    if (!Number.isFinite(pair.distance)) return;
    const key = pairKey(pair.firstAssetId, pair.secondAssetId);
    const current = pairDistances.get(key);
    if (current == null || pair.distance < current) pairDistances.set(key, pair.distance);
  });

  const verifiedGroups: SimilarityItem[][] = [];
  candidateGroups.forEach((candidateGroup) => {
    const sorted = [...candidateGroup].sort((a, b) => b.creationTime - a.creationTime);
    const used = new Set<string>();

    sorted.forEach((anchor) => {
      if (used.has(anchor.id)) return;
      const neighbors = sorted
        .filter((candidate) => candidate.id !== anchor.id && !used.has(candidate.id))
        .filter((candidate) => pairDistances.has(pairKey(anchor.id, candidate.id)))
        .sort(
          (a, b) =>
            (pairDistances.get(pairKey(anchor.id, a.id)) ?? Number.POSITIVE_INFINITY) -
            (pairDistances.get(pairKey(anchor.id, b.id)) ?? Number.POSITIVE_INFINITY),
        );
      const group = [anchor];

      neighbors.forEach((candidate) => {
        const connectsToEveryMember = group.every((member) =>
          pairDistances.has(pairKey(member.id, candidate.id)),
        );
        if (connectsToEveryMember) group.push(candidate);
      });

      if (group.length >= 2) {
        group.forEach((item) => used.add(item.id));
        verifiedGroups.push(group);
      }
    });
  });

  return verifiedGroups;
}

export function selectSimilarityRemovals(groups: SimilarityItem[][]): {
  groupedIds: Set<string>;
  removalIds: Set<string>;
  savingsMB: number;
} {
  const groupedIds = new Set<string>();
  const removalIds = new Set<string>();
  let savingsMB = 0;

  groups.forEach((group) => {
    group.forEach((item) => groupedIds.add(item.id));
    const removable = [...group].sort((a, b) => b.sizeMB - a.sizeMB).slice(1);
    removable.forEach((item) => {
      removalIds.add(item.id);
      savingsMB += item.sizeMB;
    });
  });

  return { groupedIds, removalIds, savingsMB };
}
