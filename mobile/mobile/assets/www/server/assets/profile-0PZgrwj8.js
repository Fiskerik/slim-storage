import { r as reactExports, j as jsxRuntimeExports } from "./worker-entry-CoKMp4xS.js";
import { c as createLucideIcon, a as cn, u as useStats, t as toast, U as User, s as setPro, b as updateSettings, L as Layers, S as Shield, d as deleteAllData } from "./router-DXWOG26a.js";
import { u as useComposedRefs, a as useControllableState, P as Primitive, c as composeEventHandlers, b as usePrevious, d as useSize, e as createContextScope, C as Check, S as Slider } from "./slider-Cu8amGKK.js";
import { X, R as RotateCcw } from "./x-BelgsWCN.js";
import { S as Sparkles } from "./sparkles-Dq14kSuc.js";
import { C as Cloud } from "./cloud-DpVw2JWT.js";
import { T as Trash2 } from "./trash-2-DaOcsTfD.js";
import "node:events";
import "node:async_hooks";
import "node:stream/web";
import "node:stream";
const __iconNode$5 = [
  ["path", { d: "M10.268 21a2 2 0 0 0 3.464 0", key: "vwvbt9" }],
  [
    "path",
    {
      d: "M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326",
      key: "11g9vi"
    }
  ]
];
const Bell = createLucideIcon("bell", __iconNode$5);
const __iconNode$4 = [["path", { d: "m9 18 6-6-6-6", key: "mthhwq" }]];
const ChevronRight = createLucideIcon("chevron-right", __iconNode$4);
const __iconNode$3 = [
  [
    "path",
    {
      d: "M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z",
      key: "1vdc57"
    }
  ],
  ["path", { d: "M5 21h14", key: "11awu3" }]
];
const Crown = createLucideIcon("crown", __iconNode$3);
const __iconNode$2 = [
  ["path", { d: "M12 15V3", key: "m9g1x1" }],
  ["path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", key: "ih7n3h" }],
  ["path", { d: "m7 10 5 5 5-5", key: "brsn70" }]
];
const Download = createLucideIcon("download", __iconNode$2);
const __iconNode$1 = [
  [
    "path",
    {
      d: "M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z",
      key: "1a8usu"
    }
  ],
  ["path", { d: "m15 5 4 4", key: "1mk7zo" }]
];
const Pencil = createLucideIcon("pencil", __iconNode$1);
const __iconNode = [
  ["circle", { cx: "18", cy: "5", r: "3", key: "gq8acd" }],
  ["circle", { cx: "6", cy: "12", r: "3", key: "w7nqdw" }],
  ["circle", { cx: "18", cy: "19", r: "3", key: "1xt0gg" }],
  ["line", { x1: "8.59", x2: "15.42", y1: "13.51", y2: "17.49", key: "47mynk" }],
  ["line", { x1: "15.41", x2: "8.59", y1: "6.51", y2: "10.49", key: "1n3mei" }]
];
const Share2 = createLucideIcon("share-2", __iconNode);
var SWITCH_NAME = "Switch";
var [createSwitchContext] = createContextScope(SWITCH_NAME);
var [SwitchProvider, useSwitchContext] = createSwitchContext(SWITCH_NAME);
var Switch$1 = reactExports.forwardRef(
  (props, forwardedRef) => {
    const {
      __scopeSwitch,
      name,
      checked: checkedProp,
      defaultChecked,
      required,
      disabled,
      value = "on",
      onCheckedChange,
      form,
      ...switchProps
    } = props;
    const [button, setButton] = reactExports.useState(null);
    const composedRefs = useComposedRefs(forwardedRef, (node) => setButton(node));
    const hasConsumerStoppedPropagationRef = reactExports.useRef(false);
    const isFormControl = button ? form || !!button.closest("form") : true;
    const [checked, setChecked] = useControllableState({
      prop: checkedProp,
      defaultProp: defaultChecked ?? false,
      onChange: onCheckedChange,
      caller: SWITCH_NAME
    });
    return /* @__PURE__ */ jsxRuntimeExports.jsxs(SwitchProvider, { scope: __scopeSwitch, checked, disabled, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        Primitive.button,
        {
          type: "button",
          role: "switch",
          "aria-checked": checked,
          "aria-required": required,
          "data-state": getState(checked),
          "data-disabled": disabled ? "" : void 0,
          disabled,
          value,
          ...switchProps,
          ref: composedRefs,
          onClick: composeEventHandlers(props.onClick, (event) => {
            setChecked((prevChecked) => !prevChecked);
            if (isFormControl) {
              hasConsumerStoppedPropagationRef.current = event.isPropagationStopped();
              if (!hasConsumerStoppedPropagationRef.current) event.stopPropagation();
            }
          })
        }
      ),
      isFormControl && /* @__PURE__ */ jsxRuntimeExports.jsx(
        SwitchBubbleInput,
        {
          control: button,
          bubbles: !hasConsumerStoppedPropagationRef.current,
          name,
          value,
          checked,
          required,
          disabled,
          form,
          style: { transform: "translateX(-100%)" }
        }
      )
    ] });
  }
);
Switch$1.displayName = SWITCH_NAME;
var THUMB_NAME = "SwitchThumb";
var SwitchThumb = reactExports.forwardRef(
  (props, forwardedRef) => {
    const { __scopeSwitch, ...thumbProps } = props;
    const context = useSwitchContext(THUMB_NAME, __scopeSwitch);
    return /* @__PURE__ */ jsxRuntimeExports.jsx(
      Primitive.span,
      {
        "data-state": getState(context.checked),
        "data-disabled": context.disabled ? "" : void 0,
        ...thumbProps,
        ref: forwardedRef
      }
    );
  }
);
SwitchThumb.displayName = THUMB_NAME;
var BUBBLE_INPUT_NAME = "SwitchBubbleInput";
var SwitchBubbleInput = reactExports.forwardRef(
  ({
    __scopeSwitch,
    control,
    checked,
    bubbles = true,
    ...props
  }, forwardedRef) => {
    const ref = reactExports.useRef(null);
    const composedRefs = useComposedRefs(ref, forwardedRef);
    const prevChecked = usePrevious(checked);
    const controlSize = useSize(control);
    reactExports.useEffect(() => {
      const input = ref.current;
      if (!input) return;
      const inputProto = window.HTMLInputElement.prototype;
      const descriptor = Object.getOwnPropertyDescriptor(
        inputProto,
        "checked"
      );
      const setChecked = descriptor.set;
      if (prevChecked !== checked && setChecked) {
        const event = new Event("click", { bubbles });
        setChecked.call(input, checked);
        input.dispatchEvent(event);
      }
    }, [prevChecked, checked, bubbles]);
    return /* @__PURE__ */ jsxRuntimeExports.jsx(
      "input",
      {
        type: "checkbox",
        "aria-hidden": true,
        defaultChecked: checked,
        ...props,
        tabIndex: -1,
        ref: composedRefs,
        style: {
          ...props.style,
          ...controlSize,
          position: "absolute",
          pointerEvents: "none",
          opacity: 0,
          margin: 0
        }
      }
    );
  }
);
SwitchBubbleInput.displayName = BUBBLE_INPUT_NAME;
function getState(checked) {
  return checked ? "checked" : "unchecked";
}
var Root = Switch$1;
var Thumb = SwitchThumb;
const Switch = reactExports.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsxRuntimeExports.jsx(
  Root,
  {
    className: cn(
      "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
      className
    ),
    ...props,
    ref,
    children: /* @__PURE__ */ jsxRuntimeExports.jsx(
      Thumb,
      {
        className: cn(
          "pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0"
        )
      }
    )
  }
));
Switch.displayName = Root.displayName;
function ShareStatsCard({ onClose }) {
  const stats = useStats();
  const ref = reactExports.useRef(null);
  const [busy, setBusy] = reactExports.useState(false);
  const freed = stats.mbFreed;
  const freedLabel = freed >= 1024 ? `${(freed / 1024).toFixed(2)} GB` : `${freed.toFixed(1)} MB`;
  const reviewed = stats.cleaned + stats.deleted + stats.slimmed;
  const fmtDate = (iso) => (/* @__PURE__ */ new Date(iso + "T00:00:00")).toLocaleDateString(void 0, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
  const startedLabel = stats.startedAt ? fmtDate(stats.startedAt) : null;
  const bestDay = (stats.daily ?? []).reduce(
    (best, d) => d.mbFreed > (best?.mbFreed ?? 0) ? d : best,
    null
  );
  const bestLabel = bestDay ? `${bestDay.mbFreed >= 1024 ? (bestDay.mbFreed / 1024).toFixed(2) + " GB" : bestDay.mbFreed.toFixed(1) + " MB"} · ${fmtDate(bestDay.date)}` : null;
  async function share() {
    try {
      setBusy(true);
      const text = `I freed ${freedLabel} with Slim 🧹
${reviewed} photos reviewed · 🔥 ${stats.streak}-day streak`;
      const nav = navigator;
      if (nav.share) {
        await nav.share({ title: "Slim", text });
      } else {
        await navigator.clipboard.writeText(text);
        toast.success("Copied to clipboard");
      }
    } catch {
    } finally {
      setBusy(false);
    }
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    "div",
    {
      className: "fixed inset-0 z-50 flex items-end justify-center bg-black/55 backdrop-blur-sm sm:items-center",
      onClick: onClose,
      children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
        "div",
        {
          className: "w-full max-w-sm rounded-t-3xl border border-border bg-card p-5 shadow-card sm:rounded-3xl",
          onClick: (e) => e.stopPropagation(),
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-start justify-between", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs uppercase tracking-wider text-muted-foreground", children: "Share" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { className: "mt-0.5 font-display text-xl font-bold", children: "Your Slim card" })
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
            /* @__PURE__ */ jsxRuntimeExports.jsxs(
              "div",
              {
                ref,
                className: "mt-4 overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary to-warm p-6 text-primary-foreground",
                children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2 text-xs opacity-85", children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx(Sparkles, { className: "h-3.5 w-3.5" }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "uppercase tracking-[0.18em]", children: "Slim · on-device" })
                  ] }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-6 font-display text-5xl font-bold tabular-nums", children: freedLabel }),
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "mt-1 text-sm opacity-90", children: [
                    "saved",
                    startedLabel ? ` since ${startedLabel}` : ""
                  ] }),
                  bestLabel && /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "mt-1 text-xs opacity-80", children: [
                    "Best day · ",
                    bestLabel
                  ] }),
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-6 grid grid-cols-3 gap-3 text-center", children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx(Mini, { label: "Reviewed", value: reviewed }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx(Mini, { label: "Streak", value: `🔥${stats.streak}` }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx(Mini, { label: "Memory", value: stats.memoryPlayed })
                  ] })
                ]
              }
            ),
            /* @__PURE__ */ jsxRuntimeExports.jsxs(
              "button",
              {
                disabled: busy,
                onClick: share,
                className: "mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-card transition hover:opacity-90 disabled:opacity-60",
                children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(Share2, { className: "h-4 w-4" }),
                  " Share"
                ]
              }
            ),
            /* @__PURE__ */ jsxRuntimeExports.jsxs(
              "button",
              {
                onClick: async () => {
                  const text = `I freed ${freedLabel} with Slim — ${reviewed} photos reviewed.`;
                  await navigator.clipboard.writeText(text);
                  toast.success("Copied");
                },
                className: "mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-sm font-medium text-muted-foreground transition hover:text-foreground",
                children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(Download, { className: "h-4 w-4" }),
                  " Copy text"
                ]
              }
            )
          ]
        }
      )
    }
  );
}
function Mini({ label, value }) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rounded-xl bg-white/15 p-2 backdrop-blur", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "font-display text-base font-bold tabular-nums", children: value }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-[9px] uppercase tracking-wider opacity-80", children: label })
  ] });
}
function ProfilePage() {
  const stats = useStats();
  const s = stats.settings;
  const [editingName, setEditingName] = reactExports.useState(false);
  const [name, setName] = reactExports.useState(s.displayName);
  const [shareOpen, setShareOpen] = reactExports.useState(false);
  const freed = stats.mbFreed;
  const freedLabel = freed >= 1024 ? `${(freed / 1024).toFixed(2)} GB` : `${freed.toFixed(1)} MB`;
  const reviewed = stats.cleaned + stats.deleted + stats.slimmed;
  function saveName() {
    updateSettings({ displayName: name.trim() || "You" });
    setEditingName(false);
  }
  function deleteAll() {
    if (confirm(
      "Delete all Slim data? This wipes your stats, streak, settings, and history. This cannot be undone."
    )) {
      deleteAllData();
      toast.success("All data deleted");
    }
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "px-5 pt-5 pb-8", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("header", { className: "flex items-center gap-4", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary to-warm text-primary-foreground shadow-card", children: /* @__PURE__ */ jsxRuntimeExports.jsx(User, { className: "h-7 w-7" }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "min-w-0 flex-1", children: [
        editingName ? /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "input",
            {
              value: name,
              onChange: (e) => setName(e.target.value),
              maxLength: 20,
              autoFocus: true,
              className: "w-full rounded-lg border border-border bg-background px-2 py-1 font-display text-xl font-bold focus:outline-none focus:ring-2 focus:ring-primary"
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "button",
            {
              onClick: saveName,
              className: "rounded-full bg-primary p-1.5 text-primary-foreground",
              children: /* @__PURE__ */ jsxRuntimeExports.jsx(Check, { className: "h-3.5 w-3.5" })
            }
          )
        ] }) : /* @__PURE__ */ jsxRuntimeExports.jsxs(
          "button",
          {
            onClick: () => setEditingName(true),
            className: "group flex items-center gap-1.5 text-left",
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { className: "font-display text-2xl font-bold tracking-tight", children: s.displayName }),
              /* @__PURE__ */ jsxRuntimeExports.jsx(Pencil, { className: "h-3.5 w-3.5 text-muted-foreground opacity-0 transition group-hover:opacity-100" })
            ]
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-0.5 flex items-center gap-2 text-xs text-muted-foreground", children: stats.isPro ? /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 font-semibold text-primary", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Crown, { className: "h-3 w-3" }),
          " Slim Pro"
        ] }) : /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
          "Free plan · ",
          Math.max(0, 10 - (stats.trimsToday ?? 0)),
          " trims left today"
        ] }) })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "mt-6 grid grid-cols-3 gap-3", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(SummaryStat, { label: "Freed", value: freedLabel, accent: true }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(SummaryStat, { label: "Reviewed", value: reviewed }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(SummaryStat, { label: "Streak", value: `🔥 ${stats.streak}` })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "button",
      {
        onClick: () => setShareOpen(true),
        className: "mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card py-3 text-sm font-semibold text-foreground transition hover:border-primary/40",
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Share2, { className: "h-4 w-4" }),
          " Share my Slim card"
        ]
      }
    ),
    !stats.isPro && /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "button",
      {
        onClick: () => {
          setPro(true);
          toast.success("Slim Pro unlocked");
        },
        className: "mt-3 flex w-full items-center justify-between rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-warm/15 p-4 text-left transition hover:from-primary/15",
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-3", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Crown, { className: "h-5 w-5" }) }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "font-semibold", children: "Upgrade to Slim Pro" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground", children: "Unlimited trims · bulk metadata strip" })
            ] })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(ChevronRight, { className: "h-4 w-4 text-muted-foreground" })
        ]
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "mt-7 px-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground", children: "Game settings" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-3 space-y-3", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
      SliderRow,
      {
        icon: /* @__PURE__ */ jsxRuntimeExports.jsx(Layers, { className: "h-4 w-4" }),
        label: "Cards per round",
        hint: "How many photos per Memory and Swipe round",
        value: s.cardsPerRound,
        min: 5,
        max: 30,
        step: 1,
        onChange: (v) => updateSettings({ cardsPerRound: v }),
        suffix: "cards"
      }
    ) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "mt-7 px-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground", children: "Sync & reminders" }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-3 space-y-3", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        ToggleRow,
        {
          icon: /* @__PURE__ */ jsxRuntimeExports.jsx(Cloud, { className: "h-4 w-4" }),
          label: "Sync with iCloud",
          hint: "Keep stats and streak across your devices",
          checked: s.iCloudSync,
          onChange: (v) => updateSettings({ iCloudSync: v })
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        ToggleRow,
        {
          icon: /* @__PURE__ */ jsxRuntimeExports.jsx(Shield, { className: "h-4 w-4" }),
          label: "Warn before deleting un-backed-up photos",
          hint: "Recommended. Stops you from losing originals.",
          checked: s.iCloudBackupWarn,
          onChange: (v) => updateSettings({ iCloudBackupWarn: v })
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        ToggleRow,
        {
          icon: /* @__PURE__ */ jsxRuntimeExports.jsx(Bell, { className: "h-4 w-4" }),
          label: "Daily reminder",
          hint: s.reminderEnabled ? `At ${s.reminderTime}` : "Off",
          checked: s.reminderEnabled,
          onChange: (v) => updateSettings({ reminderEnabled: v })
        }
      ),
      s.reminderEnabled && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rounded-2xl border border-border bg-card p-4", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "text-xs font-medium uppercase tracking-wider text-muted-foreground", children: "Reminder time" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "input",
          {
            type: "time",
            value: s.reminderTime,
            onChange: (e) => updateSettings({ reminderTime: e.target.value }),
            className: "mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 font-display text-lg font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-primary"
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "mt-7 px-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground", children: "Privacy" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-3 rounded-2xl border border-border bg-card p-4", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-3", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex h-9 w-9 items-center justify-center rounded-xl bg-success/15 text-success", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Shield, { className: "h-4 w-4" }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm font-semibold", children: "Data Not Collected" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-0.5 text-xs text-muted-foreground", children: "No analytics, no ads, no cloud upload of your photos. Ever." })
      ] })
    ] }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "mt-7 px-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground", children: "Account" }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-3 space-y-2", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs(
        "button",
        {
          onClick: () => toast.success("Restoring purchases…"),
          className: "flex w-full items-center justify-between rounded-2xl border border-border bg-card p-4 text-left transition hover:border-primary/40",
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-3", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(Sparkles, { className: "h-4 w-4 text-primary" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-sm font-medium", children: "Restore purchases" })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(ChevronRight, { className: "h-4 w-4 text-muted-foreground" })
          ]
        }
      ),
      stats.isPro && /* @__PURE__ */ jsxRuntimeExports.jsxs(
        "button",
        {
          onClick: () => {
            setPro(false);
            toast.success("Reverted to free plan");
          },
          className: "flex w-full items-center justify-between rounded-2xl border border-border bg-card p-4 text-left transition hover:border-primary/40",
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-3", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(RotateCcw, { className: "h-4 w-4 text-muted-foreground" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-sm font-medium", children: "Switch back to free (test)" })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(ChevronRight, { className: "h-4 w-4 text-muted-foreground" })
          ]
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(
        "button",
        {
          onClick: deleteAll,
          className: "flex w-full items-center justify-between rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-left text-destructive transition hover:bg-destructive/10",
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-3", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(Trash2, { className: "h-4 w-4" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-sm font-semibold", children: "Delete all Slim data" })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(ChevronRight, { className: "h-4 w-4" })
          ]
        }
      )
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-6 text-center text-[10px] text-muted-foreground", children: "Slim · v1.0 · Made with ❤️ for cluttered camera rolls" }),
    shareOpen && /* @__PURE__ */ jsxRuntimeExports.jsx(ShareStatsCard, { onClose: () => setShareOpen(false) })
  ] });
}
function SummaryStat({
  label,
  value,
  accent
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rounded-2xl border border-border bg-card p-3 text-center shadow-soft", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      "p",
      {
        className: cn(
          "font-display text-lg font-bold tabular-nums leading-tight",
          accent && "text-primary"
        ),
        children: value
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-1 text-[10px] uppercase tracking-wider text-muted-foreground", children: label })
  ] });
}
function ToggleRow({
  icon,
  label,
  hint,
  checked,
  onChange
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex min-w-0 items-center gap-3", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground", children: icon }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "min-w-0", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm font-medium", children: label }),
        hint && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-0.5 text-xs text-muted-foreground", children: hint })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(Switch, { checked, onCheckedChange: onChange })
  ] });
}
function SliderRow({
  icon,
  label,
  hint,
  value,
  min,
  max,
  step,
  onChange,
  suffix
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rounded-2xl border border-border bg-card p-4", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-3", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground", children: icon }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "min-w-0 flex-1", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-baseline justify-between", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm font-medium", children: label }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "font-display text-base font-bold tabular-nums text-primary", children: [
            value,
            " ",
            suffix
          ] })
        ] }),
        hint && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-0.5 text-xs text-muted-foreground", children: hint })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      Slider,
      {
        value: [value],
        min,
        max,
        step,
        onValueChange: (v) => onChange(v[0]),
        className: "mt-4"
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-1.5 flex justify-between text-[10px] text-muted-foreground", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: min }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: max })
    ] })
  ] });
}
function ProfileRoute() {
  return /* @__PURE__ */ jsxRuntimeExports.jsx(ProfilePage, {});
}
export {
  ProfileRoute as component
};
