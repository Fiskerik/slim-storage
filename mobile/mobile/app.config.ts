import type { ExpoConfig } from "expo/config";

const DEFAULT_ADMOB_IOS_APP_ID = "ca-app-pub-8854735603167656~1027546750";
const DEFAULT_ADMOB_ANDROID_APP_ID = "ca-app-pub-3940256099942544~3347511713";
const ADMOB_APP_ID_PATTERN = /^ca-app-pub-\d+~\d+$/;
const SUPPORTED_LOCALES = [
  "en", "zh-Hans", "zh-Hant", "es", "hi", "ar", "pt-BR", "fr", "de", "ja", "ko", "ru", "id", "tr",
  "it", "vi", "cs", "nl", "fi", "ms", "no", "pl", "sv", "th", "uk", "da", "ta",
];
const IOS_SK_AD_NETWORK_ITEMS = [
  "cstr6suwn9.skadnetwork",
  "4fzdc2evr5.skadnetwork",
  "2fnua5tdw4.skadnetwork",
  "ydx93a7ass.skadnetwork",
  "p78axxw29g.skadnetwork",
  "v72qych5uu.skadnetwork",
  "ludvb6z3bs.skadnetwork",
  "cp8zw746q7.skadnetwork",
  "3sh42y64q3.skadnetwork",
  "c6k4g5qg8m.skadnetwork",
  "s39g8k73mm.skadnetwork",
  "wg4vff78zm.skadnetwork",
  "3qy4746246.skadnetwork",
  "f38h382jlk.skadnetwork",
  "hs6bdukanm.skadnetwork",
  "mlmmfzh3r3.skadnetwork",
  "v4nxqhlyqp.skadnetwork",
  "wzmmz9fp6w.skadnetwork",
  "su67r6k2v3.skadnetwork",
  "yclnxrl5pm.skadnetwork",
  "t38b2kh725.skadnetwork",
  "7ug5zh24hu.skadnetwork",
  "gta9lk7p23.skadnetwork",
  "vutu7akeur.skadnetwork",
  "y5ghdn5j9k.skadnetwork",
  "v9wttpbfk9.skadnetwork",
  "n38lu8286q.skadnetwork",
  "47vhws6wlr.skadnetwork",
  "kbd757ywx3.skadnetwork",
  "9t245vhmpl.skadnetwork",
  "a2p9lx4jpn.skadnetwork",
  "22mmun2rn5.skadnetwork",
  "44jx6755aq.skadnetwork",
  "k674qkevps.skadnetwork",
  "4468km3ulz.skadnetwork",
  "2u9pt9hc89.skadnetwork",
  "8s468mfl3y.skadnetwork",
  "klf5c3l5u5.skadnetwork",
  "ppxm28t8ap.skadnetwork",
  "kbmxgpxpgc.skadnetwork",
  "uw77j35x4d.skadnetwork",
  "578prtvx9j.skadnetwork",
  "4dzt52r2t5.skadnetwork",
  "tl55sbb4fm.skadnetwork",
  "c3frkrj4fj.skadnetwork",
  "e5fvkxwrpn.skadnetwork",
  "8c4e2ghe7u.skadnetwork",
  "3rd42ekr43.skadnetwork",
  "97r2b46745.skadnetwork",
  "3qcr597p9d.skadnetwork",
];

function adMobAppId(value: string | undefined, fallback: string, name: string): string {
  if (!value) return fallback;
  if (ADMOB_APP_ID_PATTERN.test(value)) return value;
  console.warn(`[ads] Ignoring invalid ${name}; expected an AdMob app id like ca-app-pub-...~...`);
  return fallback;
}

const config: ExpoConfig = {
  name: "TrimSwipe",
  slug: "slim-storage",
  version: "1.1.4",
  icon: "./assets/images/icon.png",
  orientation: "portrait",
  scheme: "trimswipe",
  userInterfaceStyle: "automatic",
  ios: {
    bundleIdentifier: "com.fiskerik.trimswipe",
    buildNumber: "71",
    supportsTablet: true,
    infoPlist: {
      CFBundleAllowMixedLocalizations: true,
      CFBundleLocalizations: SUPPORTED_LOCALES,
      NSPhotoLibraryUsageDescription:
        "TrimSwipe needs access to your photo library so you can swipe through your photos and free up storage.",
      NSPhotoLibraryAddUsageDescription:
        "TrimSwipe may save optimized versions of your photos.",
      ITSAppUsesNonExemptEncryption: false,
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
        // Declare every in-app language to iOS and Android while leaving the
        // display name unchanged. `forcesRTL` must stay unset because Arabic
        // can be selected alongside left-to-right languages.
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
    [
      "expo-build-properties",
      {
        ios: {
          extraPods: [
            { name: "GoogleMobileAdsMediationFacebook", version: "6.21.1.0" },
            { name: "GoogleMobileAdsMediationUnity", version: "4.17.0.0" },
          ],
        },
      },
    ],
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
        skAdNetworkItems: IOS_SK_AD_NETWORK_ITEMS,
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
