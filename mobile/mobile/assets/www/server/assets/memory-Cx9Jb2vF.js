import { r as reactExports, j as jsxRuntimeExports } from "./worker-entry-CoKMp4xS.js";
import { S as Slider, C as Check } from "./slider-Cu8amGKK.js";
import { A as AnimatePresence, m as motion, M as MEMORY_POOL } from "./photos-BtnfcJev.js";
import { u as useStats, a as cn, e as setStats, l as logDay } from "./router-DXWOG26a.js";
import { A as ArrowRight } from "./arrow-right-DIiZInzO.js";
import { T as Trash2 } from "./trash-2-DaOcsTfD.js";
import { B as Brain } from "./brain-L_Qp_JdL.js";
import { S as Sparkles } from "./sparkles-Dq14kSuc.js";
import "node:events";
import "node:async_hooks";
import "node:stream/web";
import "node:stream";
const MIN_YEAR = 2010;
const MAX_YEAR = (/* @__PURE__ */ new Date()).getFullYear();
function pickRound(n) {
  const pool = [...MEMORY_POOL];
  const out = [];
  while (out.length < n && pool.length) {
    const i = Math.floor(Math.random() * pool.length);
    out.push(pool.splice(i, 1)[0]);
  }
  while (out.length < n) {
    out.push(MEMORY_POOL[Math.floor(Math.random() * MEMORY_POOL.length)]);
  }
  return out;
}
function MemoryGame() {
  const [phase, setPhase] = reactExports.useState("intro");
  const [round, setRound] = reactExports.useState([]);
  const [idx, setIdx] = reactExports.useState(0);
  const [guess, setGuess] = reactExports.useState(2018);
  const [results, setResults] = reactExports.useState([]);
  const stats = useStats();
  const photo = round[idx];
  function start() {
    const size = Math.min(30, Math.max(5, stats.settings.cardsPerRound));
    setRound(pickRound(size));
    setIdx(0);
    setGuess(2018);
    setResults([]);
    setPhase("guess");
  }
  function submitGuess() {
    if (!photo) return;
    setPhase("reveal");
  }
  function decide(keep) {
    if (!photo) return;
    const delta = Math.abs(guess - photo.year);
    const correct = delta <= 1;
    const newResults = [...results, { delta, correct, kept: keep }];
    setStats((s) => {
      const nextStreak = correct ? s.memoryCurrentStreak + 1 : 0;
      return {
        ...s,
        memoryPlayed: s.memoryPlayed + 1,
        memoryCorrect: s.memoryCorrect + (correct ? 1 : 0),
        memoryCurrentStreak: nextStreak,
        memoryBestStreak: Math.max(s.memoryBestStreak, nextStreak),
        memoryTotalDelta: s.memoryTotalDelta + delta,
        // If user chose to clear it, count as deleted + freed
        deleted: keep ? s.deleted : s.deleted + 1,
        cleaned: keep ? s.cleaned + 1 : s.cleaned,
        mbFreed: keep ? s.mbFreed : s.mbFreed + photo.sizeMB
      };
    });
    logDay({
      memoryPlayed: 1,
      kept: keep ? 1 : 0,
      deleted: keep ? 0 : 1,
      mbFreed: keep ? 0 : photo.sizeMB
    });
    setResults(newResults);
    if (idx + 1 >= round.length) {
      setPhase("done");
    } else {
      setIdx(idx + 1);
      setGuess(2018);
      setPhase("guess");
    }
  }
  if (phase === "intro") {
    return /* @__PURE__ */ jsxRuntimeExports.jsx(Intro, { onStart: start, accuracy: stats.memoryPlayed ? Math.round(stats.memoryCorrect / stats.memoryPlayed * 100) : 0, bestStreak: stats.memoryBestStreak });
  }
  if (phase === "done") {
    const correct = results.filter((r) => r.correct).length;
    const freed = results.reduce((sum, r, i) => sum + (r.kept ? 0 : round[i].sizeMB), 0);
    return /* @__PURE__ */ jsxRuntimeExports.jsx(DoneScreen, { correct, total: round.length, freed, onAgain: start });
  }
  if (!photo) return null;
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col items-center px-5 pt-4", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex w-full max-w-sm items-center justify-between text-xs text-muted-foreground", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "uppercase tracking-[0.18em]", children: [
        "Memory · ",
        idx + 1,
        "/",
        round.length
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "tabular-nums", children: [
        "Streak 🔥 ",
        stats.memoryCurrentStreak
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "relative mt-4 h-[420px] w-full max-w-sm overflow-hidden rounded-3xl border border-border bg-card shadow-card", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(AnimatePresence, { mode: "wait", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
        motion.img,
        {
          src: photo.url,
          alt: "Memory photo",
          initial: { opacity: 0, scale: 1.02 },
          animate: { opacity: 1, scale: 1 },
          exit: { opacity: 0 },
          transition: { duration: 0.3 },
          className: "h-full w-full object-cover",
          style: { filter: phase === "reveal" ? "none" : "saturate(0.85)" }
        },
        photo.id
      ) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(AnimatePresence, { children: phase === "reveal" && /* @__PURE__ */ jsxRuntimeExports.jsxs(
        motion.div,
        {
          initial: { opacity: 0, y: 12 },
          animate: { opacity: 1, y: 0 },
          className: "absolute bottom-5 left-5 right-5 rounded-2xl border border-white/15 bg-black/55 p-4 text-white backdrop-blur",
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-[11px] uppercase tracking-wider opacity-80", children: "Actually taken" }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "font-display text-3xl font-bold tabular-nums", children: [
              photo.month,
              " ",
              photo.year
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(ResultBadge, { guess, actual: photo.year })
          ]
        }
      ) })
    ] }),
    phase === "guess" && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-6 w-full max-w-sm", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rounded-2xl border border-border bg-card p-5", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-center text-xs uppercase tracking-wider text-muted-foreground", children: "What year was this taken?" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-2 text-center font-display text-5xl font-bold tabular-nums", children: guess }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          Slider,
          {
            value: [guess],
            min: MIN_YEAR,
            max: MAX_YEAR,
            step: 1,
            onValueChange: (v) => setGuess(v[0]),
            className: "mt-5"
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-2 flex justify-between text-[11px] text-muted-foreground", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: MIN_YEAR }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: MAX_YEAR })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(
        "button",
        {
          onClick: submitGuess,
          className: "mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-card transition hover:opacity-90",
          children: [
            "Reveal ",
            /* @__PURE__ */ jsxRuntimeExports.jsx(ArrowRight, { className: "h-4 w-4" })
          ]
        }
      )
    ] }),
    phase === "reveal" && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-6 grid w-full max-w-sm grid-cols-2 gap-3", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs(
        "button",
        {
          onClick: () => decide(true),
          className: "flex flex-col items-center gap-1 rounded-2xl border border-border bg-card py-4 transition hover:border-accent hover:bg-accent/15",
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(Check, { className: "h-5 w-5 text-accent-foreground" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-sm font-semibold", children: "Keep memory" })
          ]
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(
        "button",
        {
          onClick: () => decide(false),
          className: "flex flex-col items-center gap-1 rounded-2xl border border-border bg-card py-4 text-destructive transition hover:border-destructive hover:bg-destructive/10",
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(Trash2, { className: "h-5 w-5" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-sm font-semibold", children: "Clear it" })
          ]
        }
      )
    ] })
  ] });
}
function ResultBadge({ guess, actual }) {
  const delta = Math.abs(guess - actual);
  const tone = delta === 0 ? "Spot on!" : delta <= 1 ? "So close" : delta <= 3 ? "Not bad" : "Way off";
  const color = delta === 0 ? "text-warm" : delta <= 1 ? "text-accent" : delta <= 3 ? "text-warm-foreground/80" : "text-destructive";
  const suffix = delta === 0 ? "" : ` (${delta} yr off)`;
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: cn("mt-2 text-sm font-semibold", color), children: [
    "You guessed ",
    guess,
    " · ",
    tone,
    suffix
  ] });
}
function Intro({
  onStart,
  accuracy,
  bestStreak
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col items-center px-6 pt-8 text-center", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-card", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Brain, { className: "h-7 w-7" }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "mt-4 font-display text-3xl font-bold", children: "Memory Lane" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-2 max-w-xs text-sm text-muted-foreground text-balance", children: "We'll surface 10 older photos. Guess the year each was taken, then decide if it's worth keeping." }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-8 grid w-full max-w-sm grid-cols-2 gap-3", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rounded-2xl border border-border bg-card p-4", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "font-display text-2xl font-bold tabular-nums", children: [
          accuracy,
          "%"
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-1 text-[11px] uppercase tracking-wider text-muted-foreground", children: "Accuracy" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rounded-2xl border border-border bg-card p-4", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "font-display text-2xl font-bold tabular-nums", children: [
          "🔥 ",
          bestStreak
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-1 text-[11px] uppercase tracking-wider text-muted-foreground", children: "Best streak" })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      "button",
      {
        onClick: onStart,
        className: "mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3 text-sm font-semibold text-primary-foreground shadow-card transition hover:opacity-90",
        children: "Start round"
      }
    )
  ] });
}
function DoneScreen({
  correct,
  total,
  freed,
  onAgain
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col items-center px-6 pt-10 text-center", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex h-16 w-16 items-center justify-center rounded-full bg-warm/30 text-warm-foreground", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Sparkles, { className: "h-7 w-7" }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "mt-4 font-display text-2xl font-bold", children: "Round complete" }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "mt-1 text-sm text-muted-foreground", children: [
      correct,
      " of ",
      total,
      " within 1 year · freed ",
      freed.toFixed(1),
      " MB"
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      "button",
      {
        onClick: onAgain,
        className: "mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3 text-sm font-semibold text-primary-foreground shadow-card hover:opacity-90",
        children: "Play again"
      }
    )
  ] });
}
function MemoryRoute() {
  return /* @__PURE__ */ jsxRuntimeExports.jsx(MemoryGame, {});
}
export {
  MemoryRoute as component
};
