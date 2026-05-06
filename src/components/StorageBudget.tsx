import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { HardDrive, Sparkles, Check, X, RotateCcw } from "lucide-react";
import { getPhotoSourceAsync, type LibraryPhoto } from "@/lib/photo-source";
import { setStats, logDay } from "@/lib/storage";
import { cn } from "@/lib/utils";

const BUDGET_MB = 50;

export function StorageBudget() {
  const [pool, setPool] = useState<LibraryPhoto[]>([]);
  const [kept, setKept] = useState<Set<string>>(new Set());
  const [done, setDone] = useState(false);

  async function loadPhotos() {
    const src = await getPhotoSourceAsync();
    const photos = await src.getRandom(12);
    setPool(photos);
    setKept(new Set());
    setDone(false);
  }

  useEffect(() => {
    loadPhotos();
  }, []);

  const usedMB = useMemo(
    () =>
      +pool
        .filter((p) => kept.has(p.id))
        .reduce((sum, p) => sum + p.sizeMB, 0)
        .toFixed(2),
    [pool, kept],
  );
  const remainingMB = +(BUDGET_MB - usedMB).toFixed(2);
  const overBudget = remainingMB < 0;

  function toggle(p: LibraryPhoto) {
    if (done) return;
    setKept((prev) => {
      const next = new Set(prev);
      if (next.has(p.id)) next.delete(p.id);
      else next.add(p.id);
      return next;
    });
  }

  function commit() {
    if (overBudget) return;
    const cleared = pool.filter((p) => !kept.has(p.id));
    const freed = +cleared.reduce((s, p) => s + p.sizeMB, 0).toFixed(2);
    setStats((s) => ({
      ...s,
      cleaned: s.cleaned + kept.size,
      deleted: s.deleted + cleared.length,
      mbFreed: s.mbFreed + freed,
    }));
    logDay({ kept: kept.size, deleted: cleared.length, mbFreed: freed });
    setDone(true);
  }

  function restart() {
    loadPhotos();
  }

  if (done) {
    const cleared = pool.length - kept.size;
    const freed = +pool
      .filter((p) => !kept.has(p.id))
      .reduce((s, p) => s + p.sizeMB, 0)
      .toFixed(2);
    return (
      <div className="flex flex-col items-center px-6 pt-10 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Sparkles className="h-7 w-7" />
        </div>
        <h2 className="mt-4 font-display text-2xl font-bold">Budget locked in</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Kept {kept.size} · cleared {cleared} · freed {freed.toFixed(1)} MB
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Used {usedMB.toFixed(1)} / {BUDGET_MB} MB
        </p>
        <button
          onClick={restart}
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-card hover:opacity-90"
        >
          <RotateCcw className="h-4 w-4" /> New board
        </button>
      </div>
    );
  }

  const pct = Math.min(100, (usedMB / BUDGET_MB) * 100);

  return (
    <div className="relative px-5 pt-4 pb-8">
      <div className="flex w-full items-center justify-between text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5 uppercase tracking-[0.18em]">
          <HardDrive className="h-3.5 w-3.5" /> Storage Budget
        </span>
        <span className="tabular-nums">
          {kept.size}/{pool.length} kept
        </span>
      </div>

      <div className="sticky top-0 z-20 mt-3 rounded-2xl border border-border bg-card p-4 shadow-card backdrop-blur-xl">
        <div className="flex items-baseline justify-between">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Budget</p>
          <p
            className={cn(
              "font-display text-2xl font-bold tabular-nums",
              overBudget && "text-destructive",
            )}
          >
            {usedMB.toFixed(1)}
            <span className="text-sm text-muted-foreground"> / {BUDGET_MB} MB</span>
          </p>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
          <motion.div
            animate={{ width: `${pct}%` }}
            className={cn("h-full rounded-full", overBudget ? "bg-destructive" : "bg-primary")}
          />
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          {overBudget
            ? `${Math.abs(remainingMB).toFixed(1)} MB over — drop something to fit`
            : `${remainingMB.toFixed(1)} MB remaining`}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {pool.map((p) => {
          const on = kept.has(p.id);
          return (
            <button
              key={p.id}
              onClick={() => toggle(p)}
              className={cn(
                "group relative aspect-square overflow-hidden rounded-xl border transition active:scale-95",
                on
                  ? "border-primary shadow-[0_0_0_2px_rgba(0,0,0,0.04)] ring-2 ring-primary/40"
                  : "border-border opacity-60 grayscale",
              )}
            >
              <img src={p.thumb} alt={p.title} className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
              <div className="absolute bottom-1 left-1 right-1 flex items-center justify-between text-[9px] font-semibold text-white">
                <span className="tabular-nums">{p.sizeMB.toFixed(1)}MB</span>
                {on ? (
                  <Check className="h-3 w-3 rounded-full bg-primary p-[1px] text-primary-foreground" />
                ) : (
                  <X className="h-3 w-3 opacity-70" />
                )}
              </div>
            </button>
          );
        })}
      </div>

      <button
        onClick={commit}
        disabled={overBudget}
        className={cn(
          "mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold shadow-card transition",
          overBudget
            ? "cursor-not-allowed bg-muted text-muted-foreground"
            : "bg-primary text-primary-foreground hover:opacity-90",
        )}
      >
        {overBudget ? "Over budget" : "Lock in selection"}
      </button>
    </div>
  );
}
