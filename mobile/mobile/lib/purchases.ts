// RevenueCat purchase handling for the native bridge.
// Fully integrated with RevenueCat SDK for TrimSwipe.

import { Platform } from "react-native";
import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesOfferings,
  type PurchasesPackage,
} from "react-native-purchases";

function envValue(key: string): string | undefined {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  return env?.[key];
}

const REVENUECAT_API_KEY = envValue("EXPO_PUBLIC_RC_KEY") ?? "";
const LIFETIME_PRODUCT_ID = envValue("EXPO_PUBLIC_RC_LIFETIME_PRODUCT_ID") ?? "lifetime_premium_1";
const ENTITLEMENT_ID = envValue("EXPO_PUBLIC_RC_ENTITLEMENT_ID") ?? "TrimswipePro";
const IS_PRODUCTION = envValue("NODE_ENV") === "production";

type PurchaseRequest = {
  productId?: string;
  email?: string;
};

type PurchaseResult = {
  isPro?: boolean;
  success?: boolean;
  products?: Array<{
    id: string;
    title: string;
    description: string;
    price: string;
    priceAmount: number;
    currency: string;
    packageType: string;
  }>;
  customerInfo?: {
    originalAppUserId: string;
    activeSubscriptions: string[];
    allPurchasedProductIds: string[];
    entitlements: Record<
      string,
      { isActive: boolean; expirationDate: string | null; productIdentifier: string }
    >;
  };
  error?: string;
};

let configured = false;
let configuringPromise: Promise<boolean> | null = null;

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export async function initializePurchases(): Promise<boolean> {
  if (configured) return true;
  if (configuringPromise) return configuringPromise;

  configuringPromise = (async () => {
    if (!REVENUECAT_API_KEY) {
      console.error("[RevenueCat] Missing EXPO_PUBLIC_RC_KEY");
      return false;
    }

    if (Platform.OS === "ios" && !REVENUECAT_API_KEY.startsWith("appl_")) {
      console.error(
        "[RevenueCat] Invalid iOS API key. EXPO_PUBLIC_RC_KEY must use the appl_ key for TestFlight builds.",
      );
      return false;
    }

    if (!ENTITLEMENT_ID) {
      console.error("[RevenueCat] Missing EXPO_PUBLIC_RC_ENTITLEMENT_ID");
      return false;
    }

    if (!LIFETIME_PRODUCT_ID) {
      console.error("[RevenueCat] Missing EXPO_PUBLIC_RC_LIFETIME_PRODUCT_ID");
      return false;
    }

    try {
      if (await Purchases.isConfigured()) {
        configured = true;
        console.log("[RevenueCat] Already configured");
        return true;
      }

      Purchases.setLogLevel(IS_PRODUCTION ? LOG_LEVEL.ERROR : LOG_LEVEL.DEBUG);
      Purchases.configure({ apiKey: REVENUECAT_API_KEY });
      configured = true;
      console.log("[RevenueCat] Configured successfully");
      return true;
    } catch (err: unknown) {
      console.error("[RevenueCat] Configuration failed:", getErrorMessage(err));
      return false;
    }
  })().finally(() => {
    configuringPromise = null;
  });

  return configuringPromise;
}

function isProFromInfo(info: CustomerInfo): boolean {
  return info.entitlements.active[ENTITLEMENT_ID] !== undefined;
}

function serializeCustomerInfo(info: CustomerInfo) {
  const entitlements: Record<string, any> = {};
  for (const [key, ent] of Object.entries(info.entitlements.active)) {
    entitlements[key] = {
      isActive: ent.isActive,
      expirationDate: ent.expirationDate,
      productIdentifier: ent.productIdentifier,
    };
  }
  return {
    originalAppUserId: info.originalAppUserId,
    activeSubscriptions: info.activeSubscriptions,
    allPurchasedProductIds: [...info.allPurchasedProductIdentifiers],
    entitlements,
  };
}

export async function handlePurchaseMessage(
  method: string,
  data: PurchaseRequest,
): Promise<PurchaseResult> {
  const ok = await initializePurchases();
  if (!ok) return { error: "RevenueCat not configured", isPro: false };

  switch (method) {
    case "purchases_checkPro":
      return checkPro();
    case "purchases_getProducts":
      return getProducts();
    case "purchases_purchase":
      return purchase(data.productId || "");
    case "purchases_restore":
      return restore();
    case "purchases_getCustomerInfo":
      return getCustomerInfo();
    case "purchases_presentPaywall":
      return presentPaywall();
    case "purchases_presentCustomerCenter":
      return presentCustomerCenter();
    case "purchases_setEmail":
      return setEmail(data.email || "");
    default:
      throw new Error(`Unknown purchase method: ${method}`);
  }
}

// ─── Check Pro Entitlement ────────────────────────

async function checkPro(): Promise<PurchaseResult> {
  try {
    const info = await Purchases.getCustomerInfo();
    return { isPro: isProFromInfo(info) };
  } catch (err: any) {
    console.error("[RevenueCat] checkPro error:", err?.message);
    return { isPro: false, error: err?.message };
  }
}

// ─── Get Available Products ───────────────────────

async function getProducts(): Promise<PurchaseResult> {
  try {
    const offerings: PurchasesOfferings = await Purchases.getOfferings();
    const packages: PurchasesPackage[] = offerings.current?.availablePackages || [];

    return {
      products: packages.map((pkg) => ({
        id: pkg.product.identifier,
        title: pkg.product.title,
        description: pkg.product.description,
        price: pkg.product.priceString,
        priceAmount: pkg.product.price,
        currency: pkg.product.currencyCode,
        packageType: pkg.packageType,
      })),
    };
  } catch (err: any) {
    console.error("[RevenueCat] getProducts error:", err?.message);
    return { products: [], error: err?.message };
  }
}

// ─── Purchase a Product ───────────────────────────

async function purchase(productId: string): Promise<PurchaseResult> {
  if (!productId) return { success: false, error: "No product ID provided" };

  try {
    const offerings = await Purchases.getOfferings();
    const pkg = offerings.current?.availablePackages.find(
      (p: PurchasesPackage) => p.product.identifier === productId,
    );

    if (!pkg) {
      return { success: false, error: `Product "${productId}" not found in current offering` };
    }

    const { customerInfo } = await Purchases.purchasePackage(pkg);
    const isPro = isProFromInfo(customerInfo);

    return {
      success: isPro,
      isPro,
      customerInfo: serializeCustomerInfo(customerInfo),
    };
  } catch (err: any) {
    // User cancelled — not a real error
    if (err?.userCancelled) {
      return { success: false, error: "cancelled" };
    }
    console.error("[RevenueCat] purchase error:", err?.message);
    return { success: false, error: err?.message };
  }
}

// ─── Restore Purchases ───────────────────────────

async function restore(): Promise<PurchaseResult> {
  try {
    const info = await Purchases.restorePurchases();
    return {
      isPro: isProFromInfo(info),
      customerInfo: serializeCustomerInfo(info),
    };
  } catch (err: any) {
    console.error("[RevenueCat] restore error:", err?.message);
    return { isPro: false, error: err?.message };
  }
}

// ─── Get Customer Info ────────────────────────────

async function getCustomerInfo(): Promise<PurchaseResult> {
  try {
    const info = await Purchases.getCustomerInfo();
    return {
      isPro: isProFromInfo(info),
      customerInfo: serializeCustomerInfo(info),
    };
  } catch (err: any) {
    console.error("[RevenueCat] getCustomerInfo error:", err?.message);
    return { isPro: false, error: err?.message };
  }
}

// ─── Present RevenueCat Paywall ───────────────────

async function presentPaywall(): Promise<PurchaseResult> {
  try {
    // Use RevenueCat's built-in paywall UI
    const RevenueCatUI = require("react-native-purchases-ui");
    console.log("[RevenueCat] presentPaywall start", {
      expectedLifetimeProductId: LIFETIME_PRODUCT_ID,
    });
    const result = await RevenueCatUI.presentPaywall();
    console.log("[RevenueCat] presentPaywall result:", result);

    if (
      result === RevenueCatUI.PAYWALL_RESULT.PURCHASED ||
      result === RevenueCatUI.PAYWALL_RESULT.RESTORED
    ) {
      const info = await Purchases.getCustomerInfo();
      const purchasedIds = [...info.allPurchasedProductIdentifiers];
      console.log("[RevenueCat] post-paywall purchased ids:", purchasedIds);

      if (!purchasedIds.includes(LIFETIME_PRODUCT_ID)) {
        console.warn("[RevenueCat] expected lifetime product not found after paywall flow", {
          expectedLifetimeProductId: LIFETIME_PRODUCT_ID,
          purchasedIds,
        });
      }

      return {
        success: true,
        isPro: isProFromInfo(info),
        customerInfo: serializeCustomerInfo(info),
      };
    }

    return { success: false, isPro: false };
  } catch (err: any) {
    console.error("[RevenueCat] presentPaywall error:", err?.message);
    return { success: false, error: err?.message };
  }
}

// ─── Present Customer Center ──────────────────────

async function presentCustomerCenter(): Promise<PurchaseResult> {
  try {
    const RevenueCatUI = require("react-native-purchases-ui");
    console.log("[RevenueCat] presentCustomerCenter start");
    await RevenueCatUI.presentCustomerCenter();
    // After dismissal, re-check status
    const info = await Purchases.getCustomerInfo();
    return {
      success: true,
      isPro: isProFromInfo(info),
      customerInfo: serializeCustomerInfo(info),
    };
  } catch (err: any) {
    console.error("[RevenueCat] presentCustomerCenter error:", err?.message);
    return { error: err?.message };
  }
}

// ─── Set Email (for Customer Center) ──────────────

async function setEmail(email: string): Promise<PurchaseResult> {
  try {
    await Purchases.setEmail(email);
    return { success: true };
  } catch (err: any) {
    console.error("[RevenueCat] setEmail error:", err?.message);
    return { success: false, error: err?.message };
  }
}
