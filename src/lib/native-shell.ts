// One-shot native shell setup + haptic feedback via native bridge.

let initialised = false;

export async function initNativeShell() {
  if (initialised) return;
  initialised = true;

  if (typeof window === "undefined") return;

  // Apply safe area padding if inside native WebView
  if (window.__SLIM_SAFE_AREA__) {
    const { top, bottom } = window.__SLIM_SAFE_AREA__;
    document.documentElement.style.setProperty("--safe-area-top", `${top}px`);
    document.documentElement.style.setProperty("--safe-area-bottom", `${bottom}px`);
    document.documentElement.classList.add("native-ios");
  }

  console.log("[Slim] Native shell initialised", window.__SLIM_NATIVE__ ? "(native)" : "(web)");
}

export async function hapticTap() {
  if (typeof window === "undefined") return;
  if (window.__slimBridgeCall) {
    try {
      await window.__slimBridgeCall("hapticTap");
    } catch {}
  }
}

export async function hapticSuccess() {
  if (typeof window === "undefined") return;
  if (window.__slimBridgeCall) {
    try {
      await window.__slimBridgeCall("hapticSuccess");
    } catch {}
  }
}

export async function hapticError() {
  if (typeof window === "undefined") return;
  if (window.__slimBridgeCall) {
    try {
      await window.__slimBridgeCall("hapticError");
    } catch {}
  }
}
