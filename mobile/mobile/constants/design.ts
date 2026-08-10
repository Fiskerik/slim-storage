/**
 * TrimSwipe native design tokens.
 * Warm editorial palette shared with the game artwork.
 */

export const colors = {
  background: "#f5f0e7",
  backgroundAlt: "#fffdf8",
  card: "#fffdf8",
  cardSoft: "#eee8dc",
  border: "#d7cfc1",
  borderSoft: "#e8e0d4",

  text: "#142b3a",
  textMuted: "#65706d",
  textSubtle: "#92958b",

  primary: "#173142",
  primaryBright: "#3f7f7a",
  primarySoft: "#dce8e4",
  primaryGlow: "#8fb8b0",

  sage: "#778b72",
  sageSoft: "#e3e8dc",
  sageDeep: "#435d45",

  honey: "#c77a45",
  honeySoft: "#f4e4d2",

  danger: "#c94f43",
  dangerSoft: "#f5d9d4",

  info: "#4b7d87",
  infoSoft: "#dce8e8",

  white: "#ffffff",
  ink: "#0f2533",
  inkOverlay: "rgba(15, 37, 51, 0.58)",
} as const;

export const radius = {
  xs: 9,
  sm: 13,
  md: 17,
  lg: 24,
  xl: 30,
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
    shadowColor: "#142b3a",
    shadowOpacity: 0.09,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  soft: {
    shadowColor: "#142b3a",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  press: {
    shadowColor: "#173142",
    shadowOpacity: 0.2,
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
  scan: { bg: colors.primarySoft, icon: colors.primary, accent: colors.primaryBright },
  swipe: { bg: colors.sageSoft, icon: colors.sageDeep, accent: colors.sage },
  trim: { bg: colors.honeySoft, icon: "#704526", accent: colors.honey },
  games: { bg: colors.infoSoft, icon: colors.primary, accent: colors.info },
} as const;
