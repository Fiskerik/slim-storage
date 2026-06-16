// Trim Token store — local AsyncStorage-like persistence via expo-file-system.
// 1 token = 1 photo trimmed. Lifetime Pro users skip token spending entirely.

import * as FileSystem from "expo-file-system/legacy";

const TOKENS_FILE = "trimswipe-tokens-v1.json";
const STARTING_TOKENS = 25; // first-install allowance

type TokenState = {
  tokens: number;
  totalEarned: number;
  totalSpent: number;
  lifetimeAdRewards: number;
  updatedAt: string;
};

const DEFAULT_STATE: TokenState = {
  tokens: STARTING_TOKENS,
  totalEarned: STARTING_TOKENS,
  totalSpent: 0,
  lifetimeAdRewards: 0,
  updatedAt: new Date().toISOString(),
};

function uri(): string | null {
  return FileSystem.documentDirectory
    ? `${FileSystem.documentDirectory}${TOKENS_FILE}`
    : null;
}

let cache: TokenState | null = null;
let loadPromise: Promise<TokenState> | null = null;
const listeners = new Set<(state: TokenState) => void>();

function emit(state: TokenState) {
  cache = state;
  listeners.forEach((cb) => {
    try {
      cb(state);
    } catch (err) {
      console.log("[tokens] listener error", err);
    }
  });
}

async function readFromDisk(): Promise<TokenState> {
  const path = uri();
  if (!path) return { ...DEFAULT_STATE };
  try {
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) return { ...DEFAULT_STATE };
    const raw = await FileSystem.readAsStringAsync(path);
    const parsed = JSON.parse(raw) as Partial<TokenState>;
    return {
      tokens: Math.max(0, Number(parsed.tokens ?? DEFAULT_STATE.tokens)),
      totalEarned: Math.max(0, Number(parsed.totalEarned ?? 0)),
      totalSpent: Math.max(0, Number(parsed.totalSpent ?? 0)),
      lifetimeAdRewards: Math.max(0, Number(parsed.lifetimeAdRewards ?? 0)),
      updatedAt: String(parsed.updatedAt ?? new Date().toISOString()),
    };
  } catch (err) {
    console.log("[tokens] load failed", err);
    return { ...DEFAULT_STATE };
  }
}

async function persist(state: TokenState): Promise<void> {
  const path = uri();
  if (!path) return;
  try {
    await FileSystem.writeAsStringAsync(path, JSON.stringify(state));
  } catch (err) {
    console.log("[tokens] save failed", err);
  }
}

export async function loadTokens(): Promise<TokenState> {
  if (cache) return cache;
  if (!loadPromise) loadPromise = readFromDisk().then((s) => (cache = s));
  return loadPromise;
}

export function getTokensSync(): number {
  return cache?.tokens ?? STARTING_TOKENS;
}

export async function addTokens(amount: number, source: "purchase" | "ad" | "grant" = "grant"): Promise<TokenState> {
  if (!Number.isFinite(amount) || amount <= 0) return loadTokens();
  const current = await loadTokens();
  const next: TokenState = {
    ...current,
    tokens: current.tokens + amount,
    totalEarned: current.totalEarned + amount,
    lifetimeAdRewards: current.lifetimeAdRewards + (source === "ad" ? amount : 0),
    updatedAt: new Date().toISOString(),
  };
  emit(next);
  await persist(next);
  return next;
}

export async function spendTokens(amount = 1): Promise<{ ok: boolean; tokens: number }> {
  const current = await loadTokens();
  if (current.tokens < amount) return { ok: false, tokens: current.tokens };
  const next: TokenState = {
    ...current,
    tokens: current.tokens - amount,
    totalSpent: current.totalSpent + amount,
    updatedAt: new Date().toISOString(),
  };
  emit(next);
  await persist(next);
  return { ok: true, tokens: next.tokens };
}

export function subscribeTokens(cb: (state: TokenState) => void): () => void {
  listeners.add(cb);
  if (cache) cb(cache);
  else void loadTokens().then((s) => cb(s));
  return () => listeners.delete(cb);
}

export const TOKEN_PACKS: Record<string, number> = {
  tokens_50: 50,
  tokens_100: 100,
  tokens_200: 200,
  tokens_500: 500,
};

export const REWARDED_AD_TOKENS = 5;
export const DAILY_CLAIM_TOKENS = 10;

export type { TokenState };
