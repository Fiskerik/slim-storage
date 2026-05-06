# TestFlight Fix Checklist — Real iPhone Photos & RevenueCat

## Root Cause Summary

Your app loads `trimswipe.lovable.app` inside a React Native WebView. For the
web code to know it's running natively it checks `window.__SLIM_NATIVE__` and
`window.__slimBridgeCall`. In TestFlight those values arrive via
`injectedJavaScriptBeforeContentLoaded` — but the web app often finishes its
initial render **before** the injected JS has executed, so `isNativeApp()`
returns `false` and every feature falls back to the web-stub path.

---

## Fix 1 — Make the bridge injection more reliable

**File:** `mobile/mobile/components/WebViewScreen.tsx`

The `injectedJavaScriptBeforeContentLoaded` script currently dispatches
`slimBridgeReady` at the end. But in production (HTTPS, fully cached PWA) the
React app boots faster than the event reaches it.

**Add a `window.__SLIM_NATIVE__ = true` guard at the very top of the injected
script, before any async code:**

```js
// First line of injectedJavaScriptBeforeContentLoaded
window.__SLIM_NATIVE__ = true;
window.__SLIM_BRIDGE_VERSION__ = 1;
```

Also store the bridge call helper on `window` *synchronously* (you already do
this, just confirm there's no async wrapper around it). The key rule: by the
time the first `<script>` in the web page runs, `window.__SLIM_NATIVE__` must
already be `true`.

---

## Fix 2 — Fix `isNativeApp()` / `hasBridge()` detection

**File:** `src/lib/photo-source.ts`

Your `hasBridge()` checks `window.__slimBridgeCall` **and** the UA string.
The problem: in TestFlight the WebView UA is just a normal Safari UA — it does
**not** contain "ReactNative" or "Expo".

Change the detection order so the `__SLIM_NATIVE__` flag is the primary signal:

```ts
function hasBridge(): boolean {
  if (typeof window === 'undefined') return false;
  // Flag set synchronously by injectedJavaScriptBeforeContentLoaded
  if (window.__SLIM_NATIVE__ === true) return true;
  if (typeof window.__slimBridgeCall === 'function') return true;
  if (typeof window.ReactNativeWebView?.postMessage === 'function') return true;
  return false;
}
```

Remove the UA sniff — it's unreliable in WebView.

---

## Fix 3 — Extend `waitForBridge` timeout and fallback

**File:** `src/lib/photo-source.ts`

`waitForBridge(3000)` is called once at startup. If the bridge isn't ready
within 3 s it falls back to web photos permanently (the `cached` variable is
set and never re-evaluated).

```ts
export async function getPhotoSourceAsync(): Promise<PhotoSource> {
  if (cached) return cached;
  // If native flag is already set, use bridge immediately
  if (typeof window !== 'undefined' && window.__SLIM_NATIVE__) {
    cached = nativeBridgeSource;
    return cached;
  }
  const bridgeReady = await waitForBridge(5000); // increase to 5 s
  cached = bridgeReady ? nativeBridgeSource : webSource;
  return cached;
}
```

Also **reset `cached` to `null` when the bridge becomes ready** by listening
to the `slimBridgeReady` event, so a late-arriving bridge isn't missed:

```ts
if (typeof window !== 'undefined') {
  window.addEventListener('slimBridgeReady', () => {
    if (cached === webSource) cached = nativeBridgeSource; // upgrade
  }, { once: true });
}
```

---

## Fix 4 — Request photo permission at the right time

**File:** `src/components/SwipeDeck.tsx`

`requestPermission()` is only called when `src.isNative` is true. Because of
Fix 2/3 being wrong, `src.isNative` was `false` so permission was never
requested, and the device library was never accessed.

After Fixes 2 & 3 this should auto-resolve, but double-check: after
`getPhotoSourceAsync()` returns, log `src.isNative` to the console in a
TestFlight build so you can confirm it's `true`.

---

## Fix 5 — RevenueCat: environment variable must be set in EAS

**File:** `eas.json` + EAS dashboard

`purchases.ts` checks `hasBridge()` before calling the native bridge for
RevenueCat. Once Fix 2 is in place this will work. But also confirm:

1. `EXPO_PUBLIC_RC_KEY` is set as a secret in the EAS dashboard (not just in
   `.env.local`).
2. `EXPO_PUBLIC_RC_ENTITLEMENT_ID` exactly matches the entitlement identifier
   in the RevenueCat dashboard (case-sensitive).
3. `EXPO_PUBLIC_RC_LIFETIME_PRODUCT_ID` exactly matches the product ID in App
   Store Connect.

In `eas.json` add the env vars to the production profile:

```json
"production": {
  "env": {
    "EXPO_PUBLIC_RC_KEY": "@rc_api_key",
    "EXPO_PUBLIC_RC_ENTITLEMENT_ID": "@rc_entitlement_id",
    "EXPO_PUBLIC_RC_LIFETIME_PRODUCT_ID": "@rc_product_id"
  }
}
```

Set the secrets with: `eas secret:create --name rc_api_key --value "appl_xxx"`

---

## Fix 6 — Remove the "Switch back to free (test)" button before App Store

**File:** `src/components/ProfilePage.tsx`

This button is visible to Pro users and lets them downgrade without a real
refund. Apple will reject the app for having a backdoor that bypasses the
purchase flow. Remove or guard it behind `__DEV__` only.

```tsx
{stats.isPro && __DEV__ && (
  <button onClick={() => { setPro(false); }}>
    Switch back to free (test)
  </button>
)}
```

---

## Fix 7 — Photo permission copy in `app.json`

**File:** `mobile/mobile/app.json`

The `NSPhotoLibraryUsageDescription` string currently says "Needed to select
pictures" — this is too vague and may cause App Store review to ask for
clarification. Update it to match what the root `app.json` already has:

```json
"NSPhotoLibraryUsageDescription": "Trimswipe needs access to your photo library so you can swipe through your photos and free up storage.",
"NSPhotoLibraryAddUsageDescription": "Trimswipe may save optimized versions of your photos."
```

---

## Fix 8 — Build & submit checklist

- [ ] Apply Fixes 1–4 and commit.
- [ ] Set EAS secrets (Fix 5).
- [ ] Run `eas build --platform ios --profile production`.
- [ ] Submit to TestFlight with `eas submit -p ios`.
- [ ] On first launch, open Xcode → Devices → Console and filter for
      `[Slim]` / `[RevenueCat]` to confirm the bridge is detected and
      RevenueCat initialises.
- [ ] Test photo permission prompt appears on first Swipe session.
- [ ] Test purchase flow with a Sandbox Apple ID.
- [ ] Remove "Switch back to free (test)" button (Fix 6) before App Store submission.

---

## Quick diagnosis for your current TestFlight build

Open Safari on your Mac → Develop → [your iPhone] → trimswipe WebView →
Console. Run:

```js
window.__SLIM_NATIVE__
window.__slimBridgeCall
```

If either returns `undefined`, the injected JS hasn't run before the page
bootstrapped — Fix 1 is your primary issue.
