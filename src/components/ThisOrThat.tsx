import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Scale, Sparkles, RefreshCw } from "lucide-react";
import { SAMPLE_PHOTOS, type SamplePhoto } from "@/lib/photos";
import { setStats, logDay } from "@/lib/storage";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function pairs(photos: SamplePhoto[], n: number): [SamplePhoto, SamplePhoto][] {
  const out: [SamplePhoto, SamplePhoto][] = [];
  const pool = [...photos].sort(() => Math.random() - 0.5);
  for (let i = 0; i + 1 < pool.length && out.length < n; i += 2) {
    out.push([pool[i], pool[i + 1]]);
  }
  return out;
}

const ROUND = 6;

export function ThisOrThat() {
  const [round, setRound] = useState<[SamplePhoto, SamplePhoto][]>([]);
  const [idx, setIdx] = useState(0);
  const [done, setDone] = useState(false);
  const [freed, setFreed] = useState(0);

  useEffect(() => {
    setRound(pairs(SAMPLE_PHOTOS, ROUND));
  }, []);

  const pair = round[idx];
  const progress = useMemo(() => `${idx + 1}/${round.length || ROUND}`, [idx, round.length]);

  function pick(keepIdx: 0 | 1) {
    if (!pair) return;
    const loser = pair[keepIdx === 0 ? 1 : 0];
    setFreed((f) => +(f + loser.sizeMB).toFixed(2));
    setStats((s) => ({
      ...s,
      cleaned: s.cleaned + 1,
      deleted: s.deleted + 1,
      mbFreed: s.mbFreed + loser.sizeMB,
    }));
    logDay({ kept: 1, deleted: 1, mbFreed: loser.sizeMB });
    toast.success(`Kept the better one · saved ${loser.sizeMB.toFixed(1)} MB`);

    if (idx + 1 >= round.length) {
      setDone(true);
    } else {
      setIdx(idx + 1);
    }
  }

  function reset() {
    setRound(pairs(SAMPLE_PHOTOS, ROUND));
    setIdx(0);
    setFreed(0);
    setDone(false);
  }

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
        <button
          onClick={reset}
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-card hover:opacity-90"
        >
          <RefreshCw className="h-4 w-4" /> New round
        </button>
      </div>
    );
  }

  if (!pair) return null;

  return (
    <div className="flex flex-col items-center px-5 pt-4">
      <div className="flex w-full max-w-sm items-center justify-between text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5 uppercase tracking-[0.18em]">
          <Scale className="h-3.5 w-3.5" /> This or That · {progress}
        </span>
        <span className="tabular-nums">Freed {freed.toFixed(1)} MB</span>
      </div>

      <p className="mt-3 text-center text-sm font-medium text-foreground">
        Tap the one to keep
      </p>

      <div className="mt-4 grid w-full max-w-sm grid-cols-2 gap-3">
        <AnimatePresence mode="wait">
          {[0, 1].map((i) => (
            <motion.button
              key={pair[i].id + idx}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, delay: i * 0.05 }}
              onClick={() => pick(i as 0 | 1)}
              className="group relative aspect-[3/4] overflow-hidden rounded-2xl border border-border bg-card shadow-card transition hover:border-primary/60 active:scale-[0.97]"
            >
              <img
                src={pair[i].url}
                alt={pair[i].title}
                className="h-full w-full object-cover transition group-hover:scale-[1.03]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/65 to-transparent" />
              <div className="absolute bottom-2 left-2 right-2 text-left text-white">
                <p className="text-[10px] uppercase tracking-wider opacity-80">
                  {pair[i].sizeMB.toFixed(1)} MB
                </p>
                <p className="font-display text-sm font-bold leading-tight">{pair[i].title}</p>
              </div>
              <div className="absolute right-2 top-2 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
                {i === 0 ? "A" : "B"}
              </div>
            </motion.button>
          ))}
        </AnimatePresence>
      </div>

      <p className={cn("mt-5 text-center text-[11px] text-muted-foreground")}>
        The one you don't pick gets removed and the space gets freed.
      </p>
    </div>
  );
}
