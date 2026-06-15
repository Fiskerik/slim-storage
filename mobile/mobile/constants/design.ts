/**
 * TrimSwipe native design tokens.
 * Warm sandstone / terracotta / sage palette mirroring the web app.
 */

export const colors = {
  // Lightweight "boxed" theme — airy white canvas with orange accents.
  background: "#fbfaf9",
  backgroundAlt: "#ffffff",
  card: "#ffffff",
  cardSoft: "#fffaf4",
  border: "#f1ece6",
  borderSoft: "#f6f1ea",

  text: "#1c1917",
  textMuted: "#78716c",
  textSubtle: "#a8a29e",

  primary: "#f97316", // bright orange accent
  primaryBright: "#fb923c",
  primarySoft: "#fff4e8",
  primaryGlow: "#fdba74",

  sage: "#65a30d",
  sageSoft: "#ecfccb",
  sageDeep: "#3f6212",

  honey: "#d97706",
  honeySoft: "#fef3c7",

  danger: "#ef4444",
  dangerSoft: "#fee2e2",

  info: "#0ea5e9",
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
