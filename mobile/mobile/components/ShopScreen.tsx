import { t } from "../lib/i18n";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Platform,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { colors, radius, shadow, spacing, type } from "../constants/design";
import { Card, Pill, SectionHeader } from "./ui/primitives";
import {
  getPurchaseAccessStatus,
  loadShopProducts,
  purchaseLifetime,
  purchaseSubscription,
  purchaseTokenPack,
  redeemOfferCodePublic,
  restorePurchasesPublic,
  LIFETIME_PRODUCT_ID,
  MONTHLY_PRODUCT_ID,
  YEARLY_PRODUCT_ID,
  type ShopProduct,
} from "../lib/purchases";
import {
  DAILY_CLAIM_TOKENS,
  REWARDED_AD_TOKENS,
  TOKEN_PACKS,
  subscribeTokens,
} from "../lib/tokens";
import { showRewardedAd } from "../lib/ads";
import type { DailyRewardState } from "./HomeDashboard";

export type ShopScreenProps = {
  onBack: () => void;
  onToast?: (
    title: string,
    detail?: string,
    tone?: "info" | "success" | "warning" | "error",
  ) => void;
  dailyReward?: DailyRewardState;
  onClaimDailyTokens?: () => void;
  onProStatusChange?: (isPro: boolean, hasUnlimitedTrims?: boolean) => void;
};

const TOKEN_ORDER = ["tokens_50", "tokens_100", "tokens_200", "tokens_500"];
const LEGAL_LINKS = [
  {
    label: "Terms",
    url: process.env.EXPO_PUBLIC_TERMS_URL ?? "https://trimswipe.lovable.app/terms",
  },
  {
    label: "Privacy",
    url: process.env.EXPO_PUBLIC_PRIVACY_URL ?? "https://trimswipe.lovable.app/privacy",
  },
  {
    label: t("ui.apple-eula"),
    url: "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/",
  },
] as const;
const PREMIUM_PLANS = [
  {
    key: "monthly",
    label: "Monthly",
    productId: MONTHLY_PRODUCT_ID,
    cadence: "per month",
    tokens: 250,
  },
  {
    key: "yearly",
    label: "Yearly",
    productId: YEARLY_PRODUCT_ID,
    cadence: "per year",
    tokens: 500,
  },
  {
    key: "lifetime",
    label: "Lifetime",
    productId: LIFETIME_PRODUCT_ID,
    cadence: "one-time",
    tokens: 0,
  },
] as const;
type PremiumPlanKey = (typeof PREMIUM_PLANS)[number]["key"];

export function ShopScreen({
  onBack,
  onToast,
  dailyReward,
  onClaimDailyTokens,
  onProStatusChange,
}: ShopScreenProps) {
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [adBusy, setAdBusy] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [hasUnlimitedTrims, setHasUnlimitedTrims] = useState(false);
  const [activeProductId, setActiveProductId] = useState<string | null>(null);
  const [tokens, setTokens] = useState(0);
  const [selectedPlan, setSelectedPlan] = useState<PremiumPlanKey>("lifetime");
  const adShine = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const unsub = subscribeTokens((s) => setTokens(s.tokens));
    return () => unsub();
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [list, access] = await Promise.all([loadShopProducts(), getPurchaseAccessStatus()]);
        if (!alive) return;
        setProducts(list);
        setIsPro(access.isPro);
        setHasUnlimitedTrims(access.hasUnlimitedTrims);
        setActiveProductId(access.activeProductId);
        if (access.activeProductId === MONTHLY_PRODUCT_ID) {
          setSelectedPlan("yearly");
        } else if (access.activeProductId === YEARLY_PRODUCT_ID) {
          setSelectedPlan("lifetime");
        }
        onProStatusChange?.(access.isPro, access.hasUnlimitedTrims);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const shineLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(adShine, {
          toValue: 1,
          duration: 920,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.delay(7080),
      ]),
    );
    shineLoop.start();
    return () => shineLoop.stop();
  }, [adShine]);

  const tokenPacks = TOKEN_ORDER.map(
    (id) => products.find((p) => p.id === id) ?? fallbackPack(id),
  ).filter(Boolean) as ShopProduct[];
  const premiumProducts = PREMIUM_PLANS.map(({ key, productId, label, cadence, tokens }) => ({
    key,
    label,
    cadence,
    tokens,
    product: products.find((p) => p.id === productId) ?? fallbackPremiumProduct(key, productId),
  }));
  const monthlyPremium = premiumProducts.find((plan) => plan.key === "monthly")?.product;
  const yearlyPremium = premiumProducts.find((plan) => plan.key === "yearly")?.product;
  const yearlySavingsPercent =
    monthlyPremium &&
    yearlyPremium &&
    monthlyPremium.currency === yearlyPremium.currency &&
    monthlyPremium.priceAmount > 0 &&
    yearlyPremium.priceAmount < monthlyPremium.priceAmount * 12
      ? Math.round((1 - yearlyPremium.priceAmount / (monthlyPremium.priceAmount * 12)) * 100)
      : 0;
  const selectedPremium =
    premiumProducts.find((plan) => plan.key === selectedPlan) ?? premiumProducts[2];
  const selectedProduct = selectedPremium.product;
  const selectedIntroOffer = formatIntroductoryOffer(selectedProduct);
  const selectedPlanAction =
    selectedIntroOffer && !isPro
      ? t("ui.start-free-trial")
      : isPro
        ? selectedPlan === "lifetime"
          ? t("ui.buy-lifetime-pro")
          : selectedPlan === "yearly" && activeProductId === MONTHLY_PRODUCT_ID
            ? t("ui.upgrade-to-yearly-pro")
            : t("ui.switch-plan")
        : t("ui.unlock-pro");

  async function handleBuyTokens(id: string) {
    if (busy) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setBusy(id);
    try {
      const res = await purchaseTokenPack(id);
      if (res.success) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onToast?.(t("ui.tokens-added"), `+${res.tokensGranted} tokens added to your balance.`, "success");
      } else if (res.error && res.error !== "cancelled") {
        onToast?.(t("ui.purchase-failed"), res.error, "error");
      }
    } finally {
      setBusy(null);
    }
  }

  async function handleBuyPremium() {
    if (busy) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setBusy(selectedProduct.id);
    try {
      const res =
        selectedPlan === "lifetime"
          ? await purchaseLifetime()
          : await purchaseSubscription(selectedProduct.id);
      if (res.success && res.isPro) {
        setIsPro(true);
        setHasUnlimitedTrims(res.hasUnlimitedTrims);
        setActiveProductId(res.activeProductId ?? selectedProduct.id);
        onProStatusChange?.(true, res.hasUnlimitedTrims);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onToast?.(
          t("ui.welcome-to-pro"),
          selectedPlan === "lifetime"
            ? t("ui.unlimited-trims-and-an-ad-free-experience-are-un")
            : `${selectedPremium.label} Pro is now active. Your subscription is managed by Apple.${
                res.tokensGranted > 0 ? ` +${res.tokensGranted} tokens added.` : ""
              }`,
          "success",
        );
      } else if (res.error && res.error !== "cancelled") {
        onToast?.(t("ui.purchase-failed"), res.error, "error");
      }
    } finally {
      setBusy(null);
    }
  }

  async function handleOpenLegalLink(label: string, url: string) {
    try {
      await Linking.openURL(url);
    } catch {
      onToast?.(t("ui.could-not-open-link"), `Please try opening the ${label} link again.`, "error");
    }
  }

  async function handleRestore() {
    setBusy("restore");
    try {
      await restorePurchasesPublic();
      const access = await getPurchaseAccessStatus();
      setIsPro(access.isPro);
      setHasUnlimitedTrims(access.hasUnlimitedTrims);
      setActiveProductId(access.activeProductId);
      onProStatusChange?.(access.isPro, access.hasUnlimitedTrims);
      onToast?.(
        access.isPro ? "Restored" : t("ui.nothing-to-restore"),
        access.isPro
          ? t("ui.premium-access-restored")
          : t("ui.no-active-purchases-were-found-for-this-apple-id"),
        access.isPro ? "success" : "warning",
      );
    } finally {
      setBusy(null);
    }
  }

  async function handleRedeemOfferCode() {
    if (busy) return;
    setBusy("redeem");
    try {
      const result = await redeemOfferCodePublic();
      if (result.success) {
        setIsPro(result.isPro);
        const access = await getPurchaseAccessStatus();
        setHasUnlimitedTrims(access.hasUnlimitedTrims);
        onProStatusChange?.(result.isPro, access.hasUnlimitedTrims);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (result.tokensGranted > 0) {
          onToast?.(
            t("ui.code-redeemed"),
            `+${result.tokensGranted} tokens added to your balance.`,
            "success",
          );
        } else if (result.isPro) {
          onToast?.(t("ui.code-redeemed"), t("ui.pro-access-is-now-unlocked"), "success");
        } else {
          onToast?.(t("ui.code-redeemed"), t("ui.your-purchase-is-being-synced-with-apple"), "success");
        }
      } else if (result.error) {
        onToast?.(t("ui.code-not-redeemed"), result.error, "error");
      }
    } finally {
      setBusy(null);
    }
  }

  async function handleWatchAd() {
    if (adBusy) return;
    setAdBusy(true);
    try {
      const got = await showRewardedAd();
      if (got > 0) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onToast?.(t("ui.tokens-added"), `+${got} tokens added.`, "success");
      } else {
        onToast?.(t("ui.no-ad-available"), t("ui.try-again-in-a-moment"), "warning");
      }
    } finally {
      setAdBusy(false);
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={onBack} hitSlop={12} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={colors.primary} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={type.eyebrow}>{t("ui.shop")}</Text>
            <Text style={styles.title}>{t("ui.trim-tokens")}</Text>
          </View>
          <View style={styles.balance}>
            <Ionicons name="flash" size={16} color={colors.honey} />
            <Text style={styles.balanceValue}>{hasUnlimitedTrims ? "∞" : tokens}</Text>
          </View>
        </View>

        {isPro ? (
          <Card style={[styles.proCard]} tone="warm">
            <View style={{ flex: 1 }}>
              <Text style={type.eyebrow}>{t("ui.trimswipe-pro")}</Text>
              <Text style={styles.proTitle}>{"You're all set"}</Text>
              <Text style={styles.proSub}>
                {hasUnlimitedTrims
                  ? t("ui.unlimited-trims-no-ads-forever")
                  : t("ui.subscription-tokens-no-ads")}
              </Text>
            </View>
            <Ionicons name="diamond" size={28} color={colors.primary} />
          </Card>
        ) : null}

        {!isPro || !hasUnlimitedTrims ? (
          <View style={styles.lifetimeModal}>
            <View style={styles.lifetimeRibbon}>
              <Ionicons name="diamond" size={14} color={colors.white} />
              <Text style={styles.lifetimeRibbonText}>{t("ui.unlock-pro")}</Text>
            </View>
            <View style={styles.planTabs}>
              {premiumProducts.map((plan) => {
                const selected = plan.key === selectedPlan;
                const hasTrial = plan.product.introEligible && plan.product.introPrice?.price === 0;
                const offerBadge =
                  plan.key === "yearly" && yearlySavingsPercent > 0
                    ? `Save ${yearlySavingsPercent}%`
                    : plan.key === "lifetime"
                      ? t("ui.best-offer")
                      : null;
                return (
                  <Pressable
                    key={plan.key}
                    onPress={() => setSelectedPlan(plan.key)}
                    style={[styles.planTab, selected && styles.planTabActive]}
                  >
                    <Text style={[styles.planTabLabel, selected && styles.planTabLabelActive]}>
                      {plan.label}
                    </Text>
                    <Text style={[styles.planTabPrice, selected && styles.planTabPriceActive]}>
                      {plan.product.price}
                    </Text>
                    {hasTrial || offerBadge ? (
                      <View style={styles.planTabMetaRow}>
                        {hasTrial ? <Text style={styles.planTabTrial}>{t("ui.free-trial")}</Text> : null}
                        {offerBadge ? (
                          <View
                            style={[
                              styles.planTabOfferPill,
                              plan.key === "lifetime" && styles.planTabBestOfferPill,
                            ]}
                          >
                            <Text style={styles.planTabOfferText}>{offerBadge}</Text>
                          </View>
                        ) : null}
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.lifetimeHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.lifetimeBigTitle}>Go {selectedPremium.label} Pro</Text>
                <Text style={styles.lifetimeBigSub}>
                  {selectedPlan === "lifetime"
                    ? t("ui.one-payment-every-benefit-forever")
                    : `Full access, billed ${selectedPremium.cadence}.`}
                </Text>
                {selectedIntroOffer ? (
                  <Text style={styles.trialText}>{selectedIntroOffer}</Text>
                ) : null}
              </View>
              <View style={styles.lifetimePriceBlock}>
                <Text style={styles.lifetimeBigPrice}>{selectedProduct.price}</Text>
                <Text style={styles.lifetimePriceHint}>{selectedPremium.cadence}</Text>
              </View>
            </View>
            <View style={styles.lifetimeBenefits}>
              {[
                selectedPremium.tokens > 0
                  ? `${selectedPremium.tokens} Trim Tokens every month`
                  : t("ui.unlimited-trim-tokens"),
                t("ui.no-ads-ever"),
                t("ui.multi-preset-trim-stack-actions"),
                t("ui.priority-new-features"),
              ].map((b) => (
                <View key={b} style={styles.lifetimeBenefitRow}>
                  <View style={styles.lifetimeCheck}>
                    <Ionicons name="checkmark" size={14} color={colors.white} />
                  </View>
                  <Text style={styles.lifetimeBenefitText}>{b}</Text>
                </View>
              ))}
            </View>
            <Pressable
              disabled={busy === selectedProduct.id || selectedProduct.id === activeProductId}
              onPress={() => void handleBuyPremium()}
              style={[styles.cta, styles.ctaPrimary]}
            >
              {busy === selectedProduct.id ? (
                <ActivityIndicator color={colors.white} />
              ) : selectedProduct.id === activeProductId ? (
                <Text style={styles.ctaText}>{t("ui.current-plan")}</Text>
              ) : (
                <Text style={styles.ctaText}>
                  {selectedPlanAction} · {selectedProduct.price}
                </Text>
              )}
            </Pressable>
            <View style={styles.planLegalLinks}>
              {LEGAL_LINKS.map((link, index) => (
                <View key={link.label} style={styles.planLegalLinkItem}>
                  {index > 0 ? <Text style={styles.planLegalSeparator}>|</Text> : null}
                  <Pressable
                    accessibilityRole="link"
                    accessibilityLabel={`Open ${link.label}`}
                    hitSlop={8}
                    onPress={() => void handleOpenLegalLink(link.label, link.url)}
                  >
                    <Text style={styles.planLegalLinkText}>{link.label}</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {Platform.OS === "ios" ? (
          <Pressable
            disabled={busy === "redeem"}
            onPress={() => void handleRedeemOfferCode()}
            style={styles.redeemCard}
          >
            <View style={styles.redeemIcon}>
              <Ionicons name="pricetag-outline" size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.redeemTitle}>{t("ui.have-an-offer-code")}</Text>
              <Text style={styles.redeemSub}>{t("ui.redeem-a-free-or-discounted-apple-purchase")}</Text>
            </View>
            {busy === "redeem" ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Text style={styles.redeemAction}>{t("ui.redeem")}</Text>
            )}
          </Pressable>
        ) : null}

        {!isPro ? (
          <>
            <SectionHeader title={t("ui.free-tokens")} />
            <Pressable
              disabled={!dailyReward?.canClaimToday || dailyReward.claimedToday}
              onPress={onClaimDailyTokens}
              style={[
                styles.dailyClaimCard,
                (!dailyReward?.canClaimToday || dailyReward.claimedToday) &&
                  styles.dailyClaimCardDisabled,
              ]}
            >
              <View style={styles.dailyClaimIcon}>
                <Ionicons name="gift-outline" size={25} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.dailyClaimTitle}>
                  {dailyReward?.claimedToday ? t("ui.daily-tokens-claimed") : t("ui.claim-daily-tokens")}
                </Text>
                <Text style={styles.dailyClaimSub}>
                  +{dailyReward?.rewardAmount ?? DAILY_CLAIM_TOKENS} free tokens - resets at{" "}
                  {dailyReward?.nextResetLabel ?? "00:00"}
                </Text>
              </View>
              <Text style={styles.dailyClaimButtonText}>
                {dailyReward?.claimedToday ? "Done" : "Claim"}
              </Text>
            </Pressable>
            <Pressable disabled={adBusy} onPress={handleWatchAd} style={styles.adCard}>
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.adShine,
                  {
                    opacity: adShine.interpolate({
                      inputRange: [0, 0.15, 0.75, 1],
                      outputRange: [0, 0.85, 0.85, 0],
                    }),
                    transform: [
                      {
                        translateX: adShine.interpolate({
                          inputRange: [0, 1],
                          outputRange: [-140, 390],
                        }),
                      },
                      { rotate: "18deg" },
                    ],
                  },
                ]}
              />
              <View style={styles.adIcon}>
                <Ionicons name="play-circle" size={28} color={colors.sage} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.adTitle}>{t("ui.watch-a-short-ad")}</Text>
                <Text style={styles.adSub}>Get +{REWARDED_AD_TOKENS} tokens</Text>
              </View>
              {adBusy ? (
                <ActivityIndicator color={colors.sage} />
              ) : (
                <Ionicons name="add-circle" size={26} color={colors.sage} />
              )}
            </Pressable>
          </>
        ) : null}

        <SectionHeader title={t("ui.token-packs")} />
        {loading ? (
          <Card style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>{t("ui.loading-offers")}</Text>
          </Card>
        ) : (
          <View style={{ gap: spacing.md }}>
            {tokenPacks.map((pack) => {
              const isBest = pack.id === "tokens_500";
              return (
                <Pressable
                  key={pack.id}
                  disabled={busy === pack.id}
                  onPress={() => handleBuyTokens(pack.id)}
                  style={({ pressed }) => [styles.pack, pressed && { opacity: 0.85 }]}
                >
                  <View style={styles.packIcon}>
                    <Ionicons name="flash" size={22} color={colors.honey} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.packTitleRow}>
                      <Text style={styles.packTokens}>{pack.tokens} tokens</Text>
                      {isBest ? (
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>{t("ui.best")}</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.packHint}>{t("ui.consumable-token-pack")}</Text>
                  </View>
                  <View style={styles.priceWrap}>
                    {busy === pack.id ? (
                      <ActivityIndicator color={colors.primary} />
                    ) : (
                      <Text style={styles.packPrice}>{pack.price}</Text>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        <Pressable disabled={busy === "restore"} onPress={handleRestore} style={styles.restore}>
          {busy === "restore" ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={styles.restoreText}>{t("ui.restore-purchases")}</Text>
          )}
        </Pressable>

        <Text style={styles.legal}>
          Purchases are processed by Apple and charged to your Apple Account at confirmation.
          TrimSwipe Pro is available as an auto-renewable monthly or yearly subscription, or as a
          one-time Lifetime purchase. Subscriptions renew automatically for the same period and
          price unless auto-renew is turned off at least 24 hours before the end of the current
          period. Manage or cancel anytime in Apple Account → Subscriptions. Token packs are
          one-time consumable purchases and are non-refundable once used.
        </Text>

        <View style={styles.legalLinks}>
          <Pressable onPress={() => Linking.openURL("https://trimswipe.lovable.app/terms")}>
            <Text style={styles.legalLink}>{t("ui.terms-of-use-eula")}</Text>
          </Pressable>
          <Text style={styles.legalDot}>·</Text>
          <Pressable onPress={() => Linking.openURL("https://trimswipe.lovable.app/privacy")}>
            <Text style={styles.legalLink}>{t("ui.privacy-policy")}</Text>
          </Pressable>
        </View>


        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

function formatIntroductoryOffer(product: ShopProduct): string | null {
  const intro = product.introPrice;
  if (!product.isSubscription || !product.introEligible || !intro || intro.price !== 0) {
    return null;
  }

  const unit = intro.periodUnit.toLowerCase();
  const pluralUnit = intro.periodNumberOfUnits === 1 ? unit : unit + "s";
  const duration = String(intro.periodNumberOfUnits) + " " + pluralUnit;
  const cadence = product.id === MONTHLY_PRODUCT_ID ? "per month" : "per year";
  return "Free for " + duration + ", then " + product.price + " " + cadence + ".";
}

function fallbackPack(id: string): ShopProduct | null {
  const tokens = TOKEN_PACKS[id];
  if (!tokens) return null;
  return {
    id,
    title: `${tokens} Trim Tokens`,
    description: t("ui.token-pack"),
    price: "—",
    priceAmount: 0,
    currency: "USD",
    tokens,
    isLifetime: false,
    isSubscription: false,
  };
}

function fallbackPremiumProduct(key: PremiumPlanKey, id: string): ShopProduct {
  const details = {
    monthly: {
      title: t("ui.monthly-pro"),
      description: t("ui.250-trim-tokens-every-month-and-no-ads"),
      price: "$2.99",
      priceAmount: 2.99,
    },
    yearly: {
      title: t("ui.yearly-pro"),
      description: t("ui.500-trim-tokens-every-month-and-no-ads"),
      price: "$24.99",
      priceAmount: 24.99,
    },
    lifetime: {
      title: t("ui.lifetime-pro"),
      description: t("ui.unlimited-trims-and-no-ads-forever"),
      price: "$49.99",
      priceAmount: 49.99,
    },
  }[key];

  return {
    id,
    title: details.title,
    description: details.description,
    price: details.price,
    priceAmount: details.priceAmount,
    currency: "USD",
    tokens: 0,
    isLifetime: key === "lifetime",
    isSubscription: key !== "lifetime",
  };
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: 40,
    gap: spacing.lg,
  },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { ...type.title, color: colors.text, marginTop: 2 },
  balance: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.honeySoft,
  },
  balanceValue: { fontWeight: "700", fontSize: 16, color: colors.honey },

  proCard: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  proTitle: { ...type.title, color: colors.primary, marginTop: 2 },
  proSub: { ...type.body, color: colors.textMuted },

  lifetimeCard: { gap: spacing.md },
  lifetimeRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  lifetimeTitle: { ...type.title, color: colors.primary, marginTop: 6 },
  lifetimeSub: { ...type.body, color: colors.textMuted, marginTop: 2 },
  lifetimePrice: { fontSize: 22, fontWeight: "700", color: colors.primary },

  // New prominent Lifetime Pro hero modal
  lifetimeModal: {
    backgroundColor: "#1f2937",
    borderRadius: radius.xl ?? 24,
    padding: spacing.xl,
    gap: spacing.md,
    borderWidth: 2,
    borderColor: colors.primary,
    ...shadow.press,
  },
  lifetimeRibbon: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  lifetimeRibbonText: { color: colors.white, fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  planTabs: {
    flexDirection: "row",
    gap: 6,
    padding: 5,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  planTab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 76,
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 4,
  },
  planTabActive: { backgroundColor: colors.white },
  planTabLabel: { color: "#cbd8e0", fontSize: 12, fontWeight: "700" },
  planTabLabelActive: { color: colors.primary },
  planTabPrice: { marginTop: 3, color: "#ffffff", fontSize: 13, fontWeight: "700" },
  planTabPriceActive: { color: colors.text },
  planTabMetaRow: { marginTop: 4, minHeight: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3, flexWrap: "wrap" },
  planTabTrial: { color: "#cbd8e0", fontSize: 7, fontWeight: "800" },
  planTabOfferPill: { borderRadius: radius.pill, backgroundColor: colors.honey, paddingHorizontal: 6, paddingVertical: 3 },
  planTabBestOfferPill: { backgroundColor: colors.primaryBright },
  planTabOfferText: { color: colors.white, fontSize: 7, fontWeight: "800" },
  lifetimeHeaderRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  lifetimeBigTitle: { fontSize: 26, fontWeight: "700", color: colors.white, letterSpacing: -0.5 },
  lifetimeBigSub: { fontSize: 13, color: "#cbd5e1", marginTop: 4, fontWeight: "600" },
  trialText: { fontSize: 12, color: "#cbd8e0", marginTop: 5, fontWeight: "800" },
  lifetimePriceBlock: { alignItems: "flex-end" },
  lifetimeBigPrice: { fontSize: 28, fontWeight: "700", color: colors.honey },
  lifetimePriceHint: { fontSize: 11, color: "#94a3b8", fontWeight: "700" },
  lifetimeBenefits: { gap: 8, marginTop: 2 },
  lifetimeBenefitRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  lifetimeCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  lifetimeBenefitText: { color: colors.white, fontSize: 14, fontWeight: "700", flex: 1 },

  cta: {
    height: 50,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaPrimary: { backgroundColor: colors.primary, ...shadow.press },
  ctaDisabled: { opacity: 0.5 },
  ctaText: { color: colors.white, fontWeight: "800", fontSize: 16 },
  planLegalLinks: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingTop: 2,
  },
  planLegalLinkItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  planLegalSeparator: { color: "#64748b", fontSize: 11 },
  planLegalLinkText: {
    color: "#e2e8f0",
    fontSize: 11,
    fontWeight: "700",
    textDecorationLine: "underline",
  },

  loading: { alignItems: "center", paddingVertical: spacing.xl, gap: spacing.sm },
  loadingText: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },

  pack: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...shadow.soft,
  },
  packIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.honeySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  packTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  packTokens: { fontSize: 17, fontWeight: "700", color: colors.text },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  badgeText: { color: colors.white, fontSize: 10, fontWeight: "700", letterSpacing: 0.8 },
  packHint: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  priceWrap: { minWidth: 72, alignItems: "flex-end" },
  packPrice: { fontSize: 16, fontWeight: "800", color: colors.primary },

  adCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.sageSoft,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.sage,
    overflow: "hidden",
    position: "relative",
  },
  adShine: {
    position: "absolute",
    top: -28,
    bottom: -28,
    left: 0,
    width: 72,
    backgroundColor: "rgba(255,255,255,0.55)",
  },
  dailyClaimCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primary,
    ...shadow.soft,
  },
  dailyClaimCardDisabled: { opacity: 0.68, borderColor: colors.border },
  dailyClaimIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  dailyClaimTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  dailyClaimSub: { fontSize: 12, color: colors.textMuted, marginTop: 2, fontWeight: "700" },
  dailyClaimButtonText: { color: colors.primary, fontSize: 13, fontWeight: "700" },
  adIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  adTitle: { fontSize: 16, fontWeight: "800", color: colors.sageDeep },
  adSub: { fontSize: 13, color: colors.sageDeep, marginTop: 2, fontWeight: "600" },

  restore: { alignItems: "center", paddingVertical: spacing.md, marginTop: spacing.sm },
  restoreText: { color: colors.primary, fontWeight: "800", fontSize: 14 },
  redeemCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primary,
  },
  redeemIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  redeemTitle: { fontSize: 15, fontWeight: "700", color: colors.primary },
  redeemSub: { fontSize: 12, color: colors.textMuted, marginTop: 2, fontWeight: "600" },
  redeemAction: { color: colors.primary, fontWeight: "700", fontSize: 13 },
  legal: {
    fontSize: 11,
    color: colors.textSubtle,
    textAlign: "center",
    lineHeight: 16,
    marginTop: spacing.sm,
  },
  legalLinks: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  legalLink: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  legalDot: {
    fontSize: 11,
    color: colors.textSubtle,
  },
});
