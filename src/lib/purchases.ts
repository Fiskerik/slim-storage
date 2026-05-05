// src/lib/purchases.ts
// RevenueCat integration bridge for in-app purchases.
// In native WebView: delegates to Expo native shell via bridge.
// On web: no-op stubs.

export type PurchaseProduct = {
  id: string;
  title: string;
  description: string;
  price: string;          // localized price string e.g. "$4.99"
  priceAmount: number;    // numeric e.g. 4.99
  currency: string;       // e.g. "USD"
  packageType?: string;
};

export type CustomerInfoDTO = {
  originalAppUserId: string;
  activeSubscriptions: string[];
  allPurchasedProductIds: string[];
  entitlements: Record<string, {
    isActive: boolean;
    expirationDate: string | null;
    productIdentifier: string;
  }>;
};

export type PurchaseState = {
  isPro: boolean;
  products: PurchaseProduct[];
  loading: boolean;
};

declare global {
  interface Window {
    __slimBridgeCall?: (method: string, data?: Record<string, any>) => Promise<any>;
    __SLIM_NATIVE__?: boolean;
  }
}

function hasBridge(): boolean {
  if (typeof window === "undefined") return false;
  return (
    typeof window.__slimBridgeCall === "function" ||
    !!window.__SLIM_NATIVE__ ||
    typeof window.ReactNativeWebView?.postMessage === "function"
  );
}

/**
 * Check if user has active "TrimSwipe Pro" entitlement.
 */
export async function checkProStatus(): Promise<boolean> {
  if (!hasBridge()) { console.log("[purchases] no native bridge for checkProStatus"); return false; }
  try {
    const result = await window.__slimBridgeCall!("purchases_checkPro");
    return result?.isPro === true;
  } catch {
    return false;
  }
}

/**
 * Get available products for purchase.
 */
export async function getProducts(): Promise<PurchaseProduct[]> {
  if (!hasBridge()) { console.log("[purchases] no native bridge for getProducts"); return []; }
  try {
    const result = await window.__slimBridgeCall!("purchases_getProducts");
    return result?.products || [];
  } catch {
    return [];
  }
}

/**
 * Purchase a product by ID. Returns true if purchase was successful.
 */
export async function purchaseProduct(productId: string): Promise<boolean> {
  if (!hasBridge()) { console.log("[purchases] no native bridge for purchaseProduct"); return false; }
  try {
    const result = await window.__slimBridgeCall!("purchases_purchase", { productId });
    return result?.success === true;
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
    const result = await window.__slimBridgeCall!("purchases_restore");
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
    const result = await window.__slimBridgeCall!("purchases_getCustomerInfo");
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
  try {
    const result = await window.__slimBridgeCall!("purchases_presentPaywall");
    return result?.success === true;
  } catch {
    return false;
  }
}

/**
 * Present RevenueCat's Customer Center UI (manage subscriptions, support).
 */
export async function presentCustomerCenter(): Promise<void> {
  if (!hasBridge()) return;
  try {
    await window.__slimBridgeCall!("purchases_presentCustomerCenter");
  } catch {
    // silent fail on web
  }
}

/**
 * Set customer email for RevenueCat (used in Customer Center).
 */
export async function setCustomerEmail(email: string): Promise<boolean> {
  if (!hasBridge()) return false;
  try {
    const result = await window.__slimBridgeCall!("purchases_setEmail", { email });
    return result?.success === true;
  } catch {
    return false;
  }
}
