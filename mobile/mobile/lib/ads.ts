// Unity LevelPlay (ironSource) rewarded, interstitial, and banner ads.
// The in-swipe 300x250 placement is intentionally handled by direct Meta code.
// Web and Expo Go gracefully no-op because the native LevelPlay module is unavailable.

import type { ComponentType } from "react";
import { Platform } from "react-native";
import { addTokens, REWARDED_AD_TOKENS } from "./tokens";
import { checkProStatus } from "./purchases";

export type LevelPlayBannerAdViewMethods = {
  loadAd: () => void | Promise<void>;
  destroy: () => void | Promise<void>;
};

export type LevelPlayBannerAdSize = {
  width: number;
  height: number;
};

export type LevelPlayBannerAdViewProps = {
  ref?: unknown;
  adUnitId: string;
  adSize: LevelPlayBannerAdSize;
  placementName?: string;
  listener?: Record<string, unknown>;
  onLayout?: () => void;
  style?: Record<string, unknown>;
};

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
    builder: (appKey: string) => { build: () => unknown };
  };
  LevelPlayRewardedAd: new (adUnitId: string) => LevelPlayAd;
  LevelPlayInterstitialAd: new (adUnitId: string) => LevelPlayAd;
  LevelPlayBannerAdView?: ComponentType<LevelPlayBannerAdViewProps>;
  LevelPlayAdSize?: {
    BANNER?: LevelPlayBannerAdSize;
  };
};

const DEFAULT_IOS_APP_ID = "26d9fb51d";
const DEFAULT_IOS_REWARDED_ID = "nt81b397cbikquwn";
const DEFAULT_IOS_INTERSTITIAL_ID = "bini0fp5s7f2cuni";
const DEFAULT_IOS_BANNER_ID = "0zimioxn3plu2mxk";
const LEGACY_IOS_NATIVE_AD_UNIT_ID = "q8m51pm2jg2br5yf";
const IS_DEV = process.env.NODE_ENV !== "production";
const ENABLE_TEST_SUITE = process.env.EXPO_PUBLIC_IRONSRC_ENABLE_TEST_SUITE === "true";
const ENABLE_ADAPTER_DEBUG = process.env.EXPO_PUBLIC_IRONSRC_ADAPTER_DEBUG === "true" || IS_DEV;
const IRONSRC_IOS_APP_ID = process.env.EXPO_PUBLIC_IRONSRC_IOS_APP_ID ?? DEFAULT_IOS_APP_ID;
const IRONSRC_ANDROID_APP_ID = process.env.EXPO_PUBLIC_IRONSRC_ANDROID_APP_ID;
const IRONSRC_IOS_REWARDED_ID =
  process.env.EXPO_PUBLIC_IRONSRC_IOS_REWARDED_ID ?? DEFAULT_IOS_REWARDED_ID;
const IRONSRC_ANDROID_REWARDED_ID = process.env.EXPO_PUBLIC_IRONSRC_ANDROID_REWARDED_ID;
const IRONSRC_IOS_INTERSTITIAL_ID =
  process.env.EXPO_PUBLIC_IRONSRC_IOS_INTERSTITIAL_ID ?? DEFAULT_IOS_INTERSTITIAL_ID;
const IRONSRC_ANDROID_INTERSTITIAL_ID = process.env.EXPO_PUBLIC_IRONSRC_ANDROID_INTERSTITIAL_ID;
const IRONSRC_IOS_BANNER_ID = iosBannerAdUnitId(
  process.env.EXPO_PUBLIC_IRONSRC_IOS_BANNER_ID,
);
const IRONSRC_ANDROID_BANNER_ID = process.env.EXPO_PUBLIC_IRONSRC_ANDROID_BANNER_ID;
const DEFAULT_BANNER_AD_SIZE = { width: 320, height: 50 } as const;

let mod: LevelPlayModule | null = null;
let modTried = false;
let initialized = false;
let initPromise: Promise<boolean> | null = null;

function iosBannerAdUnitId(value: string | undefined): string {
  const adUnitId = value?.trim();
  // This Native ad-unit ID was previously placed in the Banner environment variable.
  if (!adUnitId || adUnitId === LEGACY_IOS_NATIVE_AD_UNIT_ID) return DEFAULT_IOS_BANNER_ID;
  return adUnitId;
}

function loadModule(): LevelPlayModule | null {
  if (modTried) return mod;
  modTried = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    mod = require("unity-levelplay-mediation") as LevelPlayModule;
  } catch (err) {
    console.log("[ads] native LevelPlay module unavailable", err);
    mod = null;
  }
  return mod;
}

function appId(): string | null {
  if (Platform.OS === "ios") return IRONSRC_IOS_APP_ID;
  if (Platform.OS === "android") return IRONSRC_ANDROID_APP_ID ?? null;
  return null;
}

function rewardedUnitId(): string | null {
  if (Platform.OS === "ios") return IRONSRC_IOS_REWARDED_ID;
  if (Platform.OS === "android") return IRONSRC_ANDROID_REWARDED_ID ?? null;
  return null;
}

function interstitialUnitId(): string | null {
  if (Platform.OS === "ios") return IRONSRC_IOS_INTERSTITIAL_ID;
  if (Platform.OS === "android") return IRONSRC_ANDROID_INTERSTITIAL_ID ?? null;
  return null;
}

export function bannerAdUnitId(): string | null {
  if (Platform.OS === "ios") return IRONSRC_IOS_BANNER_ID ?? null;
  if (Platform.OS === "android") return IRONSRC_ANDROID_BANNER_ID ?? null;
  return null;
}

export function levelPlayBannerAdView(): ComponentType<LevelPlayBannerAdViewProps> | null {
  return loadModule()?.LevelPlayBannerAdView ?? null;
}

export function levelPlayBannerAdSize(): LevelPlayBannerAdSize {
  return loadModule()?.LevelPlayAdSize?.BANNER ?? DEFAULT_BANNER_AD_SIZE;
}

export function adsAvailable(): boolean {
  return loadModule() !== null && appId() !== null && rewardedUnitId() !== null;
}

export async function initAds(): Promise<boolean> {
  const m = loadModule();
  const key = appId();
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

    void (async () => {
      try {
        if (ENABLE_ADAPTER_DEBUG) {
          try { await m.LevelPlay.setAdaptersDebug?.(true); } catch {}
        }
        if (ENABLE_TEST_SUITE) {
          try { await m.LevelPlay.setMetaData?.("is_test_suite", ["enable"]); } catch {}
        }

        const request = m.LevelPlayInitRequest.builder(key).build();
        await m.LevelPlay.init(request, {
          onInitSuccess: () => settle(true),
          onInitFailed: (error: unknown) => {
            console.log("[ads] LevelPlay init failed", error);
            settle(false);
          },
        });
      } catch (err) {
        console.log("[ads] LevelPlay init exception", err);
        settle(false);
      }
    })();

    setTimeout(() => settle(false), 30000);
  });

  return initPromise;
}

/** LevelPlay has no equivalent of the Google ad inspector in this integration. */
export async function openAdInspector(): Promise<boolean> {
  return false;
}

/** Privacy is handled by the LevelPlay SDK and the app's consent flow. */
export async function openAdsPrivacyOptions(): Promise<boolean> {
  return false;
}

export async function showRewardedAd(): Promise<number> {
  try {
    if (await checkProStatus().catch(() => false)) {
      await addTokens(REWARDED_AD_TOKENS, "ad");
      return REWARDED_AD_TOKENS;
    }
  } catch {
    // Fall through to the ad request.
  }

  const m = loadModule();
  const unitId = rewardedUnitId();
  if (!m || !unitId) {
    console.log("[ads] no rewarded LevelPlay ad available");
    if (IS_DEV) {
      await addTokens(REWARDED_AD_TOKENS, "ad");
      return REWARDED_AD_TOKENS;
    }
    return 0;
  }
  if (!(await initAds())) return 0;

  return new Promise<number>((resolve) => {
    try {
      const ad = new m.LevelPlayRewardedAd(unitId);
      let earned = false;
      let closed = false;
      let settled = false;
      const settle = (value: number) => {
        if (settled) return;
        settled = true;
        try { void ad.remove?.(); } catch {}
        resolve(value);
      };
      const grant = async () => {
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
            if (!(await ad.isAdReady())) return settle(0);
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
        onAdDisplayFailed: (error: unknown) => {
          console.log("[ads] rewarded display failed", error);
          settle(0);
        },
        onAdRewarded: () => {
          earned = true;
          if (closed) void grant();
        },
        onAdClosed: () => {
          closed = true;
          setTimeout(() => (earned ? void grant() : settle(0)), 1000);
        },
      });

      void ad.loadAd().catch((err: unknown) => {
        console.log("[ads] rewarded load exception", err);
        settle(0);
      });
      setTimeout(() => (earned ? void grant() : settle(0)), 45000);
    } catch (err) {
      console.log("[ads] showRewardedAd exception", err);
      resolve(0);
    }
  });
}

export async function showInterstitialAd(): Promise<boolean> {
  if (await checkProStatus().catch(() => false)) return false;

  const m = loadModule();
  const unitId = interstitialUnitId();
  if (!m || !unitId) {
    console.log("[ads] no interstitial LevelPlay ad available");
    return false;
  }
  if (!(await initAds())) return false;

  return new Promise<boolean>((resolve) => {
    try {
      const ad = new m.LevelPlayInterstitialAd(unitId);
      let shown = false;
      let settled = false;
      const settle = (value: boolean) => {
        if (settled) return;
        settled = true;
        try { void ad.remove?.(); } catch {}
        resolve(value);
      };

      ad.setListener({
        onAdLoaded: async () => {
          try {
            if (!(await ad.isAdReady())) return settle(false);
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
        onAdDisplayed: () => { shown = true; },
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
