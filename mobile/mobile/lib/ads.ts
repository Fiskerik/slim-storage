// AdMob rewarded ads. Gracefully no-ops on web / Expo Go (no native module).
// On real device builds, loads + shows a rewarded ad and credits Trim Tokens.

import { Platform } from "react-native";
import { addTokens, REWARDED_AD_TOKENS } from "./tokens";
import { checkProStatus } from "./purchases";

type RewardedAdModule = {
  RewardedAd: any;
  TestIds: { REWARDED: string };
  AdEventType: Record<string, string>;
  RewardedAdEventType: Record<string, string>;
  default?: { initialize: () => Promise<unknown> };
};

let mod: RewardedAdModule | null = null;
let modTried = false;
let initialized = false;

function envValue(key: string): string | undefined {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  return env?.[key];
}

const IS_DEV = envValue("NODE_ENV") !== "production";

function loadModule(): RewardedAdModule | null {
  if (modTried) return mod;
  modTried = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    mod = require("react-native-google-mobile-ads") as RewardedAdModule;
  } catch (err) {
    console.log("[ads] native module unavailable", err);
    mod = null;
  }
  return mod;
}

function rewardedUnitId(): string | null {
  const m = loadModule();
  if (!m) return null;
  if (IS_DEV) return m.TestIds.REWARDED;
  if (Platform.OS === "ios") return envValue("EXPO_PUBLIC_ADMOB_IOS_REWARDED_ID") ?? null;
  if (Platform.OS === "android") return envValue("EXPO_PUBLIC_ADMOB_ANDROID_REWARDED_ID") ?? null;
  return null;
}

export function adsAvailable(): boolean {
  return loadModule() !== null && rewardedUnitId() !== null;
}

export async function initAds(): Promise<boolean> {
  const m = loadModule();
  if (!m) return false;
  if (initialized) return true;
  try {
    const init = (m as any).default?.initialize ?? (m as any).initialize;
    if (typeof init === "function") await init();
    initialized = true;
    return true;
  } catch (err) {
    console.log("[ads] init failed", err);
    return false;
  }
}

/**
 * Show a rewarded ad. Returns the number of tokens credited (0 if dismissed / error).
 * Skips entirely when user has Lifetime Pro.
 */
export async function showRewardedAd(): Promise<number> {
  try {
    const isPro = await checkProStatus().catch(() => false);
    if (isPro) {
      // Pro = unlimited; credit some tokens anyway as goodwill, no ad shown.
      await addTokens(REWARDED_AD_TOKENS, "ad");
      return REWARDED_AD_TOKENS;
    }
  } catch {
    // ignore — fall through to show ad
  }

  const m = loadModule();
  const unitId = rewardedUnitId();
  if (!m || !unitId) {
    console.log("[ads] no ad available, granting fallback tokens in dev only");
    if (IS_DEV) {
      await addTokens(REWARDED_AD_TOKENS, "ad");
      return REWARDED_AD_TOKENS;
    }
    return 0;
  }

  await initAds();

  return new Promise<number>((resolve) => {
    try {
      const ad = m.RewardedAd.createForAdRequest(unitId, {
        requestNonPersonalizedAdsOnly: false,
      });

      let earned = false;
      let settled = false;
      const settle = (value: number) => {
        if (settled) return;
        settled = true;
        try { unsubLoad?.(); } catch {}
        try { unsubEarn?.(); } catch {}
        try { unsubClose?.(); } catch {}
        try { unsubErr?.(); } catch {}
        resolve(value);
      };

      const unsubLoad = ad.addAdEventListener(m.RewardedAdEventType.LOADED, () => {
        try { ad.show(); } catch (err) { console.log("[ads] show error", err); settle(0); }
      });
      const unsubEarn = ad.addAdEventListener(m.RewardedAdEventType.EARNED_REWARD, () => {
        earned = true;
      });
      const unsubClose = ad.addAdEventListener(m.AdEventType.CLOSED, async () => {
        if (earned) {
          await addTokens(REWARDED_AD_TOKENS, "ad");
          settle(REWARDED_AD_TOKENS);
        } else settle(0);
      });
      const unsubErr = ad.addAdEventListener(m.AdEventType.ERROR, (err: unknown) => {
        console.log("[ads] ad error", err);
        settle(0);
      });

      ad.load();

      // Safety timeout
      setTimeout(() => settle(earned ? REWARDED_AD_TOKENS : 0), 45000);
    } catch (err) {
      console.log("[ads] showRewardedAd exception", err);
      resolve(0);
    }
  });
}
