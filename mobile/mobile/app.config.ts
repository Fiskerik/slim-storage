import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "Trimswipe",
  slug: "slim-storage",
  version: "1.0.7",
  icon: "./assets/images/icon.png",
  orientation: "portrait",
  scheme: "trimswipe",
  userInterfaceStyle: "automatic",
  ios: {
    bundleIdentifier: "com.fiskerik.trimswipe",
    supportsTablet: true,
    infoPlist: {
      NSCameraUsageDescription: "Needed to find your pictures.",
      NSPhotoLibraryUsageDescription:
        "Trimswipe needs access to your photo library so you can swipe through your photos and free up storage.",
      NSPhotoLibraryAddUsageDescription:
        "Trimswipe may save optimized versions of your photos.",
      NSUserTrackingUsageDescription:
        "This identifier will be used to deliver personalized ads to you.",
      ITSAppUsesNonExemptEncryption: false,
      NSAdvertisingAttributionReportEndpoint: "https://postbacks-is.com",
      NSAppTransportSecurity: {
        NSAllowsArbitraryLoads: true,
      },
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
          "Trimswipe needs access to your photos so you can review and clean up your camera roll.",
        savePhotosPermission: "Trimswipe may save optimized versions of your photos.",
        isAccessMediaLocationEnabled: true,
      },
    ],
    "expo-web-browser",
    "expo-notifications",
    "expo-background-task",
    "./plugins/withLevelPlay",
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
