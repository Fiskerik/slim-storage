import { useEffect, useRef } from "react";
import { Platform, StyleSheet, View } from "react-native";
import {
  bannerAdUnitId,
  initAds,
  levelPlayBannerAdSize,
  levelPlayBannerAdView,
  type LevelPlayBannerAdViewMethods,
} from "../lib/ads";

const BANNER_PLACEMENT = "TrimSwipeGameBanner";

export function LevelPlayBanner({ isPro }: { isPro: boolean }) {
  const BannerAdView = levelPlayBannerAdView();
  const adUnitId = bannerAdUnitId();
  const adSize = levelPlayBannerAdSize();
  const bannerRef = useRef<LevelPlayBannerAdViewMethods | null>(null);
  const loadRequested = useRef(false);

  useEffect(() => {
    loadRequested.current = false;
    return () => {
      try {
        void bannerRef.current?.destroy();
      } catch {
        // The native view may already have been removed during navigation.
      }
      bannerRef.current = null;
    };
  }, [BannerAdView, adUnitId]);

  if (Platform.OS !== "ios" || isPro || !BannerAdView || !adUnitId) return null;

  function loadBanner() {
    if (loadRequested.current) return;
    loadRequested.current = true;
    void initAds().then((initialized) => {
      if (initialized) void bannerRef.current?.loadAd();
    });
  }

  return (
    <View style={[styles.container, { height: adSize.height }]}>
      <BannerAdView
        ref={bannerRef}
        adUnitId={adUnitId}
        adSize={adSize}
        placementName={BANNER_PLACEMENT}
        listener={{
          onAdLoaded: () => {},
          onAdLoadFailed: (error: unknown) => console.log("[ads] banner load failed", error),
          onAdDisplayFailed: (error: unknown) => console.log("[ads] banner display failed", error),
        }}
        onLayout={loadBanner}
        style={{ width: adSize.width, height: adSize.height, alignSelf: "center" }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginTop: 12,
  },
});
