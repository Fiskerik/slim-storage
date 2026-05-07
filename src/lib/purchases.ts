// src/lib/purchases.ts
// RevenueCat integration bridge for in-app purchases.
// In native WebView: delegates to Expo native shell via bridge.
// On web: no-op stubs.

export type PurchaseProduct = {
  id: string;
  title: string;
  description: string;
  price: string; // localized price string e.g. "$4.99"
  priceAmount: number; // numeric e.g. 4.99
  currency: string; // e.g. "USD"
  packageType?: string;
};

export type CustomerInfoDTO = {
  originalAppUserId: string;
  activeSubscriptions: string[];
  allPurchasedProductIds: string[];
  entitlements: Record<
    string,
    {
      isActive: boolean;
      expirationDate: string | null;
      productIdentifier: string;
    }
  >;
};

export type PurchaseState = {
  isPro: boolean;
  products: PurchaseProduct[];
  loading: boolean;
};

type PurchaseBridgeResult = Partial<PurchaseState> & {
  success?: boolean;
  customerInfo?: CustomerInfoDTO;
  error?: string;
};

function hasBridge(): boolean {
  if (typeof window === "undefined") return false;
  return (
    typeof window.__slimBridgeCall === "function" ||
    !!window.__SLIM_NATIVE__ ||
    typeof window.ReactNativeWebView?.postMessage === "function"
  );
}

function hasCallableBridge(): boolean {
  return typeof window !== "undefined" && typeof window.__slimBridgeCall === "function";
}

function waitForBridgeCall(timeoutMs = 5000): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve(false);
      return;
    }

    if (hasCallableBridge()) {
      resolve(true);
      return;
    }

    const onReady = () => resolve(true);
    window.addEventListener("slimBridgeReady", onReady, { once: true });

    setTimeout(() => {
      window.removeEventListener("slimBridgeReady", onReady);
      resolve(hasCallableBridge());
    }, timeoutMs);
  });
}

async function purchaseBridgeCall(method: string, data?: Record<string, unknown>) {
  if (!hasBridge()) {
    console.log("[purchases] no native bridge", { method });
    return null;
  }

  if (!hasCallableBridge()) {
    console.log("[purchases] waiting for native bridge", { method });
    await waitForBridgeCall(7000);
  }

  if (!window.__slimBridgeCall) {
    console.error("[purchases] bridge never became callable", {
      method,
      SLIM_NATIVE: window.__SLIM_NATIVE__,
      hasRNWebView: !!window.ReactNativeWebView,
    });
    throw new Error("Native bridge unavailable — try restarting the app");
  }

  return (await window.__slimBridgeCall(method, data)) as PurchaseBridgeResult;
}

/**
 * Check if user has active "TrimSwipe Pro" entitlement.
 */
export async function checkProStatus(): Promise<boolean> {
  if (!hasBridge()) {
    console.log("[purchases] no native bridge for checkProStatus");
    return false;
  }
  try {
    const result = await purchaseBridgeCall("purchases_checkPro");
    if (result?.error) console.log("[purchases] checkProStatus error", result.error);
    return result?.isPro === true;
  } catch {
    return false;
  }
}

/**
 * Get available products for purchase.
 */
export async function getProducts(): Promise<PurchaseProduct[]> {
  if (!hasBridge()) {
    console.log("[purchases] no native bridge for getProducts");
    return [];
  }
  try {
    const result = await purchaseBridgeCall("purchases_getProducts");
    if (result?.error) console.log("[purchases] getProducts error", result.error);
    return result?.products || [];
  } catch {
    return [];
  }
}

/**
 * Purchase a product by ID. Returns true if purchase was successful.
 */
export async function purchaseProduct(productId: string): Promise<boolean> {
  if (!hasBridge()) {
    console.log("[purchases] no native bridge for purchaseProduct");
    return false;
  }
  try {
    const result = await purchaseBridgeCall("purchases_purchase", { productId });
    if (result?.error) console.log("[purchases] purchaseProduct error", result.error);
    return result?.success === true || result?.isPro === true;
  } catch {
    return false;
  }
}

/**
 * Restore previous purchases. Returns true if pro entitlement was restored.
 */
export async function restorePurchases(): Promise<boolean> {
  if (!hasBridge()) return false;
  try {
    const result = await purchaseBridgeCall("purchases_restore");
    if (result?.error) console.log("[purchases] restorePurchases error", result.error);
    return result?.isPro === true;
  } catch {
    return false;
  }
}

/**
 * Get detailed customer info from RevenueCat.
 */
export async function getCustomerInfo(): Promise<CustomerInfoDTO | null> {
  if (!hasBridge()) return null;
  try {
    const result = await purchaseBridgeCall("purchases_getCustomerInfo");
    if (result?.error) console.log("[purchases] getCustomerInfo error", result.error);
    return result?.customerInfo || null;
  } catch {
    return null;
  }
}

/**
 * Present RevenueCat's built-in paywall UI.
 * Returns true if a purchase or restore was completed.
 */
export async function presentPaywall(): Promise<boolean> {
  if (!hasBridge()) return false;
  const result = await purchaseBridgeCall("purchases_presentPaywall");
  if (result?.error) console.log("[purchases] presentPaywall error", result.error);
  return result?.success === true || result?.isPro === true;
}

/**
 * Present RevenueCat's Customer Center UI (manage subscriptions, support).
 */
export async function presentCustomerCenter(): Promise<boolean> {
  if (!hasBridge()) {
    console.log("[purchases] no native bridge for presentCustomerCenter");
    return false;
  }
  try {
    const result = await Promise.race([
      purchaseBridgeCall("purchases_presentCustomerCenter"),
      new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 6000)),
    ]);
    if (result === null) {
      console.log("[purchases] presentCustomerCenter timed out; falling back");
      return false;
    }
    if (result?.error) console.log("[purchases] presentCustomerCenter error", result.error);
    return result?.success === true || result?.isPro === true;
  } catch (error) {
    console.log("[purchases] presentCustomerCenter exception", error);
    return false;
  }
}

export async function openSubscriptionSettings(): Promise<boolean> {
  if (!hasBridge()) return false;
  try {
    const result = await purchaseBridgeCall("openSubscriptionSettings");
    return result !== null;
  } catch (error) {
    console.log("[purchases] openSubscriptionSettings exception", error);
    return false;
  }
}

/**
 * Set customer email for RevenueCat (used in Customer Center).
 */
export async function setCustomerEmail(email: string): Promise<boolean> {
  if (!hasBridge()) return false;
  try {
    const result = await purchaseBridgeCall("purchases_setEmail", { email });
    if (result?.error) console.log("[purchases] setCustomerEmail error", result.error);
    return result?.success === true;
  } catch {
    return false;
  }
}
