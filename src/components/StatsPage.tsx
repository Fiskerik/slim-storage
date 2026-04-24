import { useStats } from "@/hooks/use-stats";
import { resetStats } from "@/lib/storage";
import { Trash2, Sparkles, Brain, Flame, HardDrive, Image as ImageIcon, Target, RotateCcw } from "lucide-react";

export function StatsPage() {
  const s = useStats();
  const totalReviewed = s.cleaned + s.deleted + s.slimmed;
  const accuracy = s.memoryPlayed ? Math.round((s.memoryCorrect / s.memoryPlayed) * 100) : 0;
  const avgDelta = s.memoryPlayed ? (s.memoryTotalDelta / s.memoryPlayed).toFixed(1) : "—";
  const freed = s.mbFreed;
  const freedDisplay = freed >= 1024 ? `${(freed / 1024).toFixed(2)} GB` : `${freed.toFixed(1)} MB`;

  return (
    <div className="px-5 pt-5">
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Your progress</p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">Statistics</h1>
      </header>

      <section className="mt-6 overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary to-warm p-5 text-primary-foreground shadow-card">
        <p className="text-xs uppercase tracking-wider opacity-80">Total storage freed</p>
        <p className="mt-1 font-display text-5xl font-bold tabular-nums">{freedDisplay}</p>
        <p className="mt-2 text-xs opacity-85">
          From {totalReviewed} photo{totalReviewed === 1 ? "" : "s"} reviewed · 🔥 {s.streak}-day streak
        </p>
      </section>

      <h2 className="mt-7 px-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Cleanup
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <StatCard icon={<ImageIcon className="h-4 w-4" />} label="Kept" value={s.cleaned} />
        <StatCard icon={<Sparkles className="h-4 w-4" />} label="Trimmed" value={s.slimmed} accent />
        <StatCard icon={<Trash2 className="h-4 w-4" />} label="Deleted" value={s.deleted} />
        <StatCard icon={<HardDrive className="h-4 w-4" />} label="MB Freed" value={freed.toFixed(0)} />
      </div>

      <h2 className="mt-7 px-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Memory game
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <StatCard icon={<Brain className="h-4 w-4" />} label="Played" value={s.memoryPlayed} />
        <StatCard icon={<Target className="h-4 w-4" />} label="Accuracy" value={`${accuracy}%`} accent />
        <StatCard icon={<Flame className="h-4 w-4" />} label="Best streak" value={s.memoryBestStreak} />
        <StatCard icon={<Sparkles className="h-4 w-4" />} label="Avg yrs off" value={avgDelta} />
      </div>

      <button
        onClick={() => {
          if (confirm("Reset all statistics?")) resetStats();
        }}
        className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card py-3 text-sm font-medium text-muted-foreground transition hover:text-destructive hover:border-destructive/40"
      >
        <RotateCcw className="h-4 w-4" /> Reset stats
      </button>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className={accent ? "text-primary" : ""}>{icon}</span>
        <span className="text-[11px] font-medium uppercase tracking-wider">{label}</span>
      </div>
      <p className={`mt-2 font-display text-2xl font-bold tabular-nums ${accent ? "text-primary" : ""}`}>
        {value}
      </p>
    </div>
  );
}
