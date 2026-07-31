// RevenueCat purchase handling for the native bridge.
// Fully integrated with RevenueCat SDK for TrimSwipe.

import { AppState, Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import Purchases, {
  LOG_LEVEL,
  PURCHASE_TYPE,
  type CustomerInfo,
  type PurchasesOfferings,
  type PurchasesPackage,
  type PurchasesStoreProduct,
} from "react-native-purchases";
import { addTokens, TOKEN_PACKS } from "./tokens";

const REVENUECAT_API_KEY = process.env.EXPO_PUBLIC_RC_KEY ?? "";
export const LIFETIME_PRODUCT_ID =
  process.env.EXPO_PUBLIC_RC_LIFETIME_PRODUCT_ID ?? "lifetime_premium_1";
export const MONTHLY_PRODUCT_ID =
  process.env.EXPO_PUBLIC_RC_MONTHLY_PRODUCT_ID ?? "trimswipe_monthly";
export const YEARLY_PRODUCT_ID =
  process.env.EXPO_PUBLIC_RC_YEARLY_PRODUCT_ID ?? "trimswipe_yearly";
const SUBSCRIPTION_PRODUCT_IDS = new Set([MONTHLY_PRODUCT_ID, YEARLY_PRODUCT_ID]);
const ENTITLEMENT_ID = process.env.EXPO_PUBLIC_RC_ENTITLEMENT_ID ?? "TrimswipePro";
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const FORCE_PRO_FOR_TESTING = false;
const TRANSACTION_LEDGER_FILE = "trimswipe-purchase-transactions-v1.json";
const SUBSCRIPTION_TOKEN_GRANTS_FILE = "trimswipe-subscription-token-grants-v1.json";
const SUBSCRIPTION_MONTHLY_TOKEN_GRANTS: Record<string, number> = {
  [MONTHLY_PRODUCT_ID]: 250,
  [YEARLY_PRODUCT_ID]: 500,
};

type PurchaseRequest = {
  productId?: string;
  email?: string;
};

type PurchaseResult = {
  isPro?: boolean;
  hasUnlimitedTrims?: boolean;
  success?: boolean;
  tokensGranted?: number;
  transactionId?: string;
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
    nonSubscriptionTransactions?: Array<{
      transactionIdentifier: string;
      productIdentifier: string;
      purchaseDate: string;
    }>;
  };
  error?: string;
};

let configured = false;
let configuringPromise: Promise<boolean> | null = null;
let transactionLedgerInitialized = false;
let processedTransactionIds: Set<string> | null = null;
let transactionLedgerPromise: Promise<Set<string>> | null = null;
let foregroundSubscription: { remove: () => void } | null = null;
const transactionsBeingProcessed = new Set<string>();
const tokenProductsBeingPurchased = new Set<string>();
let subscriptionTokenGrants: Record<string, { productId: string; amount: number }> | null = null;
let subscriptionTokenGrantsPromise: Promise<
  Record<string, { productId: string; amount: number }>
> | null = null;

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function transactionLedgerUri(): string | null {
  return FileSystem.documentDirectory
    ? `${FileSystem.documentDirectory}${TRANSACTION_LEDGER_FILE}`
    : null;
}

async function loadProcessedTransactionIds(): Promise<Set<string>> {
  if (processedTransactionIds) return processedTransactionIds;
  if (transactionLedgerPromise) return transactionLedgerPromise;

  transactionLedgerPromise = (async () => {
    const path = transactionLedgerUri();
    if (!path) {
      processedTransactionIds = new Set<string>();
      transactionLedgerInitialized = true;
      return processedTransactionIds;
    }

    try {
      const info = await FileSystem.getInfoAsync(path);
      if (info.exists) {
        const parsed = JSON.parse(await FileSystem.readAsStringAsync(path)) as {
          initialized?: boolean;
          transactionIds?: unknown;
        };
        transactionLedgerInitialized = parsed.initialized === true;
        processedTransactionIds = new Set(
          Array.isArray(parsed.transactionIds)
            ? parsed.transactionIds.filter((id): id is string => typeof id === "string")
            : [],
        );
        return processedTransactionIds;
      }
    } catch (err) {
      console.log("[RevenueCat] purchase transaction ledger load failed", err);
    }

    processedTransactionIds = new Set<string>();
    return processedTransactionIds;
  })().finally(() => {
    transactionLedgerPromise = null;
  });

  return transactionLedgerPromise;
}

async function persistProcessedTransactionIds(): Promise<void> {
  const path = transactionLedgerUri();
  if (!path || !processedTransactionIds) return;
  try {
    await FileSystem.writeAsStringAsync(
      path,
      JSON.stringify({
        initialized: transactionLedgerInitialized,
        transactionIds: [...processedTransactionIds],
      }),
    );
  } catch (err) {
    console.log("[RevenueCat] purchase transaction ledger save failed", err);
  }
}

function subscriptionTokenGrantsUri(): string | null {
  return FileSystem.documentDirectory
    ? `${FileSystem.documentDirectory}${SUBSCRIPTION_TOKEN_GRANTS_FILE}`
    : null;
}

async function loadSubscriptionTokenGrants(): Promise<
  Record<string, { productId: string; amount: number }>
> {
  if (subscriptionTokenGrants) return subscriptionTokenGrants;
  if (subscriptionTokenGrantsPromise) return subscriptionTokenGrantsPromise;

  subscriptionTokenGrantsPromise = (async () => {
    const path = subscriptionTokenGrantsUri();
    if (!path) {
      subscriptionTokenGrants = {};
      return subscriptionTokenGrants;
    }

    try {
      const info = await FileSystem.getInfoAsync(path);
      if (info.exists) {
        const parsed = JSON.parse(await FileSystem.readAsStringAsync(path)) as unknown;
        if (parsed && typeof parsed === "object") {
          subscriptionTokenGrants = Object.fromEntries(
            Object.entries(parsed as Record<string, unknown>).flatMap(([month, value]) => {
              if (!value || typeof value !== "object") return [];
              const grant = value as { productId?: unknown; amount?: unknown };
              if (typeof grant.productId !== "string" || typeof grant.amount !== "number") {
                return [];
              }
              return [[month, { productId: grant.productId, amount: Math.max(0, grant.amount) }]];
            }),
          );
          return subscriptionTokenGrants;
        }
      }
    } catch (err) {
      console.log("[RevenueCat] subscription token grant ledger load failed", err);
    }

    subscriptionTokenGrants = {};
    return subscriptionTokenGrants;
  })().finally(() => {
    subscriptionTokenGrantsPromise = null;
  });

  return subscriptionTokenGrantsPromise;
}

async function persistSubscriptionTokenGrants(): Promise<void> {
  const path = subscriptionTokenGrantsUri();
  if (!path || !subscriptionTokenGrants) return;
  try {
    await FileSystem.writeAsStringAsync(path, JSON.stringify(subscriptionTokenGrants));
  } catch (err) {
    console.log("[RevenueCat] subscription token grant ledger save failed", err);
  }
}

function currentCalendarMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

async function reconcileSubscriptionTokenGrant(info: CustomerInfo): Promise<number> {
  const entitlement = info.entitlements.active[ENTITLEMENT_ID];
  const grantAmount = entitlement
    ? SUBSCRIPTION_MONTHLY_TOKEN_GRANTS[entitlement.productIdentifier] ?? 0
    : 0;
  if (!grantAmount) return 0;

  const grants = await loadSubscriptionTokenGrants();
  const month = currentCalendarMonthKey();
  const previous = grants[month];
  const additionalTokens = Math.max(0, grantAmount - (previous?.amount ?? 0));
  if (additionalTokens === 0) return 0;

  await addTokens(additionalTokens, "grant");
  grants[month] = { productId: entitlement.productIdentifier, amount: grantAmount };
  await persistSubscriptionTokenGrants();
  return additionalTokens;
}

async function initializeTransactionLedger(info: CustomerInfo): Promise<void> {
  const ledger = await loadProcessedTransactionIds();
  if (transactionLedgerInitialized) return;

  for (const transaction of info.nonSubscriptionTransactions ?? []) {
    ledger.add(transaction.transactionIdentifier);
  }
  transactionLedgerInitialized = true;
  await persistProcessedTransactionIds();
}

async function markTransactionProcessed(transactionId: string | undefined): Promise<void> {
  if (!transactionId) return;
  const ledger = await loadProcessedTransactionIds();
  if (ledger.has(transactionId)) return;
  ledger.add(transactionId);
  await persistProcessedTransactionIds();
}

async function reconcileNewTokenTransactions(info: CustomerInfo): Promise<number> {
  const ledger = await loadProcessedTransactionIds();
  if (!transactionLedgerInitialized) {
    await initializeTransactionLedger(info);
    return 0;
  }

  let tokensGranted = 0;
  for (const transaction of info.nonSubscriptionTransactions ?? []) {
    const tokens = TOKEN_PACKS[transaction.productIdentifier];
    if (
      !tokens ||
      ledger.has(transaction.transactionIdentifier) ||
      transactionsBeingProcessed.has(transaction.transactionIdentifier) ||
      tokenProductsBeingPurchased.has(transaction.productIdentifier)
    ) {
      continue;
    }

    transactionsBeingProcessed.add(transaction.transactionIdentifier);
    try {
      await addTokens(tokens, "purchase");
      ledger.add(transaction.transactionIdentifier);
      tokensGranted += tokens;
    } finally {
      transactionsBeingProcessed.delete(transaction.transactionIdentifier);
    }
  }

  if (tokensGranted > 0) await persistProcessedTransactionIds();
  return tokensGranted;
}

async function refreshPurchaseState(): Promise<{ info: CustomerInfo; tokensGranted: number }> {
  const info = await Purchases.getCustomerInfo();
  await initializeTransactionLedger(info);
  const purchasedTokens = await reconcileNewTokenTransactions(info);
  const subscriptionTokens = await reconcileSubscriptionTokenGrant(info);
  return { info, tokensGranted: purchasedTokens + subscriptionTokens };
}

function installPurchaseObservers(): void {
  Purchases.addCustomerInfoUpdateListener((info) => {
    void initializeTransactionLedger(info)
      .then(() => reconcileNewTokenTransactions(info))
      .then(() => reconcileSubscriptionTokenGrant(info));
  });

  if (Platform.OS === "ios" && !foregroundSubscription) {
    foregroundSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void refreshPurchaseState().catch((err) =>
          console.log("[RevenueCat] foreground purchase sync failed", getErrorMessage(err)),
        );
      }
    });
  }
}

function iosVersion(): number {
  return typeof Platform.Version === "number"
    ? Platform.Version
    : Number.parseFloat(String(Platform.Version));
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
        installPurchaseObservers();
        console.log("[RevenueCat] Already configured");
        return true;
      }

      Purchases.setLogLevel(IS_PRODUCTION ? LOG_LEVEL.ERROR : LOG_LEVEL.DEBUG);
      Purchases.configure({ apiKey: REVENUECAT_API_KEY });
      configured = true;
      installPurchaseObservers();
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

function hasUnlimitedTrimsFromInfo(info: CustomerInfo): boolean {
  return info.entitlements.active[ENTITLEMENT_ID]?.productIdentifier === LIFETIME_PRODUCT_ID;
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
    nonSubscriptionTransactions: info.nonSubscriptionTransactions.map((transaction) => ({
      transactionIdentifier: transaction.transactionIdentifier,
      productIdentifier: transaction.productIdentifier,
      purchaseDate: transaction.purchaseDate,
    })),
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
    case "purchases_redeemOfferCode":
      return redeemOfferCode();
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
  if (FORCE_PRO_FOR_TESTING) return { isPro: true, hasUnlimitedTrims: true };
  try {
    const { info } = await refreshPurchaseState();
    return {
      isPro: isProFromInfo(info),
      hasUnlimitedTrims: hasUnlimitedTrimsFromInfo(info),
    };
  } catch (err: any) {
    console.error("[RevenueCat] checkPro error:", err?.message);
    return { isPro: false, hasUnlimitedTrims: false, error: err?.message };
  }
}

// ─── Get Available Products ───────────────────────

async function getProducts(): Promise<PurchaseResult> {
  try {
    const offerings: PurchasesOfferings = await Purchases.getOfferings();
    const packages: PurchasesPackage[] = offerings.current?.availablePackages || [];
    if (packages.length === 0) {
      const inAppIds = [LIFETIME_PRODUCT_ID, ...Object.keys(TOKEN_PACKS)].filter(Boolean);
      const subscriptionIds = [MONTHLY_PRODUCT_ID, YEARLY_PRODUCT_ID].filter(Boolean);
      const [inAppProducts, subscriptionProducts] = await Promise.all([
        inAppIds.length > 0 ? Purchases.getProducts(inAppIds, PURCHASE_TYPE.INAPP) : [],
        subscriptionIds.length > 0
          ? Purchases.getProducts(subscriptionIds, PURCHASE_TYPE.SUBS)
          : [],
      ]);
      const storeProducts = [...inAppProducts, ...subscriptionProducts];
      return { products: storeProducts.map(serializeStoreProduct) };
    }

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

function serializeStoreProduct(product: PurchasesStoreProduct) {
  return {
    id: product.identifier,
    title: product.title,
    description: product.description,
    price: product.priceString,
    priceAmount: product.price,
    currency: product.currencyCode,
    packageType: "STORE_PRODUCT",
  };
}

// ─── Purchase a Product ───────────────────────────

async function purchase(productId: string): Promise<PurchaseResult> {
  if (!productId) return { success: false, error: "No product ID provided" };

  try {
    const offerings = await Purchases.getOfferings();
    const pkg = offerings.current?.availablePackages.find(
      (p: PurchasesPackage) => p.product.identifier === productId,
    );

    const purchaseResult = pkg
      ? await Purchases.purchasePackage(pkg)
      : await purchaseStoreProductById(productId);
    const { customerInfo, transaction } = purchaseResult;
    const isPro = isProFromInfo(customerInfo);
    await initializeTransactionLedger(customerInfo);
    await markTransactionProcessed(transaction?.transactionIdentifier);
    const subscriptionTokens = await reconcileSubscriptionTokenGrant(customerInfo);

    return {
      success: true,
      isPro,
      hasUnlimitedTrims: hasUnlimitedTrimsFromInfo(customerInfo),
      tokensGranted: subscriptionTokens,
      transactionId: transaction?.transactionIdentifier,
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

async function purchaseStoreProductById(productId: string) {
  const purchaseType = SUBSCRIPTION_PRODUCT_IDS.has(productId)
    ? PURCHASE_TYPE.SUBS
    : PURCHASE_TYPE.INAPP;
  const products = await Purchases.getProducts([productId], purchaseType);
  const product = products.find((item) => item.identifier === productId);
  if (!product) {
    throw new Error(`Product "${productId}" not available from StoreKit`);
  }
  return Purchases.purchaseStoreProduct(product);
}

// ─── Restore Purchases ───────────────────────────

async function restore(): Promise<PurchaseResult> {
  try {
    const info = await Purchases.restorePurchases();
    await initializeTransactionLedger(info);
    const purchasedTokens = await reconcileNewTokenTransactions(info);
    const subscriptionTokens = await reconcileSubscriptionTokenGrant(info);
    return {
      isPro: isProFromInfo(info),
      hasUnlimitedTrims: hasUnlimitedTrimsFromInfo(info),
      success: purchasedTokens > 0 || subscriptionTokens > 0,
      tokensGranted: purchasedTokens + subscriptionTokens,
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
    const { info, tokensGranted } = await refreshPurchaseState();
    return {
      success: tokensGranted > 0,
      isPro: isProFromInfo(info),
      tokensGranted,
      customerInfo: serializeCustomerInfo(info),
    };
  } catch (err: any) {
    console.error("[RevenueCat] getCustomerInfo error:", err?.message);
    return { isPro: false, error: err?.message };
  }
}

async function redeemOfferCode(): Promise<PurchaseResult> {
  if (Platform.OS !== "ios") {
    return { success: false, error: "Apple offer codes are only available on iOS" };
  }

  if (iosVersion() < 16.3) {
    return {
      success: false,
      error: "Offer codes for purchases require iOS 16.3 or later",
    };
  }

  try {
    const before = await Purchases.getCustomerInfo();
    await initializeTransactionLedger(before);
    const beforeIsPro = isProFromInfo(before);
    const beforeTransactionIds = new Set(
      (before.nonSubscriptionTransactions ?? []).map(
        (transaction) => transaction.transactionIdentifier,
      ),
    );
    await Purchases.presentCodeRedemptionSheet();

    // RevenueCat's redemption-sheet API has no completion callback. Poll briefly
    // after the system sheet closes so both lifetime and token-pack redemptions
    // are reflected in the UI before returning to the Shop screen.
    let latestInfo = before;
    let tokensGranted = 0;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 500));
      try {
        await Purchases.syncPurchases();
      } catch (err) {
        console.log("[RevenueCat] offer-code sync retry failed", getErrorMessage(err));
      }
      latestInfo = await Purchases.getCustomerInfo();
      await reconcileNewTokenTransactions(latestInfo);
      tokensGranted = (latestInfo.nonSubscriptionTransactions ?? [])
        .filter((transaction) => !beforeTransactionIds.has(transaction.transactionIdentifier))
        .reduce(
          (total, transaction) => total + (TOKEN_PACKS[transaction.productIdentifier] ?? 0),
          0,
        );
      if (tokensGranted > 0 || (isProFromInfo(latestInfo) && !beforeIsPro)) break;
    }

    return {
      success: tokensGranted > 0 || (isProFromInfo(latestInfo) && !beforeIsPro),
      isPro: isProFromInfo(latestInfo),
      tokensGranted,
      customerInfo: serializeCustomerInfo(latestInfo),
    };
  } catch (err: any) {
    console.error("[RevenueCat] offer-code redemption error:", err?.message);
    return { success: false, error: err?.message };
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

      if (!isProFromInfo(info)) {
        console.warn("[RevenueCat] Pro entitlement is not active after paywall flow", {
          entitlementId: ENTITLEMENT_ID,
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
      hasUnlimitedTrims: hasUnlimitedTrimsFromInfo(info),
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

// ─── Public helpers used by the native UI (Shop, Home) ────────────────────────

export type ShopProduct = {
  id: string;
  title: string;
  description: string;
  price: string;
  priceAmount: number;
  currency: string;
  packageType?: string;
  /** Number of Trim Tokens this pack grants (0 for lifetime / non-token products). */
  tokens: number;
  /** True if this product unlocks the Lifetime Pro entitlement. */
  isLifetime: boolean;
  /** True if this product is an auto-renewable Pro subscription. */
  isSubscription: boolean;
};

export async function checkProStatus(): Promise<boolean> {
  if (FORCE_PRO_FOR_TESTING) return true;
  const ok = await initializePurchases();
  if (!ok) return false;
  try {
    const { info } = await refreshPurchaseState();
    return isProFromInfo(info);
  } catch (err: any) {
    console.log("[RevenueCat] checkProStatus error:", err?.message);
    return false;
  }
}

export async function getPurchaseAccessStatus(): Promise<{
  isPro: boolean;
  hasUnlimitedTrims: boolean;
}> {
  if (FORCE_PRO_FOR_TESTING) return { isPro: true, hasUnlimitedTrims: true };
  const ok = await initializePurchases();
  if (!ok) return { isPro: false, hasUnlimitedTrims: false };
  try {
    const { info } = await refreshPurchaseState();
    return {
      isPro: isProFromInfo(info),
      hasUnlimitedTrims: hasUnlimitedTrimsFromInfo(info),
    };
  } catch (err: any) {
    console.log("[RevenueCat] getPurchaseAccessStatus error:", err?.message);
    return { isPro: false, hasUnlimitedTrims: false };
  }
}

export async function loadShopProducts(): Promise<ShopProduct[]> {
  const result = await getProducts();
  const products = result.products ?? [];
  return products.map((p) => ({
    ...p,
    tokens: TOKEN_PACKS[p.id] ?? 0,
    isLifetime: p.id === LIFETIME_PRODUCT_ID,
    isSubscription: SUBSCRIPTION_PRODUCT_IDS.has(p.id),
  }));
}

export async function purchaseTokenPack(
  productId: string,
): Promise<{ success: boolean; tokensGranted: number; error?: string }> {
  const ok = await initializePurchases();
  if (!ok) return { success: false, tokensGranted: 0, error: "RevenueCat not configured" };

  const granted = TOKEN_PACKS[productId];
  if (!granted) {
    return { success: false, tokensGranted: 0, error: `Unknown token product: ${productId}` };
  }

  tokenProductsBeingPurchased.add(productId);
  try {
    const result = await purchase(productId);
    if (!result.success) {
      return { success: false, tokensGranted: 0, error: result.error };
    }

    // The transaction was marked as handled in purchase() before the token
    // balance is updated, preventing the foreground listener from double-granting
    // a normal purchase while it is also reconciling StoreKit updates.
    await addTokens(granted, "purchase");
    return { success: true, tokensGranted: granted };
  } finally {
    tokenProductsBeingPurchased.delete(productId);
  }
}

export async function purchaseLifetime(): Promise<{
  success: boolean;
  isPro: boolean;
  tokensGranted: number;
  error?: string;
}> {
  const ok = await initializePurchases();
  if (!ok) {
    return { success: false, isPro: false, tokensGranted: 0, error: "RevenueCat not configured" };
  }

  const result = await purchase(LIFETIME_PRODUCT_ID);
  return {
    success: result.success === true,
    isPro: result.isPro === true,
    tokensGranted: result.tokensGranted ?? 0,
    error: result.error,
  };
}

export async function purchaseSubscription(productId: string): Promise<{
  success: boolean;
  isPro: boolean;
  tokensGranted: number;
  error?: string;
}> {
  const ok = await initializePurchases();
  if (!ok) {
    return { success: false, isPro: false, tokensGranted: 0, error: "RevenueCat not configured" };
  }
  if (!SUBSCRIPTION_PRODUCT_IDS.has(productId)) {
    return {
      success: false,
      isPro: false,
      tokensGranted: 0,
      error: `Unknown subscription product: ${productId}`,
    };
  }

  const result = await purchase(productId);
  return {
    success: result.success === true,
    isPro: result.isPro === true,
    tokensGranted: result.tokensGranted ?? 0,
    error: result.error,
  };
}

export async function restorePurchasesPublic(): Promise<boolean> {
  const ok = await initializePurchases();
  if (!ok) return false;
  const result = await restore();
  return result.isPro === true;
}

export async function presentPaywallPublic(): Promise<boolean> {
  const ok = await initializePurchases();
  if (!ok) return false;
  const result = await presentPaywall();
  return result.success === true || result.isPro === true;
}

export async function redeemOfferCodePublic(): Promise<{
  success: boolean;
  isPro: boolean;
  tokensGranted: number;
  error?: string;
}> {
  const ok = await initializePurchases();
  if (!ok) {
    return { success: false, isPro: false, tokensGranted: 0, error: "RevenueCat not configured" };
  }
  const result = await redeemOfferCode();
  return {
    success: result.success === true,
    isPro: result.isPro === true,
    tokensGranted: result.tokensGranted ?? 0,
    error: result.error,
  };
}
