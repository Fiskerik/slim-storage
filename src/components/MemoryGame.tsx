import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Check, Trash2, Sparkles, ArrowRight } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { getPhotoSource, type LibraryPhoto } from "@/lib/photo-source";
import { setStats, logDay } from "@/lib/storage";
import { useStats } from "@/hooks/use-stats";
import { cn } from "@/lib/utils";

type SamplePhoto = LibraryPhoto;

// ROUND_SIZE comes from user settings (5–30)
const MIN_YEAR = 2010;
const MAX_YEAR = new Date().getFullYear();

type Phase = "intro" | "guess" | "reveal" | "done";

async function pickRound(n: number): Promise<SamplePhoto[]> {
  // Memory game prefers older photos (anything older than 4 years).
  const cutoff = new Date().getFullYear() - 4;
  const out = await getPhotoSource().getOlder(cutoff, n);
  if (out.length >= n) return out;
  // Fall back: top up with random photos if not enough older ones available.
  const extra = await getPhotoSource().getRandom(n - out.length);
  return [...out, ...extra];
}

export function MemoryGame() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [round, setRound] = useState<SamplePhoto[]>([]);
  const [idx, setIdx] = useState(0);
  const [guess, setGuess] = useState<number>(2018);
  const [results, setResults] = useState<{ delta: number; correct: boolean; kept: boolean }[]>([]);
  const stats = useStats();

  const photo = round[idx];

  function start() {
    const size = Math.min(30, Math.max(5, stats.settings.cardsPerRound));
    pickRound(size).then((photos) => {
      setRound(photos);
      setIdx(0);
      setGuess(2018);
      setResults([]);
      setPhase("guess");
    });
  }

  function submitGuess() {
    if (!photo) return;
    setPhase("reveal");
  }

  function decide(keep: boolean) {
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
        mbFreed: keep ? s.mbFreed : s.mbFreed + photo.sizeMB,
      };
    });

    logDay({
      memoryPlayed: 1,
      kept: keep ? 1 : 0,
      deleted: keep ? 0 : 1,
      mbFreed: keep ? 0 : photo.sizeMB,
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
    return <Intro onStart={start} accuracy={stats.memoryPlayed ? Math.round((stats.memoryCorrect / stats.memoryPlayed) * 100) : 0} bestStreak={stats.memoryBestStreak} />;
  }

  if (phase === "done") {
    const correct = results.filter((r) => r.correct).length;
    const freed = results.reduce((sum, r, i) => sum + (r.kept ? 0 : round[i].sizeMB), 0);
    return <DoneScreen correct={correct} total={round.length} freed={freed} onAgain={start} />;
  }

  if (!photo) return null;

  return (
    <div className="flex flex-col items-center px-5 pt-4">
      <div className="flex w-full max-w-sm items-center justify-between text-xs text-muted-foreground">
        <span className="uppercase tracking-[0.18em]">Memory · {idx + 1}/{round.length}</span>
        <span className="tabular-nums">Streak 🔥 {stats.memoryCurrentStreak}</span>
      </div>

      <div className="relative mt-4 h-[420px] w-full max-w-sm overflow-hidden rounded-3xl border border-border bg-card shadow-card">
        <AnimatePresence mode="wait">
          <motion.img
            key={photo.id}
            src={photo.url}
            alt="Memory photo"
            initial={{ opacity: 0, scale: 1.02 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="h-full w-full object-cover"
            style={{ filter: phase === "reveal" ? "none" : "saturate(0.85)" }}
          />
        </AnimatePresence>
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

        <AnimatePresence>
          {phase === "reveal" && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute bottom-5 left-5 right-5 rounded-2xl border border-white/15 bg-black/55 p-4 text-white backdrop-blur"
            >
              <p className="text-[11px] uppercase tracking-wider opacity-80">Actually taken</p>
              <p className="font-display text-3xl font-bold tabular-nums">
                {photo.month} {photo.year}
              </p>
              <ResultBadge guess={guess} actual={photo.year} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {phase === "guess" && (
        <div className="mt-6 w-full max-w-sm">
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-center text-xs uppercase tracking-wider text-muted-foreground">
              What year was this taken?
            </p>
            <p className="mt-2 text-center font-display text-5xl font-bold tabular-nums">{guess}</p>
            <Slider
              value={[guess]}
              min={MIN_YEAR}
              max={MAX_YEAR}
              step={1}
              onValueChange={(v) => setGuess(v[0])}
              className="mt-5"
            />
            <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
              <span>{MIN_YEAR}</span>
              <span>{MAX_YEAR}</span>
            </div>
          </div>
          <button
            onClick={submitGuess}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-card transition hover:opacity-90"
          >
            Reveal <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {phase === "reveal" && (
        <div className="mt-6 grid w-full max-w-sm grid-cols-2 gap-3">
          <button
            onClick={() => decide(true)}
            className="flex flex-col items-center gap-1 rounded-2xl border border-border bg-card py-4 transition hover:border-accent hover:bg-accent/15"
          >
            <Check className="h-5 w-5 text-accent-foreground" />
            <span className="text-sm font-semibold">Keep memory</span>
          </button>
          <button
            onClick={() => decide(false)}
            className="flex flex-col items-center gap-1 rounded-2xl border border-border bg-card py-4 text-destructive transition hover:border-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-5 w-5" />
            <span className="text-sm font-semibold">Clear it</span>
          </button>
        </div>
      )}
    </div>
  );
}

function ResultBadge({ guess, actual }: { guess: number; actual: number }) {
  const delta = Math.abs(guess - actual);
  const tone = delta === 0 ? "Spot on!" : delta <= 1 ? "So close" : delta <= 3 ? "Not bad" : "Way off";
  const color =
    delta === 0
      ? "text-warm"
      : delta <= 1
      ? "text-accent"
      : delta <= 3
      ? "text-warm-foreground/80"
      : "text-destructive";
  const suffix = delta === 0 ? "" : ` (${delta} yr off)`;
  return (
    <p className={cn("mt-2 text-sm font-semibold", color)}>
      You guessed {guess} · {tone}{suffix}
    </p>
  );
}

function Intro({
  onStart,
  accuracy,
  bestStreak,
}: {
  onStart: () => void;
  accuracy: number;
  bestStreak: number;
}) {
  return (
    <div className="flex flex-col items-center px-6 pt-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-card">
        <Brain className="h-7 w-7" />
      </div>
      <h2 className="mt-4 font-display text-3xl font-bold">Memory Lane</h2>
      <p className="mt-2 max-w-xs text-sm text-muted-foreground text-balance">
        We'll surface 10 older photos. Guess the year each was taken, then decide if it's worth keeping.
      </p>

      <div className="mt-8 grid w-full max-w-sm grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="font-display text-2xl font-bold tabular-nums">{accuracy}%</p>
          <p className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">Accuracy</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="font-display text-2xl font-bold tabular-nums">🔥 {bestStreak}</p>
          <p className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">Best streak</p>
        </div>
      </div>

      <button
        onClick={onStart}
        className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3 text-sm font-semibold text-primary-foreground shadow-card transition hover:opacity-90"
      >
        Start round
      </button>
    </div>
  );
}

function DoneScreen({
  correct,
  total,
  freed,
  onAgain,
}: {
  correct: number;
  total: number;
  freed: number;
  onAgain: () => void;
}) {
  return (
    <div className="flex flex-col items-center px-6 pt-10 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-warm/30 text-warm-foreground">
        <Sparkles className="h-7 w-7" />
      </div>
      <h2 className="mt-4 font-display text-2xl font-bold">Round complete</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {correct} of {total} within 1 year · freed {freed.toFixed(1)} MB
      </p>
      <button
        onClick={onAgain}
        className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3 text-sm font-semibold text-primary-foreground shadow-card hover:opacity-90"
      >
        Play again
      </button>
    </div>
  );
}

void useMemo;
