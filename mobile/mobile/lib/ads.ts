// Unity LevelPlay (ironSource) rewarded and interstitial ads.
// Gracefully no-ops on web / Expo Go where the native module is unavailable.

import { Platform } from "react-native";
import { addTokens, REWARDED_AD_TOKENS } from "./tokens";
import { checkProStatus } from "./purchases";

type LevelPlayAd = {
  setListener: (listener: Record<string, unknown>) => void;
  loadAd: () => Promise<void>;
  showAd: (placementName?: string | null) => Promise<void>;
  isAdReady: () => Promise<boolean>;
  remove?: () => Promise<void>;
};

type LevelPlayModule = {
  LevelPlay: {
    init: (request: unknown, listener: Record<string, unknown>) => Promise<void>;
    setAdaptersDebug?: (isEnabled: boolean) => Promise<void>;
    setMetaData?: (key: string, values: string[]) => Promise<void>;
  };
  LevelPlayInitRequest: {
    builder: (appKey: string) => {
      withUserId?: (userId: string) => unknown;
      build: () => unknown;
    };
  };
  LevelPlayRewardedAd: new (adUnitId: string) => LevelPlayAd;
  LevelPlayInterstitialAd: new (adUnitId: string) => LevelPlayAd;
};

let mod: LevelPlayModule | null = null;
let modTried = false;
let initialized = false;
let initPromise: Promise<boolean> | null = null;

const IS_DEV = process.env.NODE_ENV !== "production";
const ENABLE_TEST_SUITE =
  process.env.EXPO_PUBLIC_IRONSRC_ENABLE_TEST_SUITE === "true" ||
  process.env.EXPO_PUBLIC_IRONSRC_USE_TEST_SUITE === "true";
const ENABLE_ADAPTER_DEBUG =
  process.env.EXPO_PUBLIC_IRONSRC_ADAPTER_DEBUG === "true" || IS_DEV;

const IRONSRC_IOS_APP_KEY =
  process.env.EXPO_PUBLIC_IRONSRC_IOS_APP_ID ??
  process.env.EXPO_PUBLIC_IRONSRC_IOS_APP_KEY;
const IRONSRC_ANDROID_APP_KEY =
  process.env.EXPO_PUBLIC_IRONSRC_ANDROID_APP_ID ??
  process.env.EXPO_PUBLIC_IRONSRC_ANDROID_APP_KEY;
const IRONSRC_IOS_REWARDED_ID =
  process.env.EXPO_PUBLIC_IRONSRC_IOS_REWARDED_ID;
const IRONSRC_ANDROID_REWARDED_ID =
  process.env.EXPO_PUBLIC_IRONSRC_ANDROID_REWARDED_ID;
const IRONSRC_IOS_INTERSTITIAL_ID =
  process.env.EXPO_PUBLIC_IRONSRC_IOS_INTERSTITIAL_ID;
const IRONSRC_ANDROID_INTERSTITIAL_ID =
  process.env.EXPO_PUBLIC_IRONSRC_ANDROID_INTERSTITIAL_ID;

function loadModule(): LevelPlayModule | null {
  if (modTried) return mod;
  modTried = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    mod = require("unity-levelplay-mediation") as LevelPlayModule;
  } catch (err) {
    console.log("[ads] native module unavailable", err);
    mod = null;
  }
  return mod;
}

function appKey(): string | null {
  if (Platform.OS === "ios") return IRONSRC_IOS_APP_KEY ?? null;
  if (Platform.OS === "android") return IRONSRC_ANDROID_APP_KEY ?? null;
  return null;
}

function rewardedUnitId(): string | null {
  if (Platform.OS === "ios") return IRONSRC_IOS_REWARDED_ID ?? null;
  if (Platform.OS === "android") return IRONSRC_ANDROID_REWARDED_ID ?? null;
  return null;
}

function interstitialUnitId(): string | null {
  if (Platform.OS === "ios") return IRONSRC_IOS_INTERSTITIAL_ID ?? null;
  if (Platform.OS === "android") return IRONSRC_ANDROID_INTERSTITIAL_ID ?? null;
  return null;
}

export function adsAvailable(): boolean {
  return loadModule() !== null && appKey() !== null && rewardedUnitId() !== null;
}

export async function initAds(): Promise<boolean> {
  const m = loadModule();
  const key = appKey();
  if (!m || !key) return false;
  if (initialized) return true;
  if (initPromise) return initPromise;

  initPromise = new Promise<boolean>((resolve) => {
    let settled = false;
    const settle = (ok: boolean) => {
      if (settled) return;
      settled = true;
      initialized = ok;
      if (!ok) initPromise = null;
      resolve(ok);
    };

    const init = async () => {
      try {
        if (ENABLE_ADAPTER_DEBUG) {
          await m.LevelPlay.setAdaptersDebug?.(true).catch(() => {});
        }
        if (ENABLE_TEST_SUITE) {
          await m.LevelPlay.setMetaData?.("is_test_suite", ["enable"]).catch(() => {});
        }

        const request = m.LevelPlayInitRequest.builder(key).build();
        await m.LevelPlay.init(request, {
          onInitSuccess: () => settle(true),
          onInitFailed: (error: unknown) => {
            console.log("[ads] init failed", error);
            settle(false);
          },
        });
      } catch (err) {
        console.log("[ads] init exception", err);
        settle(false);
      }
    };

    void init();
    setTimeout(() => settle(false), 30000);
  });

  return initPromise;
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
    // ignore; fall through to show ad
  }

  const m = loadModule();
  const unitId = rewardedUnitId();
  if (!m || !unitId) {
    console.log("[ads] no rewarded ad available, granting fallback tokens in dev only");
    if (IS_DEV) {
      await addTokens(REWARDED_AD_TOKENS, "ad");
      return REWARDED_AD_TOKENS;
    }
    return 0;
  }

  const ok = await initAds();
  if (!ok) return 0;

  return new Promise<number>((resolve) => {
    try {
      const ad = new m.LevelPlayRewardedAd(unitId);
      let earned = false;
      let closed = false;
      let settled = false;

      const settle = (value: number) => {
        if (settled) return;
        settled = true;
        try {
          void ad.remove?.();
        } catch {}
        resolve(value);
      };

      const grantAndSettle = async () => {
        try {
          await addTokens(REWARDED_AD_TOKENS, "ad");
          settle(REWARDED_AD_TOKENS);
        } catch (err) {
          console.log("[ads] reward credit failed", err);
          settle(0);
        }
      };

      ad.setListener({
        onAdLoaded: async () => {
          try {
            const ready = await ad.isAdReady();
            if (!ready) {
              settle(0);
              return;
            }
            await ad.showAd();
          } catch (err) {
            console.log("[ads] rewarded show error", err);
            settle(0);
          }
        },
        onAdLoadFailed: (error: unknown) => {
          console.log("[ads] rewarded load failed", error);
          settle(0);
        },
        onAdDisplayed: () => {},
        onAdDisplayFailed: (error: unknown) => {
          console.log("[ads] rewarded display failed", error);
          settle(0);
        },
        onAdRewarded: () => {
          earned = true;
          if (closed) void grantAndSettle();
        },
        onAdClosed: () => {
          closed = true;
          setTimeout(() => {
            if (earned) void grantAndSettle();
            else settle(0);
          }, 1000);
        },
      });

      void ad.loadAd().catch((err: unknown) => {
        console.log("[ads] rewarded load exception", err);
        settle(0);
      });

      setTimeout(() => {
        if (earned) void grantAndSettle();
        else settle(0);
      }, 45000);
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
  if (!m || !unitId) {
    console.log("[ads] no interstitial available");
    return false;
  }

  const ok = await initAds();
  if (!ok) return false;

  return new Promise<boolean>((resolve) => {
    try {
      const ad = new m.LevelPlayInterstitialAd(unitId);
      let shown = false;
      let settled = false;

      const settle = (value: boolean) => {
        if (settled) return;
        settled = true;
        try {
          void ad.remove?.();
        } catch {}
        resolve(value);
      };

      ad.setListener({
        onAdLoaded: async () => {
          try {
            const ready = await ad.isAdReady();
            if (!ready) {
              settle(false);
              return;
            }
            await ad.showAd();
          } catch (err) {
            console.log("[ads] interstitial show error", err);
            settle(false);
          }
        },
        onAdLoadFailed: (error: unknown) => {
          console.log("[ads] interstitial load failed", error);
          settle(false);
        },
        onAdDisplayed: () => {
          shown = true;
        },
        onAdDisplayFailed: (error: unknown) => {
          console.log("[ads] interstitial display failed", error);
          settle(false);
        },
        onAdClosed: () => settle(shown),
      });

      void ad.loadAd().catch((err: unknown) => {
        console.log("[ads] interstitial load exception", err);
        settle(false);
      });

      setTimeout(() => settle(shown), 30000);
    } catch (err) {
      console.log("[ads] showInterstitialAd exception", err);
      resolve(false);
    }
  });
}
