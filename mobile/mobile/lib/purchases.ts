// RevenueCat purchase handling for the native bridge.
// This module is prepared for RevenueCat integration.
// To activate: 
//   1. `npx expo install react-native-purchases` in mobile/mobile/
//   2. Set your RevenueCat API key in the configure() call below
//   3. Create products in RevenueCat dashboard matching your App Store Connect products
//   4. Uncomment the RevenueCat code below

// import Purchases, { PurchasesPackage } from 'react-native-purchases';

const REVENUECAT_API_KEY = ''; // TODO: Set your RevenueCat Apple API key

type PurchaseRequest = {
  productId?: string;
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
  }>;
};

let configured = false;

async function ensureConfigured() {
  if (configured) return;
  configured = true;

  if (!REVENUECAT_API_KEY) {
    console.warn('[Purchases] RevenueCat API key not set. Purchases are disabled.');
    return;
  }

  // Uncomment when react-native-purchases is installed:
  // Purchases.configure({ apiKey: REVENUECAT_API_KEY });
}

export async function handlePurchaseMessage(
  method: string,
  data: PurchaseRequest
): Promise<PurchaseResult> {
  await ensureConfigured();

  switch (method) {
    case 'purchases_checkPro':
      return checkPro();
    case 'purchases_getProducts':
      return getProducts();
    case 'purchases_purchase':
      return purchase(data.productId || '');
    case 'purchases_restore':
      return restore();
    default:
      throw new Error(`Unknown purchase method: ${method}`);
  }
}

async function checkPro(): Promise<PurchaseResult> {
  if (!REVENUECAT_API_KEY) return { isPro: false };

  // Uncomment when ready:
  // try {
  //   const customerInfo = await Purchases.getCustomerInfo();
  //   const isPro = customerInfo.entitlements.active['pro'] !== undefined;
  //   return { isPro };
  // } catch {
  //   return { isPro: false };
  // }

  return { isPro: false };
}

async function getProducts(): Promise<PurchaseResult> {
  if (!REVENUECAT_API_KEY) return { products: [] };

  // Uncomment when ready:
  // try {
  //   const offerings = await Purchases.getOfferings();
  //   const packages = offerings.current?.availablePackages || [];
  //   return {
  //     products: packages.map((pkg: PurchasesPackage) => ({
  //       id: pkg.product.identifier,
  //       title: pkg.product.title,
  //       description: pkg.product.description,
  //       price: pkg.product.priceString,
  //       priceAmount: pkg.product.price,
  //       currency: pkg.product.currencyCode,
  //     })),
  //   };
  // } catch {
  //   return { products: [] };
  // }

  return { products: [] };
}

async function purchase(productId: string): Promise<PurchaseResult> {
  if (!REVENUECAT_API_KEY || !productId) return { success: false };

  // Uncomment when ready:
  // try {
  //   const offerings = await Purchases.getOfferings();
  //   const pkg = offerings.current?.availablePackages.find(
  //     (p: PurchasesPackage) => p.product.identifier === productId
  //   );
  //   if (!pkg) return { success: false };
  //   const { customerInfo } = await Purchases.purchasePackage(pkg);
  //   const isPro = customerInfo.entitlements.active['pro'] !== undefined;
  //   return { success: isPro, isPro };
  // } catch {
  //   return { success: false };
  // }

  return { success: false };
}

async function restore(): Promise<PurchaseResult> {
  if (!REVENUECAT_API_KEY) return { isPro: false };

  // Uncomment when ready:
  // try {
  //   const customerInfo = await Purchases.restorePurchases();
  //   const isPro = customerInfo.entitlements.active['pro'] !== undefined;
  //   return { isPro };
  // } catch {
  //   return { isPro: false };
  // }

  return { isPro: false };
}
