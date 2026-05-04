import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Timer, Trash2, Check, Sparkles, Play, ArrowLeft } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { SAMPLE_PHOTOS, type SamplePhoto } from "@/lib/photos";
import { setStats, logDay } from "@/lib/storage";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/games/speed-round")({
  component: SpeedRound,
});

const DURATION = 30;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Build an infinite-feeling queue by repeating + shuffling the pool
function buildQueue(): SamplePhoto[] {
  return shuffle([...SAMPLE_PHOTOS, ...SAMPLE_PHOTOS, ...SAMPLE_PHOTOS]);
}

type Phase = "intro" | "play" | "done";

function SpeedRound() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [queue, setQueue] = useState<SamplePhoto[]>([]);
  const [time, setTime] = useState(DURATION);
  const [freed, setFreed] = useState(0);
  const [count, setCount] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countRef = useRef(0);
  const freedRef = useRef(0);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  useEffect(() => {
    if (phase !== "play") return;

    tickRef.current = setInterval(() => {
      setTime((t) => {
        if (t <= 1) {
          if (tickRef.current) clearInterval(tickRef.current);
          setPhase("done");
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [phase]);

  function start() {
    if (tickRef.current) clearInterval(tickRef.current);
    setQueue(buildQueue());
    setTime(DURATION);
    setFreed(0);
    setCount(0);
    setPhase("play");
  }

  function decide(keep: boolean) {
    // Guard: ignore taps after time runs out
    if (phase !== "play") return;

    const top = queue[0];
    if (!top) return;

    setCount((c) => c + 1);

    if (!keep) {
      setFreed((f) => parseFloat((f + top.sizeMB).toFixed(2)));
      setStats((s) => ({
        ...s,
        deleted: s.deleted + 1,
        mbFreed: s.mbFreed + top.sizeMB,
      }));
      logDay({ deleted: 1, mbFreed: top.sizeMB });
    } else {
      setStats((s) => ({ ...s, cleaned: s.cleaned + 1 }));
      logDay({ kept: 1 });
    }

    setQueue((q) => q.slice(1));
  }

  // ── Intro ────────────────────────────────────────────────────────────────
  if (phase === "intro") {
    return (
      <div className="flex flex-col items-center px-6 pt-10 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-warm/30 text-warm-foreground shadow-card">
          <Timer className="h-7 w-7" />
        </div>
        <h2 className="mt-4 font-display text-3xl font-bold">Speed Round</h2>
        <p className="mt-2 max-w-xs text-sm text-muted-foreground text-balance">
          30 seconds. Tap Keep or Trash as fast as you can. Score = MB freed.
        </p>
        <div className="mt-8 flex gap-3">
          <Link
            to="/games"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-3 text-sm font-semibold text-foreground transition hover:border-primary/40"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <button
            onClick={start}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3 text-sm font-semibold text-primary-foreground shadow-card hover:opacity-90"
          >
            <Play className="h-4 w-4" /> Start
          </button>
        </div>
      </div>
    );
  }

  // ── Done ─────────────────────────────────────────────────────────────────
  if (phase === "done") {
    return (
      <div className="flex flex-col items-center px-6 pt-10 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Sparkles className="h-7 w-7" />
        </div>
        <h2 className="mt-4 font-display text-2xl font-bold">Time's up!</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {count} photos in {DURATION}s · freed {freed.toFixed(1)} MB
        </p>
        <div className="mt-8 grid w-full max-w-sm grid-cols-3 gap-3">
          <ScoreStat label="Reviewed" value={count} />
          <ScoreStat label="MB freed" value={freed.toFixed(1)} accent />
          <ScoreStat label="Per sec" value={(count / DURATION).toFixed(1)} />
        </div>
        <div className="mt-8 flex gap-3">
          <Link
            to="/games"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-3 text-sm font-semibold text-foreground transition hover:border-primary/40"
          >
            All games
          </Link>
          <button
            onClick={start}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-card hover:opacity-90"
          >
            <Play className="h-4 w-4" /> Play again
          </button>
        </div>
      </div>
    );
  }

  // ── Play ─────────────────────────────────────────────────────────────────
  const top = queue[0];
  const pct = (time / DURATION) * 100;

  return (
    <div className="flex flex-col items-center px-5 pt-4">
      {/* Timer bar */}
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-between text-xs">
          <span className="inline-flex items-center gap-1.5 uppercase tracking-[0.18em] text-muted-foreground">
            <Timer className="h-3.5 w-3.5" /> Speed Round
          </span>
          <span
            className={cn(
              "font-display text-lg font-bold tabular-nums",
              time <= 5 && "text-destructive",
            )}
          >
            {time}s
          </span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <motion.div
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.9, ease: "linear" }}
            className={cn("h-full rounded-full", time <= 5 ? "bg-destructive" : "bg-primary")}
          />
        </div>
        <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
          <span>{count} reviewed</span>
          <span className="tabular-nums">{freed.toFixed(1)} MB freed</span>
        </div>
      </div>

      {/* Photo card */}
      <div className="relative mt-4 h-[400px] w-full max-w-sm">
        <AnimatePresence mode="popLayout">
          {top && (
            <motion.div
              key={top.id + "-" + queue.length}
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: -8 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0 overflow-hidden rounded-3xl border border-border bg-card shadow-card"
            >
              <img
                src={top.url}
                alt={top.title}
                className="h-full w-full object-cover"
                loading="eager"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
              <div className="absolute bottom-5 left-5 right-5 text-white">
                <p className="text-xs opacity-70">{top.sizeMB.toFixed(1)} MB</p>
                <h3 className="font-display text-2xl font-bold">{top.title}</h3>
                <p className="mt-0.5 text-xs opacity-70">{top.month} {top.year}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Buttons */}
      <div className="mt-5 grid w-full max-w-sm grid-cols-2 gap-3">
        <button
          onClick={() => decide(true)}
          className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card py-5 text-base font-semibold text-foreground transition active:scale-95 hover:border-success/50 hover:bg-success/5"
        >
          <Check className="h-5 w-5 text-success" /> Keep
        </button>
        <button
          onClick={() => decide(false)}
          className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card py-5 text-base font-semibold text-destructive transition active:scale-95 hover:border-destructive/50 hover:bg-destructive/5"
        >
          <Trash2 className="h-5 w-5" /> Trash
        </button>
      </div>
    </div>
  );
}

function ScoreStat({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 text-center">
      <p className={cn("font-display text-2xl font-bold tabular-nums", accent && "text-primary")}>
        {value}
      </p>
      <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}
