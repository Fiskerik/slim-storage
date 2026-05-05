import { u as useRouter, j as jsxRuntimeExports, O as Outlet } from "./worker-entry-CoKMp4xS.js";
import { c as createLucideIcon, u as useStats, f as Link } from "./router-DXWOG26a.js";
import { A as ArrowRight } from "./arrow-right-DIiZInzO.js";
import { B as Brain } from "./brain-L_Qp_JdL.js";
import { H as HardDrive } from "./hard-drive-CBdyrgk3.js";
import "node:events";
import "node:async_hooks";
import "node:stream/web";
import "node:stream";
function useRouterState(opts) {
  const contextRouter = useRouter();
  const router = contextRouter;
  {
    const state = router.stores.__store.get();
    return state;
  }
}
const __iconNode$1 = [
  ["path", { d: "M12 3v18", key: "108xh3" }],
  ["path", { d: "m19 8 3 8a5 5 0 0 1-6 0zV7", key: "zcdpyk" }],
  ["path", { d: "M3 7h1a17 17 0 0 0 8-2 17 17 0 0 0 8 2h1", key: "1yorad" }],
  ["path", { d: "m5 8 3 8a5 5 0 0 1-6 0zV7", key: "eua70x" }],
  ["path", { d: "M7 21h10", key: "1b0cd5" }]
];
const Scale = createLucideIcon("scale", __iconNode$1);
const __iconNode = [
  ["line", { x1: "10", x2: "14", y1: "2", y2: "2", key: "14vaq8" }],
  ["line", { x1: "12", x2: "15", y1: "14", y2: "11", key: "17fdiu" }],
  ["circle", { cx: "12", cy: "14", r: "8", key: "1e1u0o" }]
];
const Timer = createLucideIcon("timer", __iconNode);
function GamesHub() {
  const stats = useStats();
  const games = [
    {
      to: "/memory",
      title: "Memory Lane",
      tagline: "Guess the year of forgotten photos, then keep or clear.",
      icon: /* @__PURE__ */ jsxRuntimeExports.jsx(Brain, { className: "h-5 w-5" }),
      iconBg: "bg-primary/15",
      iconFg: "text-primary",
      available: true
    },
    {
      to: "/games/this-or-that",
      title: "This or That",
      tagline: "Two near-duplicates side by side. Pick the keeper, lose the rest.",
      icon: /* @__PURE__ */ jsxRuntimeExports.jsx(Scale, { className: "h-5 w-5" }),
      iconBg: "bg-accent/20",
      iconFg: "text-accent-foreground",
      available: true
    },
    {
      to: "/games/speed-round",
      title: "Speed Round",
      tagline: "30 seconds, swipe as many photos as you can. Score = MB freed.",
      icon: /* @__PURE__ */ jsxRuntimeExports.jsx(Timer, { className: "h-5 w-5" }),
      iconBg: "bg-warm/25",
      iconFg: "text-warm-foreground",
      available: true
    },
    {
      to: "/games/storage-budget",
      title: "Storage Budget",
      tagline: "50 MB budget. Keep only what fits. Real trade-offs, real space.",
      icon: /* @__PURE__ */ jsxRuntimeExports.jsx(HardDrive, { className: "h-5 w-5" }),
      iconBg: "bg-secondary",
      iconFg: "text-secondary-foreground",
      available: true
    }
  ];
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "px-5 pt-5 pb-8", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("header", { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs uppercase tracking-[0.18em] text-muted-foreground", children: "Game hub" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { className: "mt-1 font-display text-3xl font-bold tracking-tight", children: "Pick your game" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-2 text-sm text-muted-foreground", children: "Different ways to clean — same result: less clutter, more space." })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-6 rounded-2xl border border-border bg-card p-4 shadow-soft", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between text-xs", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "uppercase tracking-wider text-muted-foreground", children: "Memory streak" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "mt-1 font-display text-xl font-bold tabular-nums", children: [
          "🔥 ",
          stats.memoryCurrentStreak
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "text-right", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "uppercase tracking-wider text-muted-foreground", children: "Best" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-1 font-display text-xl font-bold tabular-nums", children: stats.memoryBestStreak })
      ] })
    ] }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-5 space-y-3", children: games.map((g) => /* @__PURE__ */ jsxRuntimeExports.jsx(
      Link,
      {
        to: g.to,
        className: "block rounded-2xl border border-border bg-card p-4 shadow-soft transition hover:border-primary/40 hover:shadow-card",
        children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-start gap-3", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: `flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${g.iconBg} ${g.iconFg}`, children: g.icon }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "min-w-0 flex-1", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { className: "font-display text-lg font-bold tracking-tight", children: g.title }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-1 text-sm text-muted-foreground", children: g.tagline })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(ArrowRight, { className: "mt-3 h-4 w-4 shrink-0 text-muted-foreground" })
        ] })
      },
      g.to
    )) })
  ] });
}
function GamesRoute() {
  const {
    location
  } = useRouterState();
  if (location.pathname === "/games") return /* @__PURE__ */ jsxRuntimeExports.jsx(GamesHub, {});
  return /* @__PURE__ */ jsxRuntimeExports.jsx(Outlet, {});
}
export {
  GamesRoute as component
};
