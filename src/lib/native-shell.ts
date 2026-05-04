// One-shot native shell setup: status bar style, splash hide, safe-area padding.
// Nu anpassad för Expo/Web istället för Capacitor.

let initialised = false;

/**
 * Initialiserar inställningar för den inbyggda miljön.
 * Eftersom vi inte använder Capacitor längre är detta främst en placeholder
 * eller plats för Expo-specifik logik.
 */
export async function initNativeShell() {
  if (initialised) return;
  initialised = true;
  
  if (typeof window === "undefined") return;

  // Om du senare installerar 'expo-status-bar' eller 'expo-splash-screen'
  // är det här du anropar dem. Just nu gör vi ingenting för att undvika fel.
  console.log("[Slim] Native shell initialised (Web/Expo mode)");

  // Vi kan fortfarande behålla klassen om du har CSS-regler som använder den,
  // men i Expo sköts ofta safe-area via React Native-komponenter.
  // document.documentElement.classList.add("native-ios");
}

/**
 * Utför en haptisk feedback (vibration).
 * Kräver 'expo-haptics' för att fungera på riktigt.
 */
export async function hapticTap() {
  if (typeof window === "undefined") return;
  
  // Exempel på hur det skulle se ut med Expo:
  // const Haptics = await import('expo-haptics');
  // await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  
  console.log("[Slim] Haptic tap requested (no-op without expo-haptics)");
}