import type { ExpoConfig } from "expo/config";

const DEFAULT_ADMOB_IOS_APP_ID = "ca-app-pub-8854735603167656~1027546750";
const DEFAULT_ADMOB_ANDROID_APP_ID = "ca-app-pub-3940256099942544~3347511713";
const ADMOB_APP_ID_PATTERN = /^ca-app-pub-\d+~\d+$/;

function adMobAppId(value: string | undefined, fallback: string, name: string): string {
  if (!value) return fallback;
  if (ADMOB_APP_ID_PATTERN.test(value)) return value;
  console.warn(`[ads] Ignoring invalid ${name}; expected an AdMob app id like ca-app-pub-...~...`);
  return fallback;
}

const config: ExpoConfig = {
  name: "Trimswipe",
  slug: "slim-storage",
  version: "1.1.2",
  icon: "./assets/images/icon.png",
  orientation: "portrait",
  scheme: "trimswipe",
  userInterfaceStyle: "automatic",
  ios: {
    bundleIdentifier: "com.fiskerik.trimswipe",
    buildNumber: "70",
    supportsTablet: true,
    infoPlist: {
      NSCameraUsageDescription: "Needed to find your pictures.",
      NSPhotoLibraryUsageDescription:
        "Trimswipe needs access to your photo library so you can swipe through your photos and free up storage.",
      NSPhotoLibraryAddUsageDescription:
        "Trimswipe may save optimized versions of your photos.",
      ITSAppUsesNonExemptEncryption: false,
      UIBackgroundModes: ["processing"],
      BGTaskSchedulerPermittedIdentifiers: ["trimswipe-cleanup-maintenance"],
    },
  },
  android: {
    package: "com.fiskerik.trimswipe",
    versionCode: 4,
    permissions: [
      "android.permission.READ_EXTERNAL_STORAGE",
      "android.permission.WRITE_EXTERNAL_STORAGE",
      "android.permission.READ_MEDIA_VISUAL_USER_SELECTED",
      "android.permission.ACCESS_MEDIA_LOCATION",
      "android.permission.READ_MEDIA_IMAGES",
      "android.permission.READ_MEDIA_VIDEO",
      "android.permission.READ_MEDIA_AUDIO",
    ],
  },
  plugins: [
    "expo-router",
    [
      "expo-media-library",
      {
        photosPermission:
          "Trimswipe needs access to your photos so you can review and clean up your camera roll.",
        savePhotosPermission: "Trimswipe may save optimized versions of your photos.",
        isAccessMediaLocationEnabled: true,
      },
    ],
    "expo-web-browser",
    "expo-notifications",
    "expo-background-task",
    [
      "react-native-google-mobile-ads",
      {
        iosAppId: adMobAppId(
          process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID,
          DEFAULT_ADMOB_IOS_APP_ID,
          "EXPO_PUBLIC_ADMOB_IOS_APP_ID",
        ),
        androidAppId: adMobAppId(
          process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID,
          DEFAULT_ADMOB_ANDROID_APP_ID,
          "EXPO_PUBLIC_ADMOB_ANDROID_APP_ID",
        ),
      },
    ],
  ],
  extra: {
    eas: {
      projectId: "ddf5633b-2fa9-4f34-b960-fbc01e8b5729",
    },
    router: {},
  },
  owner: "fiskerik89",
};

export default config;
