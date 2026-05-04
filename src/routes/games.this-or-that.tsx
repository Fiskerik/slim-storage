import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Scale, Sparkles, RefreshCw, ArrowLeft } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { SAMPLE_PHOTOS, type SamplePhoto } from "@/lib/photos";
import { setStats, logDay } from "@/lib/storage";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/games/this-or-that")({
  component: ThisOrThat,
});

const ROUND = 6;

function buildPairs(photos: SamplePhoto[]): [SamplePhoto, SamplePhoto][] {
  const pool = [...photos].sort(() => Math.random() - 0.5);
  const out: [SamplePhoto, SamplePhoto][] = [];
  for (let i = 0; i + 1 < pool.length && out.length < ROUND; i += 2) {
    out.push([pool[i], pool[i + 1]]);
  }
  return out;
}

function ThisOrThat() {
  // Initialize directly in useState — avoids the blank-frame flash from useEffect
  const [round, setRound] = useState<[SamplePhoto, SamplePhoto][]>(() =>
    buildPairs(SAMPLE_PHOTOS),
  );
  const [idx, setIdx] = useState(0);
  const [freed, setFreed] = useState(0);
  const [done, setDone] = useState(false);
  const [chosen, setChosen] = useState<number | null>(null);

  const pair = round[idx];
  const progress = `${idx + 1} / ${round.length}`;

  function pick(keepIdx: 0 | 1) {
    if (!pair || chosen !== null) return;
    const loser = pair[keepIdx === 0 ? 1 : 0];

    // Briefly show which was picked before advancing
    setChosen(keepIdx);

    setTimeout(() => {
      setFreed((f) => parseFloat((f + loser.sizeMB).toFixed(2)));
      setStats((s) => ({
        ...s,
        cleaned: s.cleaned + 1,
        deleted: s.deleted + 1,
        mbFreed: s.mbFreed + loser.sizeMB,
        thisOrThatDeleted: s.thisOrThatDeleted + 1,
        thisOrThatMbFreed: s.thisOrThatMbFreed + loser.sizeMB,
      }));
      logDay({ kept: 1, deleted: 1, mbFreed: loser.sizeMB });
      toast.success(`Saved ${loser.sizeMB.toFixed(1)} MB`, { duration: 1500 });

      setChosen(null);
      if (idx + 1 >= round.length) {
        setStats((prev) => ({ ...prev, thisOrThatRounds: prev.thisOrThatRounds + 1 }));
        setDone(true);
      } else {
        setIdx((i) => i + 1);
      }
    }, 350);
  }

  function reset() {
    setRound(buildPairs(SAMPLE_PHOTOS));
    setIdx(0);
    setFreed(0);
    setDone(false);
    setChosen(null);
  }

  // ── Done ─────────────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="flex flex-col items-center px-6 pt-10 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Sparkles className="h-7 w-7" />
        </div>
        <h2 className="mt-4 font-display text-2xl font-bold">Round complete</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {round.length} duplicates resolved · freed {freed.toFixed(1)} MB
        </p>
        <div className="mt-8 flex gap-3">
          <Link
            to="/games"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-3 text-sm font-semibold text-foreground transition hover:border-primary/40"
          >
            All games
          </Link>
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-card hover:opacity-90"
          >
            <RefreshCw className="h-4 w-4" /> New round
          </button>
        </div>
      </div>
    );
  }

  if (!pair) return null;

  // ── Play ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center px-5 pt-4">
      {/* Header */}
      <div className="flex w-full max-w-sm items-center justify-between text-xs text-muted-foreground">
        <Link
          to="/games"
          className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span className="inline-flex items-center gap-1.5 uppercase tracking-[0.18em]">
            <Scale className="h-3.5 w-3.5" /> This or That
          </span>
        </Link>
        <span className="tabular-nums">{progress} · {freed.toFixed(1)} MB freed</span>
      </div>

      {/* Progress dots */}
      <div className="mt-3 flex gap-1.5">
        {round.map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-1.5 rounded-full transition-all",
              i < idx
                ? "w-4 bg-primary/50"
                : i === idx
                ? "w-4 bg-primary"
                : "w-1.5 bg-muted",
            )}
          />
        ))}
      </div>

      <p className="mt-4 text-center text-sm font-medium text-foreground">
        Tap the one to keep — the other gets deleted
      </p>

      {/* Photo pair */}
      <div className="mt-4 grid w-full max-w-sm grid-cols-2 gap-3">
        <AnimatePresence mode="wait">
          {[0, 1].map((i) => {
            const isChosen = chosen === i;
            const isLoser = chosen !== null && chosen !== i;
            return (
              <motion.button
                key={pair[i].id + "-" + idx + "-" + i}
                initial={{ opacity: 0, y: 16 }}
                animate={{
                  opacity: isLoser ? 0.3 : 1,
                  y: 0,
                  scale: isChosen ? 1.03 : 1,
                }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, delay: i * 0.05 }}
                onClick={() => pick(i as 0 | 1)}
                disabled={chosen !== null}
                className={cn(
                  "group relative aspect-[3/4] overflow-hidden rounded-2xl border-2 bg-card shadow-card transition-all active:scale-[0.97]",
                  isChosen
                    ? "border-primary"
                    : isLoser
                    ? "border-destructive/30"
                    : "border-border hover:border-primary/60",
                )}
              >
                <img
                  src={pair[i].url}
                  alt={pair[i].title}
                  className={cn(
                    "h-full w-full object-cover transition",
                    !isLoser && "group-hover:scale-[1.03]",
                  )}
                  loading="eager"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/65 to-transparent" />

                {/* Keep/delete overlay */}
                {isChosen && (
                  <div className="absolute inset-0 flex items-center justify-center bg-primary/20">
                    <div className="rounded-xl border-4 border-primary bg-primary/30 px-4 py-2 text-lg font-extrabold uppercase tracking-wider text-white backdrop-blur">
                      Keep
                    </div>
                  </div>
                )}
                {isLoser && (
                  <div className="absolute inset-0 flex items-center justify-center bg-destructive/20">
                    <div className="rounded-xl border-4 border-destructive bg-destructive/30 px-4 py-2 text-lg font-extrabold uppercase tracking-wider text-white backdrop-blur">
                      Gone
                    </div>
                  </div>
                )}

                <div className="absolute bottom-2 left-2 right-2 text-left text-white">
                  <p className="text-[10px] uppercase tracking-wider opacity-80">
                    {pair[i].sizeMB.toFixed(1)} MB
                  </p>
                  <p className="font-display text-sm font-bold leading-tight">{pair[i].title}</p>
                  <p className="text-[10px] opacity-70">{pair[i].month} {pair[i].year}</p>
                </div>

                <div className="absolute right-2 top-2 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
                  {i === 0 ? "A" : "B"}
                </div>
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>

      <p className={cn("mt-5 text-center text-[11px] text-muted-foreground")}>
        The one you don't pick gets removed and the space gets freed.
      </p>
    </div>
  );
}
