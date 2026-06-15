/**
 * TrimSwipe native design tokens.
 * Warm sandstone / terracotta / sage palette mirroring the web app.
 */

export const colors = {
  background: "#fff7ed",
  backgroundAlt: "#fffaf3",
  card: "#ffffff",
  cardSoft: "#fff1e3",
  border: "#fed7aa",
  borderSoft: "#fde6cf",

  text: "#1f2937",
  textMuted: "#64748b",
  textSubtle: "#94a3b8",

  primary: "#c2410c", // terracotta deep
  primaryBright: "#f97316",
  primarySoft: "#ffedd5",
  primaryGlow: "#fb923c",

  sage: "#65a30d",
  sageSoft: "#dcfce7",
  sageDeep: "#3f6212",

  honey: "#d97706",
  honeySoft: "#fef3c7",

  danger: "#dc2626",
  dangerSoft: "#fee2e2",

  info: "#0369a1",
  infoSoft: "#e0f2fe",

  white: "#ffffff",
  ink: "#0f172a",
  inkOverlay: "rgba(15, 23, 42, 0.55)",
} as const;

export const radius = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40,
} as const;

export const type = {
  display: { fontSize: 30, fontWeight: "900" as const, letterSpacing: -0.5 },
  title: { fontSize: 22, fontWeight: "800" as const, letterSpacing: -0.2 },
  subtitle: { fontSize: 17, fontWeight: "700" as const },
  body: { fontSize: 14, fontWeight: "500" as const, lineHeight: 20 },
  caption: { fontSize: 12, fontWeight: "600" as const, color: colors.textMuted },
  eyebrow: {
    fontSize: 10,
    fontWeight: "800" as const,
    letterSpacing: 1.6,
    textTransform: "uppercase" as const,
    color: colors.primaryBright,
  },
  mono: { fontSize: 13, fontWeight: "800" as const, letterSpacing: 0.5 },
};

export const shadow = {
  card: {
    shadowColor: "#9a3412",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  soft: {
    shadowColor: "#9a3412",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  press: {
    shadowColor: "#9a3412",
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
} as const;

export const motion = {
  fast: 160,
  base: 240,
  slow: 420,
  ring: 1100,
} as const;

export const tiles = {
  scan: { bg: "#fff1e3", icon: colors.primary, accent: colors.primaryBright },
  swipe: { bg: "#ecfccb", icon: colors.sageDeep, accent: colors.sage },
  trim: { bg: "#fef3c7", icon: "#92400e", accent: colors.honey },
  games: { bg: "#e0f2fe", icon: "#075985", accent: colors.info },
} as const;
