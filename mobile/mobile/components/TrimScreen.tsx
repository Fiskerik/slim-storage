import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { colors, radius, shadow, spacing, type } from "../constants/design";
import { Card, Pill, SectionHeader } from "./ui/primitives";
import {
  estimateTrimSavings,
  loadPhotoRound,
  requestPhotoPermission,
  trimPhoto,
  type NativePhoto,
} from "../lib/native-photo-source";
import type { NativeSettings } from "../lib/native-store";

type Preset = {
  key: "exif" | "location" | "compress50" | "compress80";
  label: string;
  hint: string;
  quality: number;
  multiplier: number; // multiplier on baseline saved MB
  icon: keyof typeof Ionicons.glyphMap;
};

const PRESETS: Preset[] = [
  { key: "exif", label: "Remove EXIF", hint: "Camera, lens, software", quality: 0.92, multiplier: 1, icon: "document-text-outline" },
  { key: "location", label: "Strip Location", hint: "GPS coordinates", quality: 0.95, multiplier: 0.8, icon: "location-outline" },
  { key: "compress50", label: "Compress 50%", hint: "Strong shrink", quality: 0.5, multiplier: 2.4, icon: "contract-outline" },
  { key: "compress80", label: "Compress 80%", hint: "Quality first", quality: 0.8, multiplier: 1.5, icon: "scan-outline" },
];

export type TrimScreenProps = {
  settings: NativeSettings;
  trimsRemaining: number;
  trimLimit: number;
  avoidIds: string[];
  isPro?: boolean;
  onBack: () => void;
  onTrimmed: (photo: NativePhoto, savedMB: number) => void;
};

export function TrimScreen({
  settings,
  trimsRemaining,
  trimLimit,
  avoidIds,
  isPro = false,
  onBack,
  onTrimmed,
}: TrimScreenProps) {
  const [photo, setPhoto] = useState<NativePhoto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Free users are locked to the EXIF preset. Pro users can stack multiple actions.
  const [selectedKeys, setSelectedKeys] = useState<Set<Preset["key"]>>(
    () => new Set(["exif"]),
  );
  const [busy, setBusy] = useState(false);
  const [justTrimmed, setJustTrimmed] = useState(false);

  async function loadNext() {
    setLoading(true);
    setError(null);
    setJustTrimmed(false);
    try {
      const permission = await requestPhotoPermission();
      if (!permission.granted) {
        setError("Photo access is needed to trim photos.");
        return;
      }
      const photos = await loadPhotoRound(
        6,
        { ...settings, cardsPerRound: 6, targetMode: "big-or-old" },
        { avoidIds },
      );
      const candidate = photos.find((p) => !p.isCloudAsset) ?? photos[0] ?? null;
      setPhoto(candidate);
      if (!candidate) setError("No local photos available to trim right now.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load a photo to trim.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = PRESETS.filter((p) => selectedKeys.has(p.key));
  const effectivePresets = selected.length > 0 ? selected : [PRESETS[0]];
  const baseline = photo ? estimateTrimSavings(photo) : 0;
  // Combined estimate: sum multipliers but cap at 3x baseline so we don't oversell.
  const combinedMultiplier = Math.min(
    3,
    effectivePresets.reduce((sum, p) => sum + p.multiplier, 0),
  );
  const estSaved = +(baseline * combinedMultiplier).toFixed(2);
  // Apply the strongest (lowest quality) preset when multiple are stacked.
  const effectiveQuality = Math.min(...effectivePresets.map((p) => p.quality));
  const width = Dimensions.get("window").width - 40;
  const height = Math.round(width * 1.05);

  function togglePreset(key: Preset["key"]) {
    if (!isPro) {
      // Free users: single-select EXIF only. Show a friendly hint for others.
      if (key !== "exif") {
        setError("Multi-preset trim is a Lifetime Pro feature. Free trims use Remove EXIF.");
        return;
      }
      setSelectedKeys(new Set(["exif"]));
      return;
    }
    setError(null);
    void Haptics.selectionAsync();
    const next = new Set(selectedKeys);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    if (next.size === 0) next.add("exif");
    setSelectedKeys(next);
  }

  async function applyTrim() {
    if (!photo) return;
    if (trimsRemaining <= 0) {
      setError(`Daily trim limit reached (${trimLimit}/day). Try again tomorrow.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await trimPhoto(photo, preset.quality);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const saved = result.savedMB ?? estSaved;
      if (result.trimmed) {
        onTrimmed(photo, saved);
        setTrimmedUri(photo.uri);
      } else {
        setError(result.error ?? "Could not trim this photo.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Trim failed.");
    } finally {
      setBusy(false);
    }
  }

  const trimsBarPct = Math.max(0, Math.min(1, trimsRemaining / Math.max(1, trimLimit)));

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <View style={styles.headerRow}>
        <Pressable onPress={onBack} hitSlop={10} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={type.eyebrow}>Visual trim</Text>
          <Text style={styles.title}>Strip the heavy bits</Text>
        </View>
        <Pressable onPress={() => void loadNext()} hitSlop={10} style={styles.backBtn}>
          <Ionicons name="shuffle-outline" size={18} color={colors.text} />
        </Pressable>
      </View>

      {/* Photo area */}
      <View style={[styles.previewWrap, { width, height }]}>
        {loading ? (
          <View style={[styles.center, { width, height }]}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={styles.muted}>Loading photo…</Text>
          </View>
        ) : !photo ? (
          <View style={[styles.center, { width, height }]}>
            <Ionicons name="image-outline" size={32} color={colors.textMuted} />
            <Text style={styles.muted}>{error ?? "No photo loaded."}</Text>
            <Pressable style={styles.retryBtn} onPress={() => void loadNext()}>
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        ) : (
          <BeforeAfterSlider
            beforeUri={photo.uri}
            afterUri={trimmedUri ?? photo.uri}
            width={width}
            height={height}
            savedLabel={`−${estSaved.toFixed(1)} MB`}
          />
        )}
      </View>

      {photo ? (
        <View style={styles.metaRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.metaTitle} numberOfLines={1}>{photo.title}</Text>
            <Text style={styles.metaSub}>
              {photo.month} {photo.year} · {photo.sizeMB.toFixed(1)} MB
            </Text>
          </View>
          <Pill icon="sparkles-outline" value={`~${estSaved.toFixed(1)} MB`} label="save" tone="primary" />
        </View>
      ) : null}

      {/* Presets */}
      <SectionHeader title="Presets" action={<Text style={styles.actionLink}>tap to pick</Text>} />
      <View style={styles.presetGrid}>
        {PRESETS.map((p) => {
          const active = p.key === presetKey;
          const saveMB = +(baseline * p.multiplier).toFixed(2);
          return (
            <Pressable
              key={p.key}
              onPress={() => {
                void Haptics.selectionAsync();
                setPresetKey(p.key);
              }}
              style={[styles.preset, active && styles.presetActive]}
            >
              <View
                style={[
                  styles.presetIcon,
                  { backgroundColor: active ? colors.primary : colors.primarySoft },
                ]}
              >
                <Ionicons name={p.icon} size={16} color={active ? colors.white : colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.presetLabel, active && { color: colors.primary }]}>{p.label}</Text>
                <Text style={styles.presetHint}>{p.hint}</Text>
              </View>
              <Text style={styles.presetSave}>~{saveMB.toFixed(1)} MB</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Daily trims meter */}
      <Card style={styles.meterCard}>
        <View style={styles.meterRow}>
          <Ionicons name="time-outline" size={16} color={colors.primary} />
          <Text style={styles.meterLabel}>Daily free trims</Text>
          <Text style={styles.meterValue}>{trimsRemaining}/{trimLimit}</Text>
        </View>
        <View style={styles.meterTrack}>
          <View style={[styles.meterFill, { width: `${trimsBarPct * 100}%` }]} />
        </View>
      </Card>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.actionBar}>
        <Pressable
          onPress={onBack}
          style={styles.ghostBtn}
        >
          <Text style={styles.ghostText}>Cancel</Text>
        </Pressable>
        <Pressable
          disabled={busy || !photo || trimsRemaining <= 0}
          onPress={() => void applyTrim()}
          style={[
            styles.primaryBtn,
            (busy || !photo || trimsRemaining <= 0) && styles.primaryDisabled,
          ]}
        >
          {busy ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <>
              <Ionicons name="cut-outline" size={18} color={colors.white} />
              <Text style={styles.primaryText}>Trim · save ~{estSaved.toFixed(1)} MB</Text>
            </>
          )}
        </Pressable>
      </View>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: 40 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.lg },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  title: { ...type.title, color: colors.text, marginTop: 2 },

  previewWrap: {
    alignSelf: "center",
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: colors.cardSoft,
    ...shadow.card,
  },
  center: { alignItems: "center", justifyContent: "center", gap: spacing.sm },
  muted: { color: colors.textMuted, fontSize: 13 },

  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  metaTitle: { ...type.subtitle, color: colors.text },
  metaSub: { ...type.body, color: colors.textMuted, marginTop: 2 },
  actionLink: { fontSize: 12, color: colors.primary, fontWeight: "700" },

  presetGrid: { gap: spacing.sm },
  preset: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  presetActive: {
    borderColor: colors.primary,
    backgroundColor: "#fff1e3",
  },
  presetIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  presetLabel: { fontSize: 14, fontWeight: "800", color: colors.text },
  presetHint: { fontSize: 11, color: colors.textMuted, marginTop: 2, fontWeight: "600" },
  presetSave: { fontSize: 13, fontWeight: "900", color: colors.primary },

  meterCard: { marginTop: spacing.lg },
  meterRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  meterLabel: { fontSize: 12, fontWeight: "700", color: colors.textMuted, flex: 1 },
  meterValue: { fontSize: 13, fontWeight: "900", color: colors.primary },
  meterTrack: {
    marginTop: spacing.sm,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.borderSoft,
    overflow: "hidden",
  },
  meterFill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: colors.primary,
  },

  errorText: {
    marginTop: spacing.md,
    color: colors.danger,
    fontSize: 12,
    fontWeight: "700",
  },

  actionBar: {
    marginTop: spacing.xl,
    flexDirection: "row",
    gap: spacing.md,
  },
  ghostBtn: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    justifyContent: "center",
  },
  ghostText: { fontWeight: "800", color: colors.text },
  primaryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    ...shadow.press,
  },
  primaryDisabled: { backgroundColor: colors.textSubtle, shadowOpacity: 0 },
  primaryText: { color: colors.white, fontWeight: "900", fontSize: 14, letterSpacing: 0.3 },

  retryBtn: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  retryText: { color: colors.primary, fontWeight: "800" },
});
