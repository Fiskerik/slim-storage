// One-shot native shell setup: status bar style, splash hide, safe-area padding.
// Safe to call on web — it's a no-op when not running inside Capacitor.

import { Capacitor } from "@capacitor/core";

let initialised = false;

export async function initNativeShell() {
  if (initialised) return;
  initialised = true;
  if (typeof window === "undefined") return;
  if (!Capacitor.isNativePlatform()) return;

  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: Style.Dark }); // dark text on light bg
    await StatusBar.setOverlaysWebView({ overlay: false });
  } catch (e) {
    console.warn("[Slim] StatusBar setup failed", e);
  }

  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    await SplashScreen.hide({ fadeOutDuration: 250 });
  } catch (e) {
    console.warn("[Slim] SplashScreen hide failed", e);
  }

  // Add a class so CSS can apply iOS-specific tweaks (e.g. safe-area).
  document.documentElement.classList.add("native-ios");
}

export async function hapticTap() {
  if (typeof window === "undefined" || !Capacitor.isNativePlatform()) return;
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    /* ignore */
  }
}
