// AdMob rewarded ads. Gracefully no-ops on web / Expo Go (no native module).
// On real device builds, loads + shows a rewarded ad and credits Trim Tokens.

import { Platform } from "react-native";
import { addTokens, REWARDED_AD_TOKENS } from "./tokens";
import { checkProStatus } from "./purchases";

type RewardedAdModule = {
  RewardedAd: any;
  InterstitialAd?: any;
  TestIds: { REWARDED: string; INTERSTITIAL?: string };
  AdEventType: Record<string, string>;
  RewardedAdEventType: Record<string, string>;
  default?: { initialize: () => Promise<unknown> };
};

let mod: RewardedAdModule | null = null;
let modTried = false;
let initialized = false;

const IS_DEV = process.env.NODE_ENV !== "production";
const USE_TEST_ADS =
  process.env.EXPO_PUBLIC_ADMOB_USE_TEST_ADS === "true" ||
  process.env.EXPO_PUBLIC_IRONSRC_USE_TEST_ADS === "true";
const ADMOB_IOS_REWARDED_ID =
  process.env.EXPO_PUBLIC_IRONSRC_IOS_REWARDED_ID ??
  process.env.EXPO_PUBLIC_ADMOB_IOS_REWARDED_ID;
const ADMOB_ANDROID_REWARDED_ID = process.env.EXPO_PUBLIC_ADMOB_ANDROID_REWARDED_ID;
const ADMOB_IOS_INTERSTITIAL_ID =
  process.env.EXPO_PUBLIC_IRONSRC_IOS_INTERSTITIAL_ID ??
  process.env.EXPO_PUBLIC_ADMOB_IOS_INTERSTITIAL_ID;
const ADMOB_ANDROID_INTERSTITIAL_ID = process.env.EXPO_PUBLIC_ADMOB_ANDROID_INTERSTITIAL_ID;
const GOOGLE_TEST_REWARDED_IDS = {
  ios: "ca-app-pub-3940256099942544/1712485313",
  android: "ca-app-pub-3940256099942544/5224354917",
} as const;
const GOOGLE_TEST_INTERSTITIAL_IDS = {
  ios: "ca-app-pub-3940256099942544/4411468910",
  android: "ca-app-pub-3940256099942544/1033173712",
} as const;

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
  if (Platform.OS !== "ios" && Platform.OS !== "android") return null;

  const testId = m.TestIds.REWARDED ?? GOOGLE_TEST_REWARDED_IDS[Platform.OS];
  const productionId =
    Platform.OS === "ios"
      ? ADMOB_IOS_REWARDED_ID
      : ADMOB_ANDROID_REWARDED_ID;

  if (USE_TEST_ADS) return testId;
  if (productionId) return productionId;
  if (IS_DEV) return testId;
  console.log("[ads] missing rewarded ad unit id");
  return null;
}

function interstitialUnitId(): string | null {
  const m = loadModule();
  if (!m) return null;
  if (Platform.OS !== "ios" && Platform.OS !== "android") return null;

  const testId = m.TestIds.INTERSTITIAL ?? GOOGLE_TEST_INTERSTITIAL_IDS[Platform.OS];
  const productionId =
    Platform.OS === "ios"
      ? ADMOB_IOS_INTERSTITIAL_ID
      : ADMOB_ANDROID_INTERSTITIAL_ID;

  if (USE_TEST_ADS) return testId;
  if (productionId) return productionId;
  if (IS_DEV) return testId;
  console.log("[ads] missing interstitial ad unit id");
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

export async function showInterstitialAd(): Promise<boolean> {
  try {
    const isPro = await checkProStatus().catch(() => false);
    if (isPro) return false;
  } catch {
    // ignore; ad loading can still decide availability
  }

  const m = loadModule();
  const unitId = interstitialUnitId();
  if (!m?.InterstitialAd || !unitId) {
    console.log("[ads] no interstitial available");
    return false;
  }

  await initAds();

  return new Promise<boolean>((resolve) => {
    try {
      const ad = m.InterstitialAd.createForAdRequest(unitId, {
        requestNonPersonalizedAdsOnly: false,
      });

      let settled = false;
      const settle = (shown: boolean) => {
        if (settled) return;
        settled = true;
        try { unsubLoad?.(); } catch {}
        try { unsubClose?.(); } catch {}
        try { unsubErr?.(); } catch {}
        resolve(shown);
      };

      const unsubLoad = ad.addAdEventListener(m.AdEventType.LOADED, () => {
        try {
          ad.show();
        } catch (err) {
          console.log("[ads] interstitial show error", err);
          settle(false);
        }
      });
      const unsubClose = ad.addAdEventListener(m.AdEventType.CLOSED, () => settle(true));
      const unsubErr = ad.addAdEventListener(m.AdEventType.ERROR, (err: unknown) => {
        console.log("[ads] interstitial error", err);
        settle(false);
      });

      ad.load();
      setTimeout(() => settle(false), 30000);
    } catch (err) {
      console.log("[ads] showInterstitialAd exception", err);
      resolve(false);
    }
  });
}
