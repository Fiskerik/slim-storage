import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { colors, radius, shadow, spacing, type } from "../constants/design";
import { Card, Pill, SectionHeader } from "./ui/primitives";
import {
  checkProStatus,
  loadShopProducts,
  purchaseLifetime,
  purchaseTokenPack,
  restorePurchasesPublic,
  type ShopProduct,
} from "../lib/purchases";
import {
  REWARDED_AD_TOKENS,
  TOKEN_PACKS,
  subscribeTokens,
} from "../lib/tokens";
import { showRewardedAd } from "../lib/ads";

export type ShopScreenProps = {
  onBack: () => void;
};

const TOKEN_ORDER = ["tokens_50", "tokens_100", "tokens_200", "tokens_500"];

export function ShopScreen({ onBack }: ShopScreenProps) {
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [adBusy, setAdBusy] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [tokens, setTokens] = useState(0);

  useEffect(() => {
    const unsub = subscribeTokens((s) => setTokens(s.tokens));
    return () => unsub();
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [list, pro] = await Promise.all([loadShopProducts(), checkProStatus()]);
        if (!alive) return;
        setProducts(list);
        setIsPro(pro);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const tokenPacks = TOKEN_ORDER
    .map((id) => products.find((p) => p.id === id) ?? fallbackPack(id))
    .filter(Boolean) as ShopProduct[];
  const lifetime = products.find((p) => p.isLifetime) ?? fallbackLifetime();

  async function handleBuyTokens(id: string) {
    if (busy) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setBusy(id);
    try {
      const res = await purchaseTokenPack(id);
      if (res.success) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("Tokens added", `+${res.tokensGranted} Trim Tokens added to your balance.`);
      } else if (res.error && res.error !== "cancelled") {
        Alert.alert("Purchase failed", res.error);
      }
    } finally {
      setBusy(null);
    }
  }

  async function handleBuyLifetime() {
    if (busy) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setBusy(lifetime.id);
    try {
      const res = await purchaseLifetime();
      if (res.success && res.isPro) {
        setIsPro(true);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("Welcome to Pro!", "Unlimited trims and an ad-free experience are unlocked.");
      } else if (res.error && res.error !== "cancelled") {
        Alert.alert("Purchase failed", res.error);
      }
    } finally {
      setBusy(null);
    }
  }

  async function handleRestore() {
    setBusy("restore");
    try {
      const pro = await restorePurchasesPublic();
      setIsPro(pro);
      Alert.alert(pro ? "Restored" : "Nothing to restore", pro ? "Lifetime Pro restored." : "No previous purchases were found for this Apple ID.");
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
        Alert.alert("Thanks!", `+${got} Trim Tokens added.`);
      } else {
        Alert.alert("No ad available", "Try again in a moment.");
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
            <Text style={type.eyebrow}>Shop</Text>
            <Text style={styles.title}>Trim Tokens</Text>
          </View>
          <View style={styles.balance}>
            <Ionicons name="flash" size={16} color={colors.honey} />
            <Text style={styles.balanceValue}>{isPro ? "∞" : tokens}</Text>
          </View>
        </View>

        {isPro ? (
          <Card style={[styles.proCard]} tone="warm">
            <View style={{ flex: 1 }}>
              <Text style={type.eyebrow}>Lifetime Pro</Text>
              <Text style={styles.proTitle}>You're all set</Text>
              <Text style={styles.proSub}>Unlimited trims · no ads · forever</Text>
            </View>
            <Ionicons name="diamond" size={28} color={colors.primary} />
          </Card>
        ) : (
          <View style={styles.lifetimeModal}>
            <View style={styles.lifetimeRibbon}>
              <Ionicons name="diamond" size={14} color={colors.white} />
              <Text style={styles.lifetimeRibbonText}>LIMITED OFFER · LIFETIME</Text>
            </View>
            <View style={styles.lifetimeHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.lifetimeBigTitle}>Go Lifetime Pro</Text>
                <Text style={styles.lifetimeBigSub}>
                  One payment. Every benefit. Forever.
                </Text>
              </View>
              <View style={styles.lifetimePriceBlock}>
                <Text style={styles.lifetimeBigPrice}>{lifetime?.price ?? "$24.99"}</Text>
                <Text style={styles.lifetimePriceHint}>one-time</Text>
              </View>
            </View>
            <View style={styles.lifetimeBenefits}>
              {[
                "Unlimited Trim Tokens",
                "No ads — ever",
                "Multi-preset trim (stack actions)",
                "Priority new features",
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
              disabled={busy === lifetime.id}
              onPress={handleBuyLifetime}
              style={[styles.cta, styles.ctaPrimary]}
            >
              {busy === lifetime.id ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.ctaText}>
                  Unlock Lifetime Pro · {lifetime?.price ?? "$24.99"}
                </Text>
              )}
            </Pressable>
          </View>
        )}

        {!isPro ? (
          <>
            <SectionHeader title="Free tokens" />
            <Pressable disabled={adBusy} onPress={handleWatchAd} style={styles.adCard}>
              <View style={styles.adIcon}>
                <Ionicons name="play-circle" size={28} color={colors.sage} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.adTitle}>Watch a short ad</Text>
                <Text style={styles.adSub}>Get +{REWARDED_AD_TOKENS} Trim Tokens</Text>
              </View>
              {adBusy ? (
                <ActivityIndicator color={colors.sage} />
              ) : (
                <Ionicons name="add-circle" size={26} color={colors.sage} />
              )}
            </Pressable>
          </>
        ) : null}

        <SectionHeader title="Token packs" />
        {loading ? (
          <Card style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>Loading offers…</Text>
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
                          <Text style={styles.badgeText}>BEST</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.packHint}>
                      ~{(pack.priceAmount / Math.max(1, pack.tokens)).toFixed(3)} {pack.currency || "USD"} / token
                    </Text>
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
            <Text style={styles.restoreText}>Restore purchases</Text>
          )}
        </Pressable>

        <Text style={styles.legal}>
          Purchases are processed by Apple. Token packs are consumable; Lifetime Pro is a one-time
          purchase tied to your Apple ID.
        </Text>

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

function fallbackPack(id: string): ShopProduct | null {
  const tokens = TOKEN_PACKS[id];
  if (!tokens) return null;
  return {
    id,
    title: `${tokens} Trim Tokens`,
    description: "Token pack",
    price: "—",
    priceAmount: 0,
    currency: "USD",
    tokens,
    isLifetime: false,
  };
}

function fallbackLifetime(): ShopProduct {
  return {
    id: "lifetime_premium_1",
    title: "Lifetime Pro",
    description: "Unlimited trims and no ads",
    price: "$24.99",
    priceAmount: 24.99,
    currency: "USD",
    tokens: 0,
    isLifetime: true,
  };
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: 40, gap: spacing.lg },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  backBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primarySoft,
    alignItems: "center", justifyContent: "center",
  },
  title: { ...type.title, color: colors.text, marginTop: 2 },
  balance: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill,
    backgroundColor: colors.honeySoft,
  },
  balanceValue: { fontWeight: "900", fontSize: 16, color: colors.honey },

  proCard: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  proTitle: { ...type.title, color: colors.primary, marginTop: 2 },
  proSub: { ...type.body, color: colors.textMuted },

  lifetimeCard: { gap: spacing.md },
  lifetimeRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  lifetimeTitle: { ...type.title, color: colors.primary, marginTop: 6 },
  lifetimeSub: { ...type.body, color: colors.textMuted, marginTop: 2 },
  lifetimePrice: { fontSize: 22, fontWeight: "900", color: colors.primary },

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
  lifetimeRibbonText: { color: colors.white, fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  lifetimeHeaderRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  lifetimeBigTitle: { fontSize: 26, fontWeight: "900", color: colors.white, letterSpacing: -0.5 },
  lifetimeBigSub: { fontSize: 13, color: "#cbd5e1", marginTop: 4, fontWeight: "600" },
  lifetimePriceBlock: { alignItems: "flex-end" },
  lifetimeBigPrice: { fontSize: 28, fontWeight: "900", color: colors.honey },
  lifetimePriceHint: { fontSize: 11, color: "#94a3b8", fontWeight: "700" },
  lifetimeBenefits: { gap: 8, marginTop: 2 },
  lifetimeBenefitRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  lifetimeCheck: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center",
  },
  lifetimeBenefitText: { color: colors.white, fontSize: 14, fontWeight: "700", flex: 1 },


  cta: {
    height: 50, borderRadius: radius.lg, alignItems: "center", justifyContent: "center",
  },
  ctaPrimary: { backgroundColor: colors.primary, ...shadow.press },
  ctaDisabled: { opacity: 0.5 },
  ctaText: { color: colors.white, fontWeight: "800", fontSize: 16 },

  loading: { alignItems: "center", paddingVertical: spacing.xl, gap: spacing.sm },
  loadingText: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },

  pack: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    backgroundColor: colors.card, borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    ...shadow.soft,
  },
  packIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.honeySoft, alignItems: "center", justifyContent: "center",
  },
  packTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  packTokens: { fontSize: 17, fontWeight: "900", color: colors.text },
  badge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  badgeText: { color: colors.white, fontSize: 10, fontWeight: "900", letterSpacing: 0.8 },
  packHint: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  priceWrap: { minWidth: 72, alignItems: "flex-end" },
  packPrice: { fontSize: 16, fontWeight: "800", color: colors.primary },

  adCard: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    backgroundColor: colors.sageSoft, borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.sage,
  },
  adIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.white, alignItems: "center", justifyContent: "center",
  },
  adTitle: { fontSize: 16, fontWeight: "800", color: colors.sageDeep },
  adSub: { fontSize: 13, color: colors.sageDeep, marginTop: 2, fontWeight: "600" },

  restore: { alignItems: "center", paddingVertical: spacing.md, marginTop: spacing.sm },
  restoreText: { color: colors.primary, fontWeight: "800", fontSize: 14 },
  legal: { fontSize: 11, color: colors.textSubtle, textAlign: "center", lineHeight: 16, marginTop: spacing.sm },
});
