import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Timer, Trash2, Check, Sparkles, Play } from "lucide-react";
import { SAMPLE_PHOTOS, type SamplePhoto } from "@/lib/photos";
import { setStats, logDay } from "@/lib/storage";
import { cn } from "@/lib/utils";

const DURATION = 30;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type Phase = "intro" | "play" | "done";

export function SpeedRound() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [queue, setQueue] = useState<SamplePhoto[]>([]);
  const [time, setTime] = useState(DURATION);
  const [freed, setFreed] = useState(0);
  const [count, setCount] = useState(0);
  const tickRef = useRef<number | null>(null);

  useEffect(() => {
    if (phase !== "play") return;
    tickRef.current = window.setInterval(() => {
      setTime((t) => {
        if (t <= 1) {
          if (tickRef.current) window.clearInterval(tickRef.current);
          setPhase("done");
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
  }, [phase]);

  function start() {
    setQueue(shuffle([...SAMPLE_PHOTOS, ...SAMPLE_PHOTOS]));
    setTime(DURATION);
    setFreed(0);
    setCount(0);
    setPhase("play");
  }

  function decide(keep: boolean) {
    const top = queue[0];
    if (!top) return;
    setCount((c) => c + 1);
    if (!keep) {
      setFreed((f) => +(f + top.sizeMB).toFixed(2));
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
        <button
          onClick={start}
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3 text-sm font-semibold text-primary-foreground shadow-card hover:opacity-90"
        >
          <Play className="h-4 w-4" /> Start
        </button>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div className="flex flex-col items-center px-6 pt-10 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Sparkles className="h-7 w-7" />
        </div>
        <h2 className="mt-4 font-display text-2xl font-bold">Time's up</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {count} photos in {DURATION}s · freed {freed.toFixed(1)} MB
        </p>
        <button
          onClick={start}
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-card hover:opacity-90"
        >
          Play again
        </button>
      </div>
    );
  }

  const top = queue[0];
  const pct = (time / DURATION) * 100;

  return (
    <div className="flex flex-col items-center px-5 pt-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-between text-xs">
          <span className="inline-flex items-center gap-1.5 uppercase tracking-[0.18em] text-muted-foreground">
            <Timer className="h-3.5 w-3.5" /> Speed Round
          </span>
          <span className={cn("font-display text-lg font-bold tabular-nums", time <= 5 && "text-destructive")}>
            {time}s
          </span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              time <= 5 ? "bg-destructive" : "bg-primary",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
          <span>{count} reviewed</span>
          <span className="tabular-nums">{freed.toFixed(1)} MB freed</span>
        </div>
      </div>

      <div className="relative mt-4 h-[420px] w-full max-w-sm">
        <AnimatePresence mode="popLayout">
          {top && (
            <motion.div
              key={top.id + queue.length}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0 overflow-hidden rounded-3xl border border-border bg-card shadow-card"
            >
              <img src={top.url} alt={top.title} className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/65 to-transparent" />
              <div className="absolute bottom-5 left-5 right-5 text-white">
                <p className="text-xs opacity-80">{top.sizeMB.toFixed(1)} MB</p>
                <h3 className="font-display text-2xl font-bold">{top.title}</h3>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-5 grid w-full max-w-sm grid-cols-2 gap-3">
        <button
          onClick={() => decide(true)}
          className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card py-4 font-semibold text-foreground transition active:scale-95 hover:border-success/50"
        >
          <Check className="h-5 w-5 text-success" /> Keep
        </button>
        <button
          onClick={() => decide(false)}
          className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card py-4 font-semibold text-destructive transition active:scale-95 hover:border-destructive/50"
        >
          <Trash2 className="h-5 w-5" /> Trash
        </button>
      </div>
    </div>
  );
}
