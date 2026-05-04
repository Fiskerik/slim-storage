import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { HardDrive, Sparkles, Check, X, RotateCcw, ArrowLeft } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { SAMPLE_PHOTOS, type SamplePhoto } from "@/lib/photos";
import { setStats, logDay } from "@/lib/storage";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/games/storage-budget")({
  component: StorageBudget,
});

const BUDGET_MB = 50;

// Unique pool entry so duplicate-seed photos never share an id in the kept-Set.
type PoolEntry = SamplePhoto & { poolKey: string };

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildPool(): PoolEntry[] {
  // SAMPLE_PHOTOS already has 12 unique entries — no duplication needed.
  return shuffle([...SAMPLE_PHOTOS]).map((p, i) => ({
    ...p,
    poolKey: `${p.id}-${i}`,
  }));
}

function newPool(): PoolEntry[] {
  return buildPool();
}

function StorageBudget() {
  const [pool, setPool] = useState<PoolEntry[]>(() => newPool());
  // kept tracks poolKey (unique per slot), not photo id
  const [kept, setKept] = useState<Set<string>>(new Set());
  const [done, setDone] = useState(false);

  const usedMB = useMemo(
    () =>
      parseFloat(
        pool
          .filter((p) => kept.has(p.poolKey))
          .reduce((sum, p) => sum + p.sizeMB, 0)
          .toFixed(2),
      ),
    [pool, kept],
  );

  const remainingMB = parseFloat((BUDGET_MB - usedMB).toFixed(2));
  const overBudget = remainingMB < 0;

  function toggle(p: PoolEntry) {
    if (done) return;
    setKept((prev) => {
      const next = new Set(prev);
      if (next.has(p.poolKey)) next.delete(p.poolKey);
      else next.add(p.poolKey);
      return next;
    });
  }

  function commit() {
    if (overBudget) return;
    const cleared = pool.filter((p) => !kept.has(p.poolKey));
    const freed = parseFloat(cleared.reduce((s, p) => s + p.sizeMB, 0).toFixed(2));
    setStats((s) => ({
      ...s,
      cleaned: s.cleaned + kept.size,
      deleted: s.deleted + cleared.length,
      mbFreed: s.mbFreed + freed,
      storageBudgetPlayed: s.storageBudgetPlayed + 1,
      storageBudgetTotalKept: s.storageBudgetTotalKept + kept.size,
      storageBudgetTotalCleared: s.storageBudgetTotalCleared + cleared.length,
      storageBudgetTotalMbFreed: s.storageBudgetTotalMbFreed + freed,
    }));
    logDay({ kept: kept.size, deleted: cleared.length, mbFreed: freed });
    setDone(true);
  }

  function restart() {
    setPool(newPool());
    setKept(new Set());
    setDone(false);
  }

  if (done) {
    const cleared = pool.length - kept.size;
    const freed = parseFloat(
      pool.filter((p) => !kept.has(p.poolKey)).reduce((s, p) => s + p.sizeMB, 0).toFixed(2),
    );
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
        <div className="mt-8 flex gap-3">
          <Link
            to="/games"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-3 text-sm font-semibold text-foreground transition hover:border-primary/40"
          >
            All games
          </Link>
          <button
            onClick={restart}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-card hover:opacity-90"
          >
            <RotateCcw className="h-4 w-4" /> New board
          </button>
        </div>
      </div>
    );
  }

  const pct = Math.min(100, (usedMB / BUDGET_MB) * 100);

  return (
    <div className="px-5 pt-4 pb-8">
      {/* Header */}
      <div className="flex w-full items-center justify-between text-xs text-muted-foreground">
        <Link to="/games" className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition">
          <ArrowLeft className="h-3.5 w-3.5" />
          <span className="inline-flex items-center gap-1 uppercase tracking-[0.18em]">
            <HardDrive className="h-3.5 w-3.5" /> Storage Budget
          </span>
        </Link>
        <span className="tabular-nums">
          {kept.size}/{pool.length} kept
        </span>
      </div>

      {/* Budget bar */}
      <div className="mt-3 rounded-2xl border border-border bg-card p-4">
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
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className={cn("h-full rounded-full", overBudget ? "bg-destructive" : "bg-primary")}
          />
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          {overBudget
            ? `${Math.abs(remainingMB).toFixed(1)} MB over — deselect something to fit`
            : `${remainingMB.toFixed(1)} MB remaining`}
        </p>
      </div>

      {/* Instruction */}
      <p className="mt-3 text-center text-xs text-muted-foreground">
        Tap photos to keep them. Everything unselected gets deleted. Stay under {BUDGET_MB} MB.
      </p>

      {/* Photo grid */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        {pool.map((p) => {
          const on = kept.has(p.poolKey);
          return (
            <button
              key={p.poolKey}
              onClick={() => toggle(p)}
              className={cn(
                "group relative aspect-square overflow-hidden rounded-xl border-2 transition-all active:scale-95",
                on
                  ? "border-primary opacity-100"
                  : "border-transparent opacity-50 grayscale",
              )}
            >
              <img
                src={p.thumb}
                alt={p.title}
                className="h-full w-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
              <div className="absolute bottom-1 left-1.5 right-1.5 flex items-center justify-between text-[9px] font-semibold text-white">
                <span className="tabular-nums">{p.sizeMB.toFixed(1)}MB</span>
                {on ? (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary">
                    <Check className="h-2.5 w-2.5 text-primary-foreground" />
                  </span>
                ) : (
                  <X className="h-3 w-3 opacity-60" />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* CTA */}
      <button
        onClick={commit}
        disabled={overBudget}
        className={cn(
          "mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-semibold shadow-card transition",
          overBudget
            ? "cursor-not-allowed bg-muted text-muted-foreground"
            : "bg-primary text-primary-foreground hover:opacity-90",
        )}
      >
        {overBudget ? "Over budget — deselect a photo" : `Lock in — free ${(pool.filter(p => !kept.has(p.poolKey)).reduce((s, p) => s + p.sizeMB, 0)).toFixed(1)} MB`}
      </button>
    </div>
  );
}
