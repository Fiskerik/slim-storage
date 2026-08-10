/**
 * TrimSwipe native design tokens.
 * Professional slate / graphite / sage palette for the native app.
 */

export const colors = {
  // Lightweight boxed theme with cool neutral surfaces and slate-blue accents.
  background: "#f5f7f9",
  backgroundAlt: "#ffffff",
  card: "#ffffff",
  cardSoft: "#f8fafb",
  border: "#dce3e8",
  borderSoft: "#e9eef2",

  text: "#18212b",
  textMuted: "#5f6b76",
  textSubtle: "#8a97a3",

  primary: "#315f7d", // restrained slate-blue accent
  primaryBright: "#4f7892",
  primarySoft: "#eaf0f4",
  primaryGlow: "#a7bdca",

  sage: "#4f7a68",
  sageSoft: "#e8f0ec",
  sageDeep: "#365b4a",

  honey: "#9a742f",
  honeySoft: "#f4efe3",

  danger: "#ef4444",
  dangerSoft: "#fee2e2",

  info: "#39789a",
  infoSoft: "#e7f0f5",

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
  display: { fontSize: 30, fontWeight: "700" as const, letterSpacing: -0.4 },
  title: { fontSize: 22, fontWeight: "700" as const, letterSpacing: -0.15 },
  subtitle: { fontSize: 17, fontWeight: "700" as const },
  body: { fontSize: 14, fontWeight: "500" as const, lineHeight: 20 },
  caption: { fontSize: 12, fontWeight: "600" as const, color: colors.textMuted },
  eyebrow: {
    fontSize: 10,
    fontWeight: "700" as const,
    letterSpacing: 1.2,
    textTransform: "uppercase" as const,
    color: colors.primaryBright,
  },
  mono: { fontSize: 13, fontWeight: "800" as const, letterSpacing: 0.5 },
};

export const shadow = {
  card: {
    shadowColor: "#18212b",
    shadowOpacity: 0.05,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  soft: {
    shadowColor: "#18212b",
    shadowOpacity: 0.03,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  press: {
    shadowColor: "#315f7d",
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
} as const;

export const motion = {
  fast: 160,
  base: 240,
  slow: 420,
  ring: 1100,
} as const;

export const tiles = {
  scan: { bg: "#eaf0f4", icon: colors.primary, accent: colors.primaryBright },
  swipe: { bg: colors.sageSoft, icon: colors.sageDeep, accent: colors.sage },
  trim: { bg: colors.honeySoft, icon: "#66552f", accent: colors.honey },
  games: { bg: colors.infoSoft, icon: "#294f67", accent: colors.info },
} as const;
