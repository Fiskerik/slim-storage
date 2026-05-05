import { r as reactExports, j as jsxRuntimeExports } from "./worker-entry-CoKMp4xS.js";
import { c as createLucideIcon, u as useStats, a as cn, r as resetStats } from "./router-DXWOG26a.js";
import { S as Sparkles } from "./sparkles-Dq14kSuc.js";
import { T as Trash2 } from "./trash-2-DaOcsTfD.js";
import { H as HardDrive } from "./hard-drive-CBdyrgk3.js";
import { B as Brain } from "./brain-L_Qp_JdL.js";
import { F as Flame } from "./flame-BWkEcf9y.js";
import { R as RotateCcw, X } from "./x-BelgsWCN.js";
import "node:events";
import "node:async_hooks";
import "node:stream/web";
import "node:stream";
const __iconNode$1 = [
  ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", ry: "2", key: "1m3agn" }],
  ["circle", { cx: "9", cy: "9", r: "2", key: "af1f0g" }],
  ["path", { d: "m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21", key: "1xmnt7" }]
];
const Image = createLucideIcon("image", __iconNode$1);
const __iconNode = [
  ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
  ["circle", { cx: "12", cy: "12", r: "6", key: "1vlfrh" }],
  ["circle", { cx: "12", cy: "12", r: "2", key: "1c9p78" }]
];
const Target = createLucideIcon("target", __iconNode);
function StatsPage() {
  const s = useStats();
  const totalReviewed = s.cleaned + s.deleted + s.slimmed;
  const accuracy = s.memoryPlayed ? Math.round(s.memoryCorrect / s.memoryPlayed * 100) : 0;
  const avgDelta = s.memoryPlayed ? (s.memoryTotalDelta / s.memoryPlayed).toFixed(1) : "—";
  const freed = s.mbFreed;
  const freedDisplay = freed >= 1024 ? `${(freed / 1024).toFixed(2)} GB` : `${freed.toFixed(1)} MB`;
  const last7 = reactExports.useMemo(() => buildLast7Days(s.daily), [s.daily]);
  const [selected, setSelected] = reactExports.useState(null);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "px-5 pt-5 pb-8", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("header", { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs uppercase tracking-[0.18em] text-muted-foreground", children: "Your progress" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { className: "mt-1 font-display text-3xl font-bold tracking-tight", children: "Statistics" })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "mt-6 overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary to-warm p-5 text-primary-foreground shadow-card", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs uppercase tracking-wider opacity-80", children: "Total storage freed" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-1 font-display text-5xl font-bold tabular-nums", children: freedDisplay }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "mt-2 text-xs opacity-85", children: [
        "From ",
        totalReviewed,
        " photo",
        totalReviewed === 1 ? "" : "s",
        " reviewed · 🔥 ",
        s.streak,
        "-day streak"
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "mt-7 px-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground", children: "Last 7 days" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-1 px-1 text-[11px] text-muted-foreground", children: "Tap a day to see what you cleaned. Green = memory played." }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-3 flex items-end justify-between gap-2", children: last7.map((d) => {
      const max = Math.max(1, ...last7.map((x) => x.mbFreed));
      const heightPct = Math.max(8, Math.round(d.mbFreed / max * 100));
      const hasActivity = d.kept + d.trimmed + d.deleted + d.memoryPlayed > 0;
      const memoryCleared = d.memoryPlayed > 0;
      const label = (/* @__PURE__ */ new Date(d.date + "T00:00:00")).toLocaleDateString(void 0, { weekday: "short" })[0];
      return /* @__PURE__ */ jsxRuntimeExports.jsxs(
        "button",
        {
          onClick: () => setSelected(d),
          className: "group flex flex-1 flex-col items-center gap-1.5",
          "aria-label": `${d.date} details`,
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "relative flex h-[88px] w-full items-end justify-center", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
              "div",
              {
                className: cn(
                  "w-full rounded-2xl border transition group-hover:scale-[1.03]",
                  memoryCleared ? "border-success/60 bg-success/80" : hasActivity ? "border-border bg-muted" : "border-dashed border-border bg-transparent"
                ),
                style: { height: hasActivity ? `${heightPct}%` : "30%" }
              }
            ) }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-[10px] font-semibold uppercase tracking-wider text-muted-foreground", children: label })
          ]
        },
        d.date
      );
    }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "mt-7 px-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground", children: "Cleanup" }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-3 grid grid-cols-2 gap-3", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(StatCard, { icon: /* @__PURE__ */ jsxRuntimeExports.jsx(Image, { className: "h-4 w-4" }), label: "Kept", value: s.cleaned }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(StatCard, { icon: /* @__PURE__ */ jsxRuntimeExports.jsx(Sparkles, { className: "h-4 w-4" }), label: "Trimmed", value: s.slimmed, accent: true }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(StatCard, { icon: /* @__PURE__ */ jsxRuntimeExports.jsx(Trash2, { className: "h-4 w-4" }), label: "Deleted", value: s.deleted }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(StatCard, { icon: /* @__PURE__ */ jsxRuntimeExports.jsx(HardDrive, { className: "h-4 w-4" }), label: "MB Freed", value: freed.toFixed(0) })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "mt-7 px-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground", children: "Memory game" }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-3 grid grid-cols-2 gap-3", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(StatCard, { icon: /* @__PURE__ */ jsxRuntimeExports.jsx(Brain, { className: "h-4 w-4" }), label: "Played", value: s.memoryPlayed }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(StatCard, { icon: /* @__PURE__ */ jsxRuntimeExports.jsx(Target, { className: "h-4 w-4" }), label: "Accuracy", value: `${accuracy}%`, accent: true }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(StatCard, { icon: /* @__PURE__ */ jsxRuntimeExports.jsx(Flame, { className: "h-4 w-4" }), label: "Best streak", value: s.memoryBestStreak }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(StatCard, { icon: /* @__PURE__ */ jsxRuntimeExports.jsx(Sparkles, { className: "h-4 w-4" }), label: "Avg yrs off", value: avgDelta })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "button",
      {
        onClick: () => {
          if (confirm("Reset all statistics?")) resetStats();
        },
        className: "mt-8 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card py-3 text-sm font-medium text-muted-foreground transition hover:text-destructive hover:border-destructive/40",
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(RotateCcw, { className: "h-4 w-4" }),
          " Reset stats"
        ]
      }
    ),
    selected && /* @__PURE__ */ jsxRuntimeExports.jsx(DayDetailModal, { day: selected, onClose: () => setSelected(null) })
  ] });
}
function buildLast7Days(daily) {
  const map = new Map(daily.map((d) => [d.date, d]));
  const out = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
    out.push(
      map.get(date) ?? {
        date,
        kept: 0,
        trimmed: 0,
        deleted: 0,
        mbFreed: 0,
        memoryPlayed: 0
      }
    );
  }
  return out;
}
function DayDetailModal({ day, onClose }) {
  const dateLabel = (/* @__PURE__ */ new Date(day.date + "T00:00:00")).toLocaleDateString(void 0, {
    weekday: "long",
    month: "short",
    day: "numeric"
  });
  const total = day.kept + day.trimmed + day.deleted;
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    "div",
    {
      className: "fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center",
      onClick: onClose,
      children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
        "div",
        {
          className: "w-full max-w-sm rounded-t-3xl border border-border bg-card p-6 shadow-card sm:rounded-3xl",
          onClick: (e) => e.stopPropagation(),
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-start justify-between", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs uppercase tracking-wider text-muted-foreground", children: "Day detail" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { className: "mt-1 font-display text-2xl font-bold", children: dateLabel })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                "button",
                {
                  onClick: onClose,
                  className: "rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground",
                  "aria-label": "Close",
                  children: /* @__PURE__ */ jsxRuntimeExports.jsx(X, { className: "h-4 w-4" })
                }
              )
            ] }),
            total === 0 && day.memoryPlayed === 0 ? /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-4 text-sm text-muted-foreground", children: "No activity on this day." }) : /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-5 rounded-2xl border border-border bg-background/50 p-4", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs uppercase tracking-wider text-muted-foreground", children: "Storage freed" }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "mt-1 font-display text-3xl font-bold tabular-nums", children: [
                  day.mbFreed.toFixed(1),
                  " ",
                  /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-base text-muted-foreground", children: "MB" })
                ] })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-3 grid grid-cols-3 gap-2", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(MiniStat, { label: "Kept", value: day.kept }),
                /* @__PURE__ */ jsxRuntimeExports.jsx(MiniStat, { label: "Trimmed", value: day.trimmed, accent: true }),
                /* @__PURE__ */ jsxRuntimeExports.jsx(MiniStat, { label: "Deleted", value: day.deleted })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs(
                "div",
                {
                  className: cn(
                    "mt-3 flex items-center gap-2 rounded-2xl border p-3 text-sm",
                    day.memoryPlayed > 0 ? "border-success/40 bg-success/10 text-success-foreground" : "border-border bg-muted/40 text-muted-foreground"
                  ),
                  children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx(Brain, { className: "h-4 w-4" }),
                    day.memoryPlayed > 0 ? `Memory played · ${day.memoryPlayed} photo${day.memoryPlayed === 1 ? "" : "s"}` : "No memory game this day"
                  ]
                }
              )
            ] })
          ]
        }
      )
    }
  );
}
function MiniStat({ label, value, accent }) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rounded-xl border border-border bg-background/50 p-3 text-center", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: cn("font-display text-xl font-bold tabular-nums", accent && "text-primary"), children: value }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground", children: label })
  ] });
}
function StatCard({
  icon,
  label,
  value,
  accent
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rounded-2xl border border-border bg-card p-4 shadow-soft", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2 text-muted-foreground", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: accent ? "text-primary" : "", children: icon }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-[11px] font-medium uppercase tracking-wider", children: label })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: `mt-2 font-display text-2xl font-bold tabular-nums ${accent ? "text-primary" : ""}`, children: value })
  ] });
}
function StatsRoute() {
  return /* @__PURE__ */ jsxRuntimeExports.jsx(StatsPage, {});
}
export {
  StatsRoute as component
};
