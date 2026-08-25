import { requireNativeViewManager } from "expo-modules-core";
import { useEffect, useRef, type ComponentType } from "react";
import {
  Platform,
  View,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";

export type MetaMrecLoadError = {
  code: number;
  domain: string;
  message: string;
};

type NativeMetaMrecEvent = NativeSyntheticEvent<Record<string, never>>;
type NativeMetaMrecFailureEvent = NativeSyntheticEvent<MetaMrecLoadError>;

type NativeMetaMrecAdViewProps = {
  placementId: string;
  onAdLoaded?: (event: NativeMetaMrecEvent) => void;
  onAdFailed?: (event: NativeMetaMrecFailureEvent) => void;
  onAdClicked?: (event: NativeMetaMrecEvent) => void;
  onAdImpression?: (event: NativeMetaMrecEvent) => void;
  style?: StyleProp<ViewStyle>;
};

let NativeMetaMrecAdView: ComponentType<NativeMetaMrecAdViewProps> | null = null;
if (Platform.OS === "ios") {
  try {
    NativeMetaMrecAdView = requireNativeViewManager<NativeMetaMrecAdViewProps>("ExpoMetaMrec");
  } catch (error) {
    console.log("[ads] direct Meta MREC native view unavailable", error);
  }
}

export function MetaMrecAdView({
  placementId,
  onAdLoaded,
  onAdFailed,
  style,
}: {
  placementId: string;
  onAdLoaded: () => void;
  onAdFailed: (error: MetaMrecLoadError) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const unavailableReported = useRef(false);

  useEffect(() => {
    if (NativeMetaMrecAdView || unavailableReported.current) return;
    unavailableReported.current = true;
    onAdFailed({
      code: -1,
      domain: "ExpoMetaMrec",
      message: "The direct Meta MREC native view is unavailable in this build.",
    });
  }, [onAdFailed]);

  if (!NativeMetaMrecAdView) return <View style={style} />;

  return (
    <NativeMetaMrecAdView
      placementId={placementId}
      onAdLoaded={() => onAdLoaded()}
      onAdFailed={(event) => onAdFailed(event.nativeEvent)}
      onAdClicked={() => console.log("[ads] direct Meta MREC clicked")}
      onAdImpression={() => console.log("[ads] direct Meta MREC impression")}
      style={style}
    />
  );
}
