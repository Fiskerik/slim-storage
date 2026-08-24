import type { ExpoConfig } from "expo/config";

const DEFAULT_IRONSOURCE_IOS_APP_ID = "26d9fb51d";
const SUPPORTED_LOCALES = [
  "en", "zh-Hans", "zh-Hant", "es", "hi", "ar", "pt-BR", "fr", "de", "ja", "ko", "ru", "id", "tr",
  "it", "vi", "cs", "nl", "fi", "ms", "no", "pl", "sv", "th", "uk", "da", "ta",
];

const config: ExpoConfig = {
  name: "TrimSwipe",
  slug: "slim-storage",
  version: "1.1.5",
  icon: "./assets/images/icon.png",
  orientation: "portrait",
  scheme: "trimswipe",
  userInterfaceStyle: "automatic",
  ios: {
    bundleIdentifier: "com.fiskerik.trimswipe",
    buildNumber: "72",
    supportsTablet: true,
    infoPlist: {
      CFBundleAllowMixedLocalizations: true,
      CFBundleLocalizations: SUPPORTED_LOCALES,
      NSPhotoLibraryUsageDescription:
        "TrimSwipe needs access to your photo library so you can swipe through your photos and free up storage.",
      NSPhotoLibraryAddUsageDescription:
        "TrimSwipe may save optimized versions of your photos.",
      ITSAppUsesNonExemptEncryption: false,
      SKAdNetworkItems: [
        {
          SKAdNetworkIdentifier: "su67r6k2v3.skadnetwork",
        },
      ],
      UIBackgroundModes: ["processing"],
      BGTaskSchedulerPermittedIdentifiers: ["trimswipe-cleanup-maintenance"],
    },
  },
  android: {
    package: "com.fiskerik.trimswipe",
    versionCode: 5,
    permissions: [
      "android.permission.READ_EXTERNAL_STORAGE",
      "android.permission.WRITE_EXTERNAL_STORAGE",
      "android.permission.READ_MEDIA_VISUAL_USER_SELECTED",
      "android.permission.ACCESS_MEDIA_LOCATION",
      "android.permission.READ_MEDIA_IMAGES",
      "android.permission.READ_MEDIA_VIDEO",
      "android.permission.READ_MEDIA_AUDIO",
      "com.google.android.gms.permission.AD_ID",
    ],
  },
  plugins: [
    "expo-router",
    [
      "expo-media-library",
      {
        photosPermission:
          "TrimSwipe needs access to your photos so you can review and clean up your camera roll.",
        savePhotosPermission: "TrimSwipe may save optimized versions of your photos.",
        isAccessMediaLocationEnabled: true,
      },
    ],
    "expo-web-browser",
    [
      "expo-localization",
      {
        supportsRTL: true,
        supportedLocales: {
          ios: SUPPORTED_LOCALES,
          android: SUPPORTED_LOCALES,
        },
      },
    ],
    "./plugins/withLocalizedPermissions.js",
    "expo-notifications",
    "expo-background-task",
    "./plugins/withLevelPlay",
  ],
  extra: {
    ironsource: {
      iosAppId: process.env.EXPO_PUBLIC_IRONSRC_IOS_APP_ID ?? DEFAULT_IRONSOURCE_IOS_APP_ID,
    },
    eas: {
      projectId: "ddf5633b-2fa9-4f34-b960-fbc01e8b5729",
    },
    router: {},
  },
  owner: "fiskerik89",
};

export default config;
