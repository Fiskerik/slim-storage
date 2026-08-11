// AdMob rewarded ads. Gracefully no-ops on web / Expo Go (no native module).
// On real device builds, loads + shows a rewarded ad and credits Trim Tokens.

import type { ComponentType, ReactElement } from "react";
import { Platform, type ViewProps } from "react-native";
import { addTokens, REWARDED_AD_TOKENS } from "./tokens";
import { checkProStatus } from "./purchases";

export type SwipeMidsetNativeAd = {
  responseId: string;
  advertiser: string | null;
  body: string;
  callToAction: string;
  headline: string;
  icon: { url: string; scale: number } | null;
  mediaContent: { aspectRatio: number; hasVideoContent: boolean; duration: number } | null;
  destroy: () => void;
};

export type SwipeMidsetNativeRenderer = {
  NativeAdView: ComponentType<ViewProps & { nativeAd: SwipeMidsetNativeAd }>;
  NativeMediaView: ComponentType<ViewProps & { resizeMode?: "cover" | "contain" | "stretch" }>;
  NativeAsset: ComponentType<{ assetType: string; children: ReactElement }>;
  NativeAssetType: {
    ADVERTISER: string;
    BODY: string;
    CALL_TO_ACTION: string;
    HEADLINE: string;
    ICON: string;
  };
};

export type LoadedSwipeMidsetNativeAd = {
  ad: SwipeMidsetNativeAd;
  renderer: SwipeMidsetNativeRenderer;
};

type GoogleMobileAdsModule = {
  RewardedAd: any;
  InterstitialAd?: any;
  NativeAd?: {
    createForAdRequest: (
      adUnitId: string,
      options?: { requestNonPersonalizedAdsOnly?: boolean; startVideoMuted?: boolean },
    ) => Promise<SwipeMidsetNativeAd>;
  };
  NativeAdView?: SwipeMidsetNativeRenderer["NativeAdView"];
  NativeMediaView?: SwipeMidsetNativeRenderer["NativeMediaView"];
  NativeAsset?: SwipeMidsetNativeRenderer["NativeAsset"];
  NativeAssetType?: SwipeMidsetNativeRenderer["NativeAssetType"];
  TestIds: { REWARDED: string; INTERSTITIAL?: string; NATIVE?: string };
  AdEventType: Record<string, string>;
  RewardedAdEventType: Record<string, string>;
  AdsConsent?: {
    gatherConsent: (options?: { tagForUnderAgeOfConsent?: boolean }) => Promise<{ canRequestAds: boolean }>;
    showPrivacyOptionsForm: () => Promise<{ canRequestAds: boolean }>;
  };
  MobileAds?: () => GoogleMobileAdsClient;
  default?: () => GoogleMobileAdsClient;
};

type GoogleMobileAdsClient = {
  initialize: () => Promise<Record<string, unknown>>;
  openAdInspector: () => Promise<void>;
};

let mod: GoogleMobileAdsModule | null = null;
let modTried = false;
let initialized = false;
let initializationPromise: Promise<boolean> | null = null;

const IS_DEV = process.env.NODE_ENV !== "production";
const USE_TEST_ADS = process.env.EXPO_PUBLIC_ADMOB_USE_TEST_ADS === "true";
const ADMOB_IOS_REWARDED_ID = process.env.EXPO_PUBLIC_ADMOB_IOS_REWARDED_ID;
const ADMOB_ANDROID_REWARDED_ID = process.env.EXPO_PUBLIC_ADMOB_ANDROID_REWARDED_ID;
const ADMOB_IOS_INTERSTITIAL_ID = process.env.EXPO_PUBLIC_ADMOB_IOS_INTERSTITIAL_ID;
const ADMOB_ANDROID_INTERSTITIAL_ID = process.env.EXPO_PUBLIC_ADMOB_ANDROID_INTERSTITIAL_ID;
const ADMOB_IOS_NATIVE_MIDSET_ID = process.env.EXPO_PUBLIC_IOS_NATIVE_MIDSET_ID;
const ADMOB_ANDROID_NATIVE_MIDSET_ID = process.env.EXPO_PUBLIC_ANDROID_NATIVE_MIDSET_ID;
const ADMOB_AD_UNIT_ID_PATTERN = /^ca-app-pub-\d+\/\d+$/;
const GOOGLE_TEST_REWARDED_IDS = {
  ios: "ca-app-pub-3940256099942544/1712485313",
  android: "ca-app-pub-3940256099942544/5224354917",
} as const;
const GOOGLE_TEST_INTERSTITIAL_IDS = {
  ios: "ca-app-pub-3940256099942544/4411468910",
  android: "ca-app-pub-3940256099942544/1033173712",
} as const;
const GOOGLE_TEST_NATIVE_IDS = {
  ios: "ca-app-pub-3940256099942544/3986624511",
  android: "ca-app-pub-3940256099942544/2247696110",
} as const;

function loadModule(): GoogleMobileAdsModule | null {
  if (modTried) return mod;
  modTried = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    mod = require("react-native-google-mobile-ads") as GoogleMobileAdsModule;
  } catch (err) {
    console.log("[ads] native module unavailable", err);
    mod = null;
  }
  return mod;
}

function validProductionUnitId(value: string | undefined, name: string): string | null {
  if (!value) return null;
  if (ADMOB_AD_UNIT_ID_PATTERN.test(value)) return value;
  console.log(`[ads] ignoring invalid ${name}; expected an AdMob ad unit id like ca-app-pub-.../...`);
  return null;
}

function rewardedUnitId(): string | null {
  const m = loadModule();
  if (!m) return null;
  if (Platform.OS !== "ios" && Platform.OS !== "android") return null;

  const testId = m.TestIds.REWARDED ?? GOOGLE_TEST_REWARDED_IDS[Platform.OS];
  const productionId =
    Platform.OS === "ios"
      ? validProductionUnitId(ADMOB_IOS_REWARDED_ID, "EXPO_PUBLIC_ADMOB_IOS_REWARDED_ID")
      : validProductionUnitId(ADMOB_ANDROID_REWARDED_ID, "EXPO_PUBLIC_ADMOB_ANDROID_REWARDED_ID");

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
      ? validProductionUnitId(ADMOB_IOS_INTERSTITIAL_ID, "EXPO_PUBLIC_ADMOB_IOS_INTERSTITIAL_ID")
      : validProductionUnitId(ADMOB_ANDROID_INTERSTITIAL_ID, "EXPO_PUBLIC_ADMOB_ANDROID_INTERSTITIAL_ID");

  if (USE_TEST_ADS) return testId;
  if (productionId) return productionId;
  if (IS_DEV) return testId;
  console.log("[ads] missing interstitial ad unit id");
  return null;
}

function mobileAdsClient(m: GoogleMobileAdsModule): GoogleMobileAdsClient | null {
  const factory = m.default ?? m.MobileAds;
  if (typeof factory !== "function") return null;
  return factory();
}

function nativeMidsetUnitId(): string | null {
  const m = loadModule();
  if (!m) return null;
  if (Platform.OS !== "ios" && Platform.OS !== "android") return null;

  const testId = m.TestIds.NATIVE ?? GOOGLE_TEST_NATIVE_IDS[Platform.OS];
  const productionId =
    Platform.OS === "ios"
      ? validProductionUnitId(ADMOB_IOS_NATIVE_MIDSET_ID, "EXPO_PUBLIC_IOS_NATIVE_MIDSET_ID")
      : validProductionUnitId(
          ADMOB_ANDROID_NATIVE_MIDSET_ID,
          "EXPO_PUBLIC_ANDROID_NATIVE_MIDSET_ID",
        );

  if (USE_TEST_ADS) return testId;
  if (productionId) return productionId;
  if (IS_DEV) return testId;
  console.log("[ads] missing native mid-set ad unit id");
  return null;
}

function nativeRenderer(m: GoogleMobileAdsModule): SwipeMidsetNativeRenderer | null {
  if (!m.NativeAdView || !m.NativeMediaView || !m.NativeAsset || !m.NativeAssetType) return null;
  return {
    NativeAdView: m.NativeAdView,
    NativeMediaView: m.NativeMediaView,
    NativeAsset: m.NativeAsset,
    NativeAssetType: m.NativeAssetType,
  };
}

export function adsAvailable(): boolean {
  return loadModule() !== null && rewardedUnitId() !== null;
}

export async function initAds(): Promise<boolean> {
  const m = loadModule();
  if (!m) return false;
  if (initialized) return true;
  if (initializationPromise) return initializationPromise;

  initializationPromise = (async () => {
    try {
      const client = mobileAdsClient(m);
      if (!client) return false;

      const consentInfo = await m.AdsConsent?.gatherConsent({ tagForUnderAgeOfConsent: false });
      if (consentInfo && !consentInfo.canRequestAds) {
        console.log("[ads] consent does not currently allow ad requests");
        return false;
      }

      const adapterStatuses = await client.initialize();
      if (IS_DEV) console.log("[ads] adapter initialization status", adapterStatuses);
      initialized = true;
      return true;
    } catch (err) {
      console.log("[ads] init failed", err);
      return false;
    } finally {
      initializationPromise = null;
    }
  })();

  return initializationPromise;
}

export async function openAdInspector(): Promise<boolean> {
  const m = loadModule();
  const client = m ? mobileAdsClient(m) : null;
  if (!client || !(await initAds())) return false;

  try {
    await client.openAdInspector();
    return true;
  } catch (err) {
    console.log("[ads] could not open Ad Inspector", err);
    return false;
  }
}

export async function openAdsPrivacyOptions(): Promise<boolean> {
  const consent = loadModule()?.AdsConsent;
  if (!consent) return false;

  try {
    await consent.showPrivacyOptionsForm();
    return true;
  } catch (err) {
    console.log("[ads] privacy options form unavailable", err);
    return false;
  }
}

/**
 * Preload the in-deck native ad. Missing modules, IDs, Pro access, and load
 * failures all return null so a photo round is never blocked by advertising.
 */
export async function loadSwipeMidsetNativeAd(
  options: { freeUserVerified?: boolean } = {},
): Promise<LoadedSwipeMidsetNativeAd | null> {
  try {
    if (!options.freeUserVerified && await checkProStatus().catch(() => false)) return null;

    const m = loadModule();
    const unitId = nativeMidsetUnitId();
    const renderer = m ? nativeRenderer(m) : null;
    if (!m?.NativeAd || !unitId || !renderer) return null;
    if (!(await initAds())) return null;

    const ad = await m.NativeAd.createForAdRequest(unitId, {
      requestNonPersonalizedAdsOnly: true,
      startVideoMuted: true,
    });
    return { ad, renderer };
  } catch (err) {
    console.log("[ads] native mid-set load failed", err);
    return null;
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

  if (!(await initAds())) return 0;

  return new Promise<number>((resolve) => {
    try {
      const ad = m.RewardedAd.createForAdRequest(unitId, {
        requestNonPersonalizedAdsOnly: true,
      });

      let earned = false;
      let settled = false;
      let credited = false;
      const creditReward = async (): Promise<number> => {
        if (credited) return REWARDED_AD_TOKENS;
        credited = true;
        await addTokens(REWARDED_AD_TOKENS, "ad");
        return REWARDED_AD_TOKENS;
      };
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
          settle(await creditReward());
        } else settle(0);
      });
      const unsubErr = ad.addAdEventListener(m.AdEventType.ERROR, (err: unknown) => {
        console.log("[ads] ad error", err);
        settle(0);
      });

      ad.load();

      // Safety timeout
      setTimeout(() => {
        if (!earned) {
          settle(0);
          return;
        }
        void creditReward().then(settle).catch(() => settle(0));
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
  if (!m?.InterstitialAd || !unitId) {
    console.log("[ads] no interstitial available");
    return false;
  }

  if (!(await initAds())) return false;

  return new Promise<boolean>((resolve) => {
    try {
      const ad = m.InterstitialAd.createForAdRequest(unitId, {
        requestNonPersonalizedAdsOnly: true,
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
