import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Timer, Trash2, Check, Sparkles, Play } from "lucide-react";
import { getPhotoSource, type LibraryPhoto } from "@/lib/photo-source";
import { setStats, logDay } from "@/lib/storage";
import { cn } from "@/lib/utils";

const DURATION = 30;

type Phase = "intro" | "play" | "review" | "done";

type Decision = { photo: LibraryPhoto; keep: boolean };

export function SpeedRound() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [queue, setQueue] = useState<LibraryPhoto[]>([]);
  const [time, setTime] = useState(DURATION);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const tickRef = useRef<number | null>(null);

  useEffect(() => {
    if (phase !== "play") return;
    tickRef.current = window.setInterval(() => {
      setTime((t) => {
        if (t <= 1) {
          if (tickRef.current) window.clearInterval(tickRef.current);
          setPhase("review");
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
  }, [phase]);

  async function start() {
    const src = getPhotoSource();
    const photos = await src.getRandom(40);
    setQueue(photos);
    setTime(DURATION);
    setDecisions([]);
    setPhase("play");
  }

  function decide(keep: boolean) {
    const top = queue[0];
    if (!top) return;
    setDecisions((d) => [...d, { photo: top, keep }]);
    if (!keep) {
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

  const [reviewSelection, setReviewSelection] = useState<Record<string, boolean>>({});

  const trashed = decisions.filter((d) => !d.keep);
  const selectedForDelete = trashed.filter((d) => reviewSelection[d.photo.id] !== false);
  const freedMB = selectedForDelete.reduce((s, d) => s + d.photo.sizeMB, 0);

  useEffect(() => {
    if (phase !== "review") return;
    const initial: Record<string, boolean> = {};
    for (const d of trashed) initial[d.photo.id] = true;
    setReviewSelection(initial);
  }, [phase]);

  async function confirmDelete() {
    const src = getPhotoSource();
    const ids = selectedForDelete.map((d) => d.photo.nativeId || d.photo.id);
    if (src.isNative && ids.length > 0) {
      await src.deletePhotos(ids);
    }
    setPhase("done");
  }

  function skipDelete() {
    setPhase("done");
  }

  if (phase === "intro") {
    return (
      <div className="flex flex-col items-center px-6 pt-10 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-warm/30 text-warm-foreground shadow-card">
          <Timer className="h-7 w-7" />
        </div>
        <h2 className="mt-4 font-display text-3xl font-bold">Speed Round</h2>
        <p className="mt-2 max-w-xs text-sm text-muted-foreground text-balance">
          30 seconds. Tap Keep or Trash as fast as you can.
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

  if (phase === "review") {
    return (
      <div className="flex flex-col items-center px-6 pt-10 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Sparkles className="h-7 w-7" />
        </div>
        <h2 className="mt-4 font-display text-2xl font-bold">Time's up!</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {decisions.length} photos reviewed · {trashed.length} marked during round
        </p>
        {trashed.length > 0 && (
          <p className="mt-1 text-sm text-muted-foreground">
            Review your trash picks below, then confirm deletion
          </p>
        )}

        {trashed.length > 0 && (
          <div className="mt-4 w-full max-w-sm rounded-2xl border border-border bg-card p-3 text-left">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Review before deleting</p>
            <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
              {trashed.map(({ photo }) => {
                const checked = reviewSelection[photo.id] !== false;
                return (
                  <label key={photo.id} className="flex items-center gap-3 rounded-xl border border-border/60 p-2">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => setReviewSelection((prev) => ({ ...prev, [photo.id]: !checked }))}
                      className="h-4 w-4"
                    />
                    <img src={photo.thumb || photo.url} alt={photo.title} className="h-12 w-12 rounded-lg object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{photo.title}</p>
                      <p className="text-xs text-muted-foreground">{photo.sizeMB.toFixed(1)} MB</p>
                    </div>
                  </label>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Selected to delete: {selectedForDelete.length} · {freedMB.toFixed(1)} MB</p>
          </div>
        )}

        {trashed.length > 0 ? (
          <div className="mt-4 flex w-full max-w-xs flex-col gap-3">
            <button
              onClick={confirmDelete}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-destructive px-6 py-3 text-sm font-semibold text-destructive-foreground shadow-card hover:opacity-90"
            >
              <Trash2 className="h-4 w-4" /> Delete {selectedForDelete.length} photos
            </button>
            <button
              onClick={skipDelete}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground hover:bg-muted"
            >
              Skip — keep all
            </button>
          </div>
        ) : (
          <button
            onClick={() => setPhase("done")}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-card hover:opacity-90"
          >
            Continue
          </button>
        )}
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div className="flex flex-col items-center px-6 pt-10 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Sparkles className="h-7 w-7" />
        </div>
        <h2 className="mt-4 font-display text-2xl font-bold">Round complete</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {decisions.length} photos in {DURATION}s
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
  const count = decisions.length;
  const freed = freedMB;

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
          <span className="tabular-nums">{freed.toFixed(1)} MB marked</span>
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
