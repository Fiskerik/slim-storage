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
  return typeof window !== "undefined" && !!window.__SLIM_NATIVE__ && !!window.__slimBridgeCall;
}

/**
 * Initialize RevenueCat and check current entitlement status.
 * Returns true if user has active "pro" entitlement.
 */
export async function checkProStatus(): Promise<boolean> {
  if (!hasBridge()) return false;
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
  if (!hasBridge()) return [];
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
  if (!hasBridge()) return false;
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
