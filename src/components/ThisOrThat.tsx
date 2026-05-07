import { useEffect, useMemo, useRef, useState } from "react";
import { Scale, Sparkles, RefreshCw } from "lucide-react";
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

type CompletionStep = "playing" | "summary";

function preloadPhotoImages(photos: SamplePhoto[]) {
  if (typeof window === "undefined") return;
  photos.forEach((photo) => {
    const image = new Image();
    image.src = photo.url;
  });
}

/** Build pairs only from photos that share a burst/multi-shot group. */
async function buildPairs(n: number): Promise<BurstPair[]> {
  const src = await getPhotoSourceAsync();
  let groups = await src.getBurstGroups(n);
  if (src.isNative && groups.length === 0) {
    const fallbackPhotos = await src.getRandom(n * 2);
    groups = [];
    for (let i = 0; i + 1 < fallbackPhotos.length; i += 2) {
      groups.push([fallbackPhotos[i], fallbackPhotos[i + 1]]);
    }
    console.log("[ThisOrThat] using native random-photo pairs because no burst groups were found", {
      pairCount: groups.length,
    });
  }

  const out: BurstPair[] = [];
  const prioritizedGroups = [...groups].sort(
    (a, b) =>
      Math.min(...a.map((p) => p.year)) - Math.min(...b.map((p) => p.year)) ||
      b.reduce((sum, p) => sum + p.sizeMB, 0) - a.reduce((sum, p) => sum + p.sizeMB, 0),
  );
  for (const group of prioritizedGroups) {
    const shuffled = [...group].sort((a, b) => b.sizeMB - a.sizeMB);
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
const SELECTION_ANIMATION_MS = 320;

export function ThisOrThat() {
  const [round, setRound] = useState<BurstPair[]>([]);
  const [idx, setIdx] = useState(0);
  const [step, setStep] = useState<CompletionStep>("playing");
  const [deleteFreed, setDeleteFreed] = useState(0);
  const [selectedIdx, setSelectedIdx] = useState<0 | 1 | null>(null);
  const preloadedRoundRef = useRef<Promise<BurstPair[]> | null>(null);
  const deletedLosersRef = useRef<SamplePhoto[]>([]);
  const [deleteBusy, setDeleteBusy] = useState(false);

  function preloadNextRound() {
    if (!preloadedRoundRef.current) {
      preloadedRoundRef.current = buildPairs(ROUND).then((pairs) => {
        console.log("[ThisOrThat] preloaded next round", { pairCount: pairs.length });
        preloadPhotoImages(pairs.flatMap((pair) => [pair.a, pair.b]).slice(0, 6));
        return pairs;
      });
    }
  }

  async function consumeRoundLoad() {
    const pending = preloadedRoundRef.current;
    preloadedRoundRef.current = null;
    return pending ? pending : buildPairs(ROUND);
  }

  useEffect(() => {
    buildPairs(ROUND).then((pairs) => {
      setRound(pairs);
      preloadPhotoImages(pairs.flatMap((pair) => [pair.a, pair.b]).slice(0, 6));
      preloadNextRound();
    });
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
  const totalFreed = +deleteFreed.toFixed(2);

  function pick(keepIdx: 0 | 1) {
    if (!cards || selectedIdx !== null) return;

    const loser = cards[keepIdx === 0 ? 1 : 0];
    const nextDeleteFreed = +(deleteFreed + loser.sizeMB).toFixed(2);

    setSelectedIdx(keepIdx);
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

    deletedLosersRef.current = [...deletedLosersRef.current, loser];

    if (idx + 2 >= round.length) preloadNextRound();

    window.setTimeout(() => {
      setSelectedIdx(null);
      if (idx + 1 >= round.length) {
        setStats((s) => ({ ...s, thisOrThatRounds: s.thisOrThatRounds + 1 }));
        setStep("summary");
      } else {
        setIdx((current) => current + 1);
      }
    }, SELECTION_ANIMATION_MS);
  }

  async function reset() {
    const pairs = await consumeRoundLoad();
    setRound(pairs);
    preloadPhotoImages(pairs.flatMap((pair) => [pair.a, pair.b]).slice(0, 6));
    preloadNextRound();
    setIdx(0);
    setDeleteFreed(0);
    deletedLosersRef.current = [];
    setDeleteBusy(false);
    setSelectedIdx(null);
    setStep("playing");
  }

  async function deleteRoundLosers() {
    if (deleteBusy) return;
    const nativeIds = deletedLosersRef.current
      .filter((photo) => photo.isNative && photo.nativeId)
      .map((photo) => photo.nativeId!);

    console.log("[ThisOrThat] confirming round deletion", {
      losers: deletedLosersRef.current.length,
      nativeIds: nativeIds.length,
      totalFreed,
    });

    if (nativeIds.length > 0) {
      try {
        setDeleteBusy(true);
        const result = await (await getPhotoSourceAsync()).deletePhotos(nativeIds);
        console.log("[ThisOrThat] native delete result", result);
      } catch (error) {
        console.warn("[ThisOrThat] native delete failed", error);
      } finally {
        setDeleteBusy(false);
      }
    }

    await reset();
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
        <div className="mt-5 w-full max-w-xs rounded-2xl border border-border bg-card p-4 shadow-soft">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Deleted</p>
          <p className="mt-1 font-display text-2xl font-bold tabular-nums">
            {deleteFreed.toFixed(1)} MB
          </p>
        </div>
        <div className="mt-8 flex w-full max-w-xs flex-col gap-2">
          <button
            onClick={deleteRoundLosers}
            disabled={deleteBusy}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-destructive px-6 py-3 text-sm font-semibold text-destructive-foreground shadow-card hover:opacity-90 disabled:opacity-60"
          >
            {deleteBusy
              ? "Deleting…"
              : `Delete ${round.length} photo${round.length === 1 ? "" : "s"} · ${totalFreed.toFixed(1)} MB`}
          </button>
          <button
            onClick={reset}
            disabled={deleteBusy}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground hover:border-primary/40 disabled:opacity-60"
          >
            <RefreshCw className="h-4 w-4" /> Keep all losers
          </button>
        </div>
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
            <button
              key={`${cards[i].id}:${i}`}
              disabled={selectedIdx !== null}
              onClick={() => pick(i as 0 | 1)}
              style={{
                opacity: isUnselected ? 0 : 1,
                transition: "opacity 0.3s ease-out",
              }}
              className={cn(
                "group relative aspect-[3/4] overflow-hidden rounded-2xl border border-border bg-card shadow-card active:scale-[0.97]",
                selectedIdx === i && "border-primary ring-2 ring-primary/30",
              )}
            >
              <img src={cards[i].url} alt={cards[i].title} className="h-full w-full object-cover" />
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
            </button>
          );
        })}
      </div>

      <p className={cn("mt-5 text-center text-[11px] text-muted-foreground")}>
        The one you don't pick gets removed and the space gets freed.
      </p>
    </div>
  );
}
