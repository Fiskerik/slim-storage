import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Check, Trash2, Sparkles } from "lucide-react";
import { getPhotoSource, type LibraryPhoto } from "@/lib/photo-source";
import { setStats, logDay } from "@/lib/storage";
import { useStats } from "@/hooks/use-stats";
import { cn } from "@/lib/utils";

type SamplePhoto = LibraryPhoto;

const MIN_YEAR = 2010;
const MAX_YEAR = new Date().getFullYear();
const AUTO_KEEP_SECONDS = 5;

type Phase = "intro" | "guess" | "reveal" | "done";

/** Generate 4 year options with randomized position for the correct answer */
function generateYearOptions(correctYear: number): number[] {
  const opts = new Set<number>();
  // Add some close alternatives first
  const offsets = [-2, -1, 1, 2, -3, 3];
  for (const offset of offsets) {
    if (opts.size >= 3) break;
    const y = correctYear + offset;
    if (y >= MIN_YEAR && y <= MAX_YEAR) opts.add(y);
  }
  let expand = 4;
  while (opts.size < 3 && expand < 10) {
    if (correctYear + expand <= MAX_YEAR) opts.add(correctYear + expand);
    if (correctYear - expand >= MIN_YEAR) opts.add(correctYear - expand);
    expand++;
  }
  // Convert to array, add correct year, then shuffle
  const alternatives = [...opts];
  // Insert correct year at a random position
  const insertIdx = Math.floor(Math.random() * (alternatives.length + 1));
  alternatives.splice(insertIdx, 0, correctYear);
  return alternatives.slice(0, 4);
}

async function pickRound(n: number): Promise<SamplePhoto[]> {
  const cutoff = new Date().getFullYear() - 4;
  const out = await getPhotoSource().getOlder(cutoff, n);
  if (out.length >= n) return out;
  const extra = await getPhotoSource().getRandom(n - out.length);
  return [...out, ...extra];
}

export function MemoryGame() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [round, setRound] = useState<SamplePhoto[]>([]);
  const [idx, setIdx] = useState(0);
  const [guess, setGuess] = useState<number | null>(null);
  const [yearOptions, setYearOptions] = useState<number[]>([]);
  const [results, setResults] = useState<{ delta: number; correct: boolean; kept: boolean }[]>([]);
  const [autoKeepTimer, setAutoKeepTimer] = useState<number>(AUTO_KEEP_SECONDS);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const stats = useStats();

  const photo = round[idx];

  function start() {
    const size = Math.min(30, Math.max(5, stats.settings.cardsPerRound));
    pickRound(size).then((photos) => {
      setRound(photos);
      setIdx(0);
      setGuess(null);
      setResults([]);
      if (photos.length > 0) {
        setYearOptions(generateYearOptions(photos[0].year));
      }
      setPhase("guess");
    });
  }

  const decide = useCallback((keep: boolean) => {
    if (!photo || guess === null) return;
    // Clear timer
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = undefined; }

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
      const nextIdx = idx + 1;
      setIdx(nextIdx);
      setGuess(null);
      if (round[nextIdx]) {
        setYearOptions(generateYearOptions(round[nextIdx].year));
      }
      setPhase("guess");
    }
  }, [photo, guess, results, idx, round]);

  // Auto-forward: when user selects a year in guess phase, auto-reveal after a brief moment
  function selectYear(yr: number) {
    setGuess(yr);
    // Auto-advance to reveal after a short delay
    setTimeout(() => {
      setPhase("reveal");
      // Start the auto-keep countdown
      setAutoKeepTimer(AUTO_KEEP_SECONDS);
    }, 600);
  }

  // Auto-keep timer during reveal phase
  useEffect(() => {
    if (phase !== "reveal") {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = undefined; }
      return;
    }
    setAutoKeepTimer(AUTO_KEEP_SECONDS);
    const start = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = (Date.now() - start) / 1000;
      const remaining = AUTO_KEEP_SECONDS - elapsed;
      if (remaining <= 0) {
        clearInterval(timerRef.current!);
        timerRef.current = undefined;
        decide(true); // Auto-keep
      } else {
        setAutoKeepTimer(remaining);
      }
    }, 50);
    return () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = undefined; } };
  }, [phase, idx, decide]);

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
    <div className="flex flex-col items-center px-5 pt-2">
      <div className="flex w-full max-w-sm items-center justify-between text-xs text-muted-foreground">
        <span className="uppercase tracking-[0.18em]">Memory · {idx + 1}/{round.length}</span>
        <span className="tabular-nums">Streak 🔥 {stats.memoryCurrentStreak}</span>
      </div>

      <div className="relative mt-2 h-[300px] w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-card shadow-card">
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
              <ResultBadge guess={guess!} actual={photo.year} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {phase === "guess" && (
        <div className="mt-3 w-full max-w-sm">
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-center text-xs uppercase tracking-wider text-muted-foreground">
              What year was this taken?
            </p>
            {guess !== null && (
              <p className="mt-1 text-center font-display text-4xl font-bold tabular-nums">{guess}</p>
            )}
            {guess === null && (
              <p className="mt-1 text-center font-display text-xl font-medium text-muted-foreground">Pick a year</p>
            )}
            <div className="mt-3 grid grid-cols-4 gap-2">
              {yearOptions.map((yr) => (
                <button
                  key={yr}
                  onClick={() => selectYear(yr)}
                  disabled={guess !== null}
                  className={cn(
                    "rounded-xl border-2 py-2.5 font-display text-base font-bold tabular-nums transition",
                    guess === yr
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border bg-background text-foreground hover:border-primary/40",
                    guess !== null && guess !== yr && "opacity-40"
                  )}
                >
                  {yr}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {phase === "reveal" && (
        <div className="mt-3 w-full max-w-sm">
          {/* Timer bar */}
          <div className="mb-3 h-1 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all duration-100 ease-linear rounded-full"
              style={{ width: `${(autoKeepTimer / AUTO_KEEP_SECONDS) * 100}%` }}
            />
          </div>
          <div className="grid w-full grid-cols-2 gap-3">
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
          <p className="mt-2 text-center text-[10px] text-muted-foreground">
            Auto-keeping in {Math.ceil(autoKeepTimer)}s…
          </p>
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
