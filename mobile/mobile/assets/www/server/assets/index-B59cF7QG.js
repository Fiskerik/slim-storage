import { r as reactExports, j as jsxRuntimeExports } from "./worker-entry-CoKMp4xS.js";
import { i as interpolate, u as useConstant, a as motionValue, b as MotionConfigContext, c as useIsomorphicLayoutEffect, d as cancelFrame, f as frame, e as collectMotionValues, A as AnimatePresence, m as motion, S as SAMPLE_PHOTOS } from "./photos-BtnfcJev.js";
import { c as createLucideIcon, b as updateSettings, S as Shield, L as Layers, u as useStats, F as FREE_TRIM_LIMIT, s as setPro, t as toast, a as cn, g as canTrim, e as setStats, l as logDay, h as recordTrim, i as trimsRemainingToday, j as softDelete, k as undoDelete, m as bumpStreak } from "./router-DXWOG26a.js";
import { A as ArrowRight } from "./arrow-right-DIiZInzO.js";
import { F as Flame } from "./flame-BWkEcf9y.js";
import { S as Sparkles } from "./sparkles-Dq14kSuc.js";
import { C as Cloud } from "./cloud-DpVw2JWT.js";
import "node:events";
import "node:async_hooks";
import "node:stream/web";
import "node:stream";
const __iconNode$6 = [
  ["path", { d: "m12 19-7-7 7-7", key: "1l729n" }],
  ["path", { d: "M19 12H5", key: "x3x0zl" }]
];
const ArrowLeft = createLucideIcon("arrow-left", __iconNode$6);
const __iconNode$5 = [
  ["path", { d: "m5 12 7-7 7 7", key: "hav0vg" }],
  ["path", { d: "M12 19V5", key: "x0mq9r" }]
];
const ArrowUp = createLucideIcon("arrow-up", __iconNode$5);
const __iconNode$4 = [
  ["rect", { width: "18", height: "11", x: "3", y: "11", rx: "2", ry: "2", key: "1w4ew1" }],
  ["path", { d: "M7 11V7a5 5 0 0 1 10 0v4", key: "fwvmzm" }]
];
const Lock = createLucideIcon("lock", __iconNode$4);
const __iconNode$3 = [
  [
    "path",
    {
      d: "M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0",
      key: "1r0f0z"
    }
  ],
  ["circle", { cx: "12", cy: "10", r: "3", key: "ilqhr7" }]
];
const MapPin = createLucideIcon("map-pin", __iconNode$3);
const __iconNode$2 = [
  ["path", { d: "M5.8 11.3 2 22l10.7-3.79", key: "gwxi1d" }],
  ["path", { d: "M4 3h.01", key: "1vcuye" }],
  ["path", { d: "M22 8h.01", key: "1mrtc2" }],
  ["path", { d: "M15 2h.01", key: "1cjtqr" }],
  ["path", { d: "M22 20h.01", key: "1mrys2" }],
  [
    "path",
    {
      d: "m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10",
      key: "hbicv8"
    }
  ],
  [
    "path",
    { d: "m22 13-.82-.33c-.86-.34-1.82.2-1.98 1.11c-.11.7-.72 1.22-1.43 1.22H17", key: "1i94pl" }
  ],
  ["path", { d: "m11 2 .33.82c.34.86-.2 1.82-1.11 1.98C9.52 4.9 9 5.52 9 6.23V7", key: "1cofks" }],
  [
    "path",
    {
      d: "M11 13c1.93 1.93 2.83 4.17 2 5-.83.83-3.07-.07-5-2-1.93-1.93-2.83-4.17-2-5 .83-.83 3.07.07 5 2Z",
      key: "4kbmks"
    }
  ]
];
const PartyPopper = createLucideIcon("party-popper", __iconNode$2);
const __iconNode$1 = [
  ["path", { d: "M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8", key: "v9h5vc" }],
  ["path", { d: "M21 3v5h-5", key: "1q7to0" }],
  ["path", { d: "M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16", key: "3uifl3" }],
  ["path", { d: "M8 16H3v5", key: "1cv678" }]
];
const RefreshCw = createLucideIcon("refresh-cw", __iconNode$1);
const __iconNode = [
  ["path", { d: "M9 14 4 9l5-5", key: "102s5s" }],
  ["path", { d: "M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11", key: "f3b9sd" }]
];
const Undo2 = createLucideIcon("undo-2", __iconNode);
function transform(...args) {
  const useImmediate = !Array.isArray(args[0]);
  const argOffset = useImmediate ? 0 : -1;
  const inputValue = args[0 + argOffset];
  const inputRange = args[1 + argOffset];
  const outputRange = args[2 + argOffset];
  const options = args[3 + argOffset];
  const interpolator = interpolate(inputRange, outputRange, options);
  return useImmediate ? interpolator(inputValue) : interpolator;
}
function useMotionValue(initial) {
  const value = useConstant(() => motionValue(initial));
  const { isStatic } = reactExports.useContext(MotionConfigContext);
  if (isStatic) {
    const [, setLatest] = reactExports.useState(initial);
    reactExports.useEffect(() => value.on("change", setLatest), []);
  }
  return value;
}
function useCombineMotionValues(values, combineValues) {
  const value = useMotionValue(combineValues());
  const updateValue = () => value.set(combineValues());
  updateValue();
  useIsomorphicLayoutEffect(() => {
    const scheduleUpdate = () => frame.preRender(updateValue, false, true);
    const subscriptions = values.map((v) => v.on("change", scheduleUpdate));
    return () => {
      subscriptions.forEach((unsubscribe) => unsubscribe());
      cancelFrame(updateValue);
    };
  });
  return value;
}
function useComputed(compute) {
  collectMotionValues.current = [];
  compute();
  const value = useCombineMotionValues(collectMotionValues.current, compute);
  collectMotionValues.current = void 0;
  return value;
}
function useTransform(input, inputRangeOrTransformer, outputRangeOrMap, options) {
  if (typeof input === "function") {
    return useComputed(input);
  }
  const isOutputMap = outputRangeOrMap !== void 0 && !Array.isArray(outputRangeOrMap) && typeof inputRangeOrTransformer !== "function";
  if (isOutputMap) {
    return useMapTransform(input, inputRangeOrTransformer, outputRangeOrMap, options);
  }
  const outputRange = outputRangeOrMap;
  const transformer = typeof inputRangeOrTransformer === "function" ? inputRangeOrTransformer : transform(inputRangeOrTransformer, outputRange, options);
  const result = Array.isArray(input) ? useListTransform(input, transformer) : useListTransform([input], ([latest]) => transformer(latest));
  const inputAccelerate = !Array.isArray(input) ? input.accelerate : void 0;
  if (inputAccelerate && !inputAccelerate.isTransformed && typeof inputRangeOrTransformer !== "function" && Array.isArray(outputRangeOrMap) && options?.clamp !== false) {
    result.accelerate = {
      ...inputAccelerate,
      times: inputRangeOrTransformer,
      keyframes: outputRangeOrMap,
      isTransformed: true,
      ...{}
    };
  }
  return result;
}
function useListTransform(values, transformer) {
  const latest = useConstant(() => []);
  return useCombineMotionValues(values, () => {
    latest.length = 0;
    const numValues = values.length;
    for (let i = 0; i < numValues; i++) {
      latest[i] = values[i].get();
    }
    return transformer(latest);
  });
}
function useMapTransform(inputValue, inputRange, outputMap, options) {
  const keys = useConstant(() => Object.keys(outputMap));
  const output = useConstant(() => ({}));
  for (const key of keys) {
    output[key] = useTransform(inputValue, inputRange, outputMap[key], options);
  }
  return output;
}
function Onboarding({ onDone }) {
  const [step, setStep] = reactExports.useState(0);
  const steps = [
    {
      icon: /* @__PURE__ */ jsxRuntimeExports.jsx(Shield, { className: "h-7 w-7" }),
      title: "Private by default",
      body: "Your photos never leave your phone."
    },
    {
      icon: /* @__PURE__ */ jsxRuntimeExports.jsx(Layers, { className: "h-7 w-7" }),
      title: "Swipe to clean",
      body: "← Keep · ↑ Trim · → Delete."
    },
    {
      icon: /* @__PURE__ */ jsxRuntimeExports.jsx(Flame, { className: "h-7 w-7" }),
      title: "5 minutes a day",
      body: "Free GBs. Keep your streak."
    }
  ];
  const cur = steps[step];
  const last = step === steps.length - 1;
  function next() {
    if (last) {
      updateSettings({ onboarded: true });
      onDone();
    } else {
      setStep(step + 1);
    }
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "fixed inset-0 z-50 flex flex-col bg-background px-6 pb-10 pt-[max(2rem,env(safe-area-inset-top))]", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex justify-center gap-1.5", children: steps.map((_, i) => /* @__PURE__ */ jsxRuntimeExports.jsx(
      "div",
      {
        className: `h-1 w-10 rounded-full ${i <= step ? "bg-primary" : "bg-muted"}`
      },
      i
    )) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex flex-1 flex-col items-center justify-center text-center", children: /* @__PURE__ */ jsxRuntimeExports.jsx(AnimatePresence, { mode: "wait", children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
      motion.div,
      {
        initial: { opacity: 0, y: 16 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -16 },
        transition: { duration: 0.25 },
        className: "flex flex-col items-center",
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-card", children: cur.icon }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "mt-5 font-display text-3xl font-bold tracking-tight", children: cur.title }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-3 max-w-xs text-sm text-muted-foreground text-balance", children: cur.body }),
          step === 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-6 flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-xs text-muted-foreground", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(Lock, { className: "h-3.5 w-3.5 text-primary" }),
            "Data Not Collected · No analytics · No ads"
          ] })
        ]
      },
      step
    ) }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "button",
      {
        onClick: next,
        className: "inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary py-4 text-sm font-semibold text-primary-foreground shadow-card transition hover:opacity-90",
        children: [
          last ? "Get started" : "Continue",
          " ",
          /* @__PURE__ */ jsxRuntimeExports.jsx(ArrowRight, { className: "h-4 w-4" })
        ]
      }
    ),
    !last && /* @__PURE__ */ jsxRuntimeExports.jsx(
      "button",
      {
        onClick: () => {
          updateSettings({ onboarded: true });
          onDone();
        },
        className: "mt-2 text-xs font-medium text-muted-foreground hover:text-foreground",
        children: "Skip"
      }
    )
  ] });
}
const SWIPE_THRESHOLD = 110;
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function SwipeDeck() {
  const stats = useStats();
  const cardsPerRound = Math.min(30, Math.max(5, stats.settings.cardsPerRound));
  const [queue, setQueue] = reactExports.useState(() => SAMPLE_PHOTOS.slice(0, cardsPerRound));
  const [recap, setRecap] = reactExports.useState(null);
  const [paywallOpen, setPaywallOpen] = reactExports.useState(false);
  const [iCloudWarn, setICloudWarn] = reactExports.useState(null);
  const [showOnboarding, setShowOnboarding] = reactExports.useState(false);
  reactExports.useEffect(() => {
    setQueue((q) => q === SAMPLE_PHOTOS.slice(0, cardsPerRound) ? shuffle(SAMPLE_PHOTOS).slice(0, cardsPerRound) : q);
    if (!stats.settings.onboarded) setShowOnboarding(true);
  }, []);
  const sessionRef = reactExports.useRef({ kept: 0, trimmed: 0, deleted: 0, freed: 0 });
  const seenICloudWarnRef = reactExports.useRef(false);
  const top = queue[0];
  const next = queue[1];
  const trimsLeft = stats.isPro ? Infinity : Math.max(0, FREE_TRIM_LIMIT - (stats.trimsTodayDate === (/* @__PURE__ */ new Date()).toISOString().slice(0, 10) ? stats.trimsToday : 0));
  function commitDelete(photo) {
    const sess = sessionRef.current;
    sess.deleted += 1;
    sess.freed += photo.sizeMB;
    setStats((s) => ({ ...s, deleted: s.deleted + 1, mbFreed: s.mbFreed + photo.sizeMB }));
    logDay({ deleted: 1, mbFreed: photo.sizeMB });
    softDelete({ id: photo.id, title: photo.title, sizeMB: photo.sizeMB });
    toast.success(`Deleted · freed ${photo.sizeMB.toFixed(1)} MB`, {
      duration: 5e3,
      icon: /* @__PURE__ */ jsxRuntimeExports.jsx(Undo2, { className: "h-4 w-4" }),
      description: "Tap Undo to restore. Stays in Recently Deleted for 30 days.",
      action: {
        label: "Undo",
        onClick: () => {
          undoDelete(photo.id);
          setStats((s) => ({
            ...s,
            deleted: Math.max(0, s.deleted - 1),
            mbFreed: Math.max(0, s.mbFreed - photo.sizeMB)
          }));
          sess.deleted = Math.max(0, sess.deleted - 1);
          sess.freed = Math.max(0, sess.freed - photo.sizeMB);
          setQueue((q) => [photo, ...q]);
          toast.success("Restored");
        }
      }
    });
    advance();
  }
  function advance() {
    setQueue((q) => {
      const rest = q.slice(1);
      if (rest.length === 0) {
        bumpStreak();
        setRecap({ ...sessionRef.current });
        sessionRef.current = { kept: 0, trimmed: 0, deleted: 0, freed: 0 };
      }
      return rest;
    });
  }
  function handleAction(photo, action) {
    const sess = sessionRef.current;
    if (action === "trim" && !canTrim()) {
      setPaywallOpen(true);
      return;
    }
    if (action === "keep") {
      sess.kept += 1;
      setStats((s) => ({ ...s, cleaned: s.cleaned + 1 }));
      logDay({ kept: 1 });
      advance();
    } else if (action === "trim") {
      const saved = +(photo.sizeMB * 0.32).toFixed(2);
      sess.trimmed += 1;
      sess.freed += saved;
      setStats((s) => ({ ...s, slimmed: s.slimmed + 1, mbFreed: s.mbFreed + saved }));
      logDay({ trimmed: 1, mbFreed: saved });
      recordTrim();
      const remaining = trimsRemainingToday();
      toast.success(`Slimmed · saved ${saved.toFixed(1)} MB`, {
        description: stats.isPro ? photo.hasGPS ? "GPS & device tags stripped" : "Metadata stripped" : `${remaining} free trim${remaining === 1 ? "" : "s"} left today`
      });
      advance();
    } else if (action === "delete") {
      if (stats.settings.iCloudBackupWarn && !seenICloudWarnRef.current) {
        seenICloudWarnRef.current = true;
        setICloudWarn({ photo });
        return;
      }
      commitDelete(photo);
    }
  }
  function reset() {
    setQueue(shuffle(SAMPLE_PHOTOS).slice(0, cardsPerRound));
    setRecap(null);
  }
  if (showOnboarding) {
    return /* @__PURE__ */ jsxRuntimeExports.jsx(Onboarding, { onDone: () => setShowOnboarding(false) });
  }
  if (recap) {
    return /* @__PURE__ */ jsxRuntimeExports.jsx(SessionSummary, { recap, onContinue: reset });
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col items-center px-5 pt-4", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex w-full max-w-sm items-center justify-between", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-xs uppercase tracking-[0.18em] text-muted-foreground", children: [
        queue.length,
        " left"
      ] }),
      !stats.isPro && /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold tabular-nums text-muted-foreground", children: [
        trimsLeft,
        "/",
        FREE_TRIM_LIMIT,
        " free trims today"
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "relative mt-4 h-[460px] w-full max-w-sm", children: /* @__PURE__ */ jsxRuntimeExports.jsxs(AnimatePresence, { children: [
      next && /* @__PURE__ */ jsxRuntimeExports.jsx(PhotoCard, { photo: next, stacked: true }, next.id),
      top && /* @__PURE__ */ jsxRuntimeExports.jsx(
        SwipeableCard,
        {
          photo: top,
          onAction: (a) => handleAction(top, a)
        },
        top.id
      ),
      !top && !recap && /* @__PURE__ */ jsxRuntimeExports.jsx(EmptyDeckCard, { onReset: reset })
    ] }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-6 flex w-full max-w-sm items-center justify-center gap-4", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        ActionButton,
        {
          label: "Keep",
          variant: "keep",
          icon: /* @__PURE__ */ jsxRuntimeExports.jsx(ArrowLeft, { className: "h-5 w-5" }),
          onClick: () => top && handleAction(top, "keep"),
          disabled: !top
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        ActionButton,
        {
          label: "Trim",
          variant: "trim",
          icon: /* @__PURE__ */ jsxRuntimeExports.jsx(ArrowUp, { className: "h-6 w-6" }),
          big: true,
          onClick: () => top && handleAction(top, "trim"),
          disabled: !top
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        ActionButton,
        {
          label: "Delete",
          variant: "delete",
          icon: /* @__PURE__ */ jsxRuntimeExports.jsx(ArrowRight, { className: "h-5 w-5" }),
          onClick: () => top && handleAction(top, "delete"),
          disabled: !top
        }
      )
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-5 text-center text-xs text-muted-foreground", children: "← Keep · ↑ Trim (slim & strip metadata) · → Delete" }),
    paywallOpen && /* @__PURE__ */ jsxRuntimeExports.jsx(
      PaywallModal,
      {
        onClose: () => setPaywallOpen(false),
        onUpgrade: () => {
          setPro(true);
          setPaywallOpen(false);
          toast.success("Pro unlocked · unlimited trims");
        }
      }
    ),
    iCloudWarn && /* @__PURE__ */ jsxRuntimeExports.jsx(
      ICloudWarnModal,
      {
        photo: iCloudWarn.photo,
        onCancel: () => {
          seenICloudWarnRef.current = false;
          setICloudWarn(null);
        },
        onConfirm: (disable) => {
          if (disable) updateSettings({ iCloudBackupWarn: false });
          const p = iCloudWarn.photo;
          setICloudWarn(null);
          commitDelete(p);
        }
      }
    )
  ] });
}
function EmptyDeckCard({ onReset }) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    motion.div,
    {
      initial: { opacity: 0, scale: 0.95 },
      animate: { opacity: 1, scale: 1 },
      className: "absolute inset-0 flex flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-card/60 p-6 text-center",
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex h-14 w-14 items-center justify-center rounded-2xl bg-success/15 text-success", children: /* @__PURE__ */ jsxRuntimeExports.jsx(PartyPopper, { className: "h-6 w-6" }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { className: "mt-3 font-display text-xl font-bold", children: "All caught up" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-1 text-sm text-muted-foreground", children: "You're done with this batch. Take a breath." }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(
          "button",
          {
            onClick: onReset,
            className: "mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground shadow-card hover:opacity-90",
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(RefreshCw, { className: "h-3.5 w-3.5" }),
              " Load another set"
            ]
          }
        )
      ]
    }
  );
}
function ICloudWarnModal({
  photo,
  onCancel,
  onConfirm
}) {
  const [disable, setDisable] = reactExports.useState(false);
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    "div",
    {
      className: "fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center",
      onClick: onCancel,
      children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
        "div",
        {
          className: "w-full max-w-sm rounded-t-3xl border border-border bg-card p-6 shadow-card sm:rounded-3xl",
          onClick: (e) => e.stopPropagation(),
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex h-12 w-12 items-center justify-center rounded-2xl bg-warm/30 text-warm-foreground", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Cloud, { className: "h-5 w-5" }) }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { className: "mt-4 font-display text-2xl font-bold", children: "Backed up to iCloud?" }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "mt-1 text-sm text-muted-foreground", children: [
              "We can't tell yet whether ",
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-medium text-foreground", children: photo.title }),
              " is backed up. Once you delete it from your library, it's gone for good after 30 days in Recently Deleted. Make sure iCloud Photos has finished syncing before you continue."
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "mt-4 flex items-center gap-2 text-xs text-muted-foreground", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                "input",
                {
                  type: "checkbox",
                  checked: disable,
                  onChange: (e) => setDisable(e.target.checked),
                  className: "h-4 w-4 accent-primary"
                }
              ),
              "Don't show this again"
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-5 flex gap-2", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                "button",
                {
                  onClick: onCancel,
                  className: "flex-1 rounded-full border border-border bg-background py-3 text-sm font-semibold text-foreground transition hover:bg-muted",
                  children: "Cancel"
                }
              ),
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                "button",
                {
                  onClick: () => onConfirm(disable),
                  className: "flex-1 rounded-full bg-destructive py-3 text-sm font-semibold text-destructive-foreground shadow-card transition hover:opacity-90",
                  children: "Delete anyway"
                }
              )
            ] })
          ]
        }
      )
    }
  );
}
function SwipeableCard({
  photo,
  onAction
}) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-14, 14]);
  const keepOpacity = useTransform(x, [-150, -40, 0], [1, 0.6, 0]);
  const deleteOpacity = useTransform(x, [0, 40, 150], [0, 0.6, 1]);
  const trimOpacity = useTransform(y, [-150, -40, 0], [1, 0.6, 0]);
  function onDragEnd(_, info) {
    const { offset } = info;
    if (offset.y < -SWIPE_THRESHOLD && Math.abs(offset.y) > Math.abs(offset.x)) {
      onAction("trim");
    } else if (offset.x > SWIPE_THRESHOLD) {
      onAction("delete");
    } else if (offset.x < -SWIPE_THRESHOLD) {
      onAction("keep");
    }
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    motion.div,
    {
      style: { x, y, rotate },
      drag: true,
      dragElastic: 0.6,
      dragConstraints: { left: 0, right: 0, top: 0, bottom: 0 },
      onDragEnd,
      initial: { opacity: 0, scale: 0.96 },
      animate: { opacity: 1, scale: 1 },
      exit: { opacity: 0, scale: 0.9, transition: { duration: 0.18 } },
      className: "absolute inset-0 cursor-grab active:cursor-grabbing",
      children: /* @__PURE__ */ jsxRuntimeExports.jsxs(PhotoCard, { photo, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs(
          motion.div,
          {
            style: { opacity: keepOpacity },
            className: "pointer-events-none absolute inset-y-0 left-0 w-1/2",
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "absolute inset-y-0 left-0 w-full bg-gradient-to-r from-success/80 via-success/30 to-transparent" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "absolute inset-y-0 left-0 w-2.5 bg-success shadow-[0_0_24px_rgba(0,200,120,0.6)]" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "absolute left-5 top-6 rotate-[-10deg] rounded-xl border-4 border-success bg-success/20 px-4 py-1.5 text-lg font-extrabold uppercase tracking-wider text-white backdrop-blur", children: "Keep" })
            ]
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(
          motion.div,
          {
            style: { opacity: deleteOpacity },
            className: "pointer-events-none absolute inset-y-0 right-0 w-1/2",
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "absolute inset-y-0 right-0 w-full bg-gradient-to-l from-destructive/80 via-destructive/30 to-transparent" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "absolute inset-y-0 right-0 w-2.5 bg-destructive shadow-[0_0_24px_rgba(220,60,40,0.6)]" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "absolute right-5 top-6 rotate-[10deg] rounded-xl border-4 border-destructive bg-destructive/25 px-4 py-1.5 text-lg font-extrabold uppercase tracking-wider text-white backdrop-blur", children: "Delete" })
            ]
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          motion.div,
          {
            style: { opacity: trimOpacity },
            className: "pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-lg border-2 border-warm bg-warm/30 px-3 py-1 text-sm font-bold uppercase tracking-wider text-white backdrop-blur",
            children: "Trim"
          }
        )
      ] })
    }
  );
}
function PhotoCard({
  photo,
  stacked,
  children
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "div",
    {
      className: cn(
        "absolute inset-0 overflow-hidden rounded-3xl border border-border bg-card shadow-card",
        stacked && "scale-[0.96] opacity-70 blur-[1px]"
      ),
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "img",
          {
            src: photo.url,
            alt: photo.title,
            loading: "lazy",
            className: "h-full w-full object-cover"
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "absolute left-4 right-4 top-4 flex items-center justify-between gap-2", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "rounded-full bg-black/40 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur", children: [
            photo.sizeMB.toFixed(1),
            " MB"
          ] }),
          photo.hasGPS && /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "flex items-center gap-1 rounded-full bg-black/40 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(MapPin, { className: "h-3 w-3" }),
            " GPS"
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "absolute bottom-5 left-5 right-5 text-white", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { className: "font-display text-2xl font-bold leading-tight", children: photo.title }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "mt-1 text-xs opacity-80", children: [
            photo.month,
            " ",
            photo.year,
            " · ",
            photo.device
          ] })
        ] }),
        children
      ]
    }
  );
}
function ActionButton({
  label,
  icon,
  onClick,
  variant,
  big,
  disabled
}) {
  const styles = {
    keep: "bg-card text-foreground border-border hover:border-accent hover:text-accent-foreground hover:bg-accent/15",
    trim: "bg-primary text-primary-foreground border-primary shadow-card",
    delete: "bg-card text-destructive border-border hover:border-destructive hover:bg-destructive/10"
  }[variant];
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "button",
    {
      onClick,
      disabled,
      "aria-label": label,
      className: cn(
        "group flex flex-col items-center gap-1 rounded-2xl border px-4 py-3 transition disabled:opacity-40",
        big ? "min-w-[96px]" : "min-w-[80px]",
        styles
      ),
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "span",
          {
            className: cn(
              "flex items-center justify-center rounded-full",
              big ? "h-10 w-10" : "h-8 w-8",
              variant === "trim" ? "bg-primary-foreground/15" : "bg-transparent"
            ),
            children: icon
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs font-semibold tracking-wide", children: label })
      ]
    }
  );
}
function SessionSummary({
  recap,
  onContinue
}) {
  const total = recap.kept + recap.trimmed + recap.deleted;
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col items-center px-6 pt-10 text-center", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-primary", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Sparkles, { className: "h-7 w-7" }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "mt-4 font-display text-2xl font-bold", children: "Set complete" }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "mt-1 text-sm text-muted-foreground text-balance", children: [
      "You reviewed ",
      total,
      " photos and freed ",
      recap.freed.toFixed(1),
      " MB."
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-8 grid w-full max-w-sm grid-cols-3 gap-3", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(Stat, { label: "Kept", value: recap.kept, tone: "text-foreground" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(Stat, { label: "Trimmed", value: recap.trimmed, tone: "text-primary" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(Stat, { label: "Deleted", value: recap.deleted, tone: "text-destructive" })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-6 w-full max-w-sm rounded-2xl border border-border bg-card p-5", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs uppercase tracking-wider text-muted-foreground", children: "Storage freed" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "mt-1 font-display text-3xl font-bold tabular-nums", children: [
        recap.freed.toFixed(1),
        " ",
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-base text-muted-foreground", children: "MB" })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "button",
      {
        onClick: onContinue,
        className: "mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-card transition hover:opacity-90",
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(RefreshCw, { className: "h-4 w-4" }),
          " New set"
        ]
      }
    )
  ] });
}
function Stat({ label, value, tone }) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rounded-2xl border border-border bg-card p-4 text-center", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: cn("font-display text-2xl font-bold tabular-nums", tone), children: value }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-1 text-[11px] uppercase tracking-wider text-muted-foreground", children: label })
  ] });
}
function PaywallModal({ onClose, onUpgrade }) {
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
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Lock, { className: "h-5 w-5" }) }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { className: "mt-4 font-display text-2xl font-bold", children: "Daily free limit reached" }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "mt-1 text-sm text-muted-foreground", children: [
              "You've used your ",
              FREE_TRIM_LIMIT,
              " free trims for today. Upgrade to Slim Pro for unlimited trims, or come back tomorrow."
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-5 space-y-2", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2 text-sm", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(Sparkles, { className: "h-4 w-4 text-primary" }),
                " Unlimited daily trims"
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2 text-sm", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(Sparkles, { className: "h-4 w-4 text-primary" }),
                " Strip GPS & metadata in bulk"
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2 text-sm", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(Sparkles, { className: "h-4 w-4 text-primary" }),
                " Heavy Hitters & history"
              ] })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "button",
              {
                onClick: onUpgrade,
                className: "mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-card transition hover:opacity-90",
                children: "Unlock Slim Pro"
              }
            ),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "button",
              {
                onClick: onClose,
                className: "mt-2 inline-flex w-full items-center justify-center rounded-full py-2.5 text-sm font-medium text-muted-foreground transition hover:text-foreground",
                children: "Maybe later"
              }
            )
          ]
        }
      )
    }
  );
}
function Index() {
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex flex-col", children: /* @__PURE__ */ jsxRuntimeExports.jsx(SwipeDeck, {}) });
}
export {
  Index as component
};
