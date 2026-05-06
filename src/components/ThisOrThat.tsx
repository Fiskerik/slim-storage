import { useEffect, useMemo, useState } from "react";
import { Scale, Sparkles, RefreshCw, Scissors } from "lucide-react";
import { getPhotoSourceAsync, type LibraryPhoto } from "@/lib/photo-source";
import { setStats, logDay } from "@/lib/storage";
import { cn } from "@/lib/utils";

type SamplePhoto = LibraryPhoto;

type BurstPair = {
  a: SamplePhoto;
  b: SamplePhoto;
  burstId: string;
  gapSec: number;
};

type CompletionStep = "playing" | "trim-offer" | "summary";

/** Build pairs only from photos that share a burst/multi-shot group. */
async function buildPairs(n: number): Promise<BurstPair[]> {
  const src = await getPhotoSourceAsync();
  const groups = await src.getBurstGroups(n);
  const out: BurstPair[] = [];
  const shuffledGroups = [...groups].sort(() => Math.random() - 0.5);
  for (const group of shuffledGroups) {
    const shuffled = [...group].sort(() => Math.random() - 0.5);
    for (let i = 0; i + 1 < shuffled.length && out.length < n; i += 2) {
      const a = shuffled[i];
      const b = shuffled[i + 1];
      out.push({
        a,
        b,
        burstId: a.burstId ?? a.id,
        gapSec: Math.max(1, Math.abs((a.burstOffset ?? 0) - (b.burstOffset ?? 0))),
      });
    }
    if (out.length >= n) break;
  }
  return out;
}

const ROUND = 6;
const TRIM_SAVINGS_RATE = 0.3;
const SELECTION_ANIMATION_MS = 320;

export function ThisOrThat() {
  const [round, setRound] = useState<BurstPair[]>([]);
  const [idx, setIdx] = useState(0);
  const [step, setStep] = useState<CompletionStep>("playing");
  const [deleteFreed, setDeleteFreed] = useState(0);
  const [trimFreed, setTrimFreed] = useState(0);
  const [keptPhotos, setKeptPhotos] = useState<SamplePhoto[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<0 | 1 | null>(null);

  useEffect(() => {
    buildPairs(ROUND).then(setRound);
  }, []);

  const pair = round[idx];
  const cards = useMemo<[SamplePhoto, SamplePhoto] | null>(
    () => (pair ? [pair.a, pair.b] : null),
    [pair],
  );
  const progress = useMemo(
    () => `${Math.min(idx + 1, round.length || ROUND)}/${round.length || ROUND}`,
    [idx, round.length],
  );
  const totalFreed = +(deleteFreed + trimFreed).toFixed(2);

  function pick(keepIdx: 0 | 1) {
    if (!cards || selectedIdx !== null) return;

    const kept = cards[keepIdx];
    const loser = cards[keepIdx === 0 ? 1 : 0];
    const nextDeleteFreed = +(deleteFreed + loser.sizeMB).toFixed(2);

    setSelectedIdx(keepIdx);
    setKeptPhotos((photos) => [...photos, kept]);
    setDeleteFreed(nextDeleteFreed);
    setStats((s) => ({
      ...s,
      cleaned: s.cleaned + 1,
      deleted: s.deleted + 1,
      mbFreed: s.mbFreed + loser.sizeMB,
      thisOrThatDeleted: s.thisOrThatDeleted + 1,
      thisOrThatMbFreed: s.thisOrThatMbFreed + loser.sizeMB,
    }));
    logDay({ kept: 1, deleted: 1, mbFreed: loser.sizeMB });

    window.setTimeout(() => {
      setSelectedIdx(null);
      if (idx + 1 >= round.length) {
        setStats((s) => ({ ...s, thisOrThatRounds: s.thisOrThatRounds + 1 }));
        setStep("trim-offer");
      } else {
        setIdx((current) => current + 1);
      }
    }, SELECTION_ANIMATION_MS);
  }

  function trimKeptPhotos() {
    const saved = +keptPhotos
      .reduce((sum, photo) => sum + photo.sizeMB * TRIM_SAVINGS_RATE, 0)
      .toFixed(2);
    setTrimFreed(saved);
    setStats((s) => ({
      ...s,
      slimmed: s.slimmed + keptPhotos.length,
      mbFreed: s.mbFreed + saved,
      thisOrThatMbFreed: s.thisOrThatMbFreed + saved,
    }));
    logDay({ trimmed: keptPhotos.length, mbFreed: saved });
    setStep("summary");
  }

  function skipTrim() {
    setStep("summary");
  }

  function reset() {
    buildPairs(ROUND).then(setRound);
    setIdx(0);
    setDeleteFreed(0);
    setTrimFreed(0);
    setKeptPhotos([]);
    setSelectedIdx(null);
    setStep("playing");
  }

  if (step === "trim-offer") {
    return (
      <div className="flex flex-col items-center px-6 pt-10 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Scissors className="h-7 w-7" />
        </div>
        <h2 className="mt-4 font-display text-2xl font-bold">Trim kept photos?</h2>
        <p className="mt-2 max-w-xs text-sm text-muted-foreground">
          You deleted the extras and freed {deleteFreed.toFixed(1)} MB. Trim the {keptPhotos.length}{" "}
          kept photo{keptPhotos.length === 1 ? "" : "s"} to save more space.
        </p>
        <div className="mt-8 flex w-full max-w-xs gap-3">
          <button
            onClick={skipTrim}
            className="inline-flex flex-1 items-center justify-center rounded-full border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground shadow-soft hover:border-primary/40"
          >
            Not now
          </button>
          <button
            onClick={trimKeptPhotos}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-card hover:opacity-90"
          >
            <Scissors className="h-4 w-4" /> Trim
          </button>
        </div>
      </div>
    );
  }

  if (step === "summary") {
    return (
      <div className="flex flex-col items-center px-6 pt-10 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Sparkles className="h-7 w-7" />
        </div>
        <h2 className="mt-4 font-display text-2xl font-bold">Round complete</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {round.length} duplicates resolved · saved {totalFreed.toFixed(1)} MB
        </p>
        <div className="mt-5 grid w-full max-w-xs grid-cols-2 gap-3">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Deleted</p>
            <p className="mt-1 font-display text-2xl font-bold tabular-nums">
              {deleteFreed.toFixed(1)} MB
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Trimmed</p>
            <p className="mt-1 font-display text-2xl font-bold tabular-nums">
              {trimFreed.toFixed(1)} MB
            </p>
          </div>
        </div>
        <button
          onClick={reset}
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-card hover:opacity-90"
        >
          <RefreshCw className="h-4 w-4" /> New round
        </button>
      </div>
    );
  }

  if (!cards || !pair) return null;

  return (
    <div className="flex flex-col items-center px-5 pt-4">
      <div className="flex w-full max-w-sm items-center justify-between text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5 uppercase tracking-[0.18em]">
          <Scale className="h-3.5 w-3.5" /> This or That · {progress}
        </span>
        <span className="tabular-nums">Freed {deleteFreed.toFixed(1)} MB</span>
      </div>

      <p className="mt-3 text-center text-sm font-medium text-foreground">Tap the one to keep</p>
      <p className="mt-1 text-center text-[11px] text-muted-foreground">
        Multi-shot · taken {pair.gapSec}s apart
      </p>

      <div className="mt-4 grid w-full max-w-sm grid-cols-2 gap-3">
        {[0, 1].map((i) => {
          const isUnselected = selectedIdx !== null && selectedIdx !== i;
          return (
            <motion.button
              key={cards[i].id}
              initial={false}
              animate={{ opacity: isUnselected ? 0 : 1 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              disabled={selectedIdx !== null}
              onClick={() => pick(i as 0 | 1)}
              className={cn(
                "group relative aspect-[3/4] overflow-hidden rounded-2xl border border-border bg-card shadow-card transition hover:border-primary/60 active:scale-[0.97]",
                selectedIdx === i && "border-primary ring-2 ring-primary/30",
              )}
            >
              <img
                src={cards[i].url}
                alt={cards[i].title}
                className="h-full w-full object-cover transition group-hover:scale-[1.03]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/65 to-transparent" />
              <div className="absolute bottom-2 left-2 right-2 text-left text-white">
                <p className="text-[10px] uppercase tracking-wider opacity-80">
                  {cards[i].sizeMB.toFixed(1)} MB
                </p>
                <p className="font-display text-sm font-bold leading-tight">{cards[i].title}</p>
              </div>
              <div className="absolute right-2 top-2 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
                {i === 0 ? "A" : "B"}
              </div>
            </motion.button>
          );
        })}
      </div>

      <p className={cn("mt-5 text-center text-[11px] text-muted-foreground")}>
        The one you don't pick gets removed and the space gets freed.
      </p>
    </div>
  );
}
