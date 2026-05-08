import { useMemo, useState } from "react";
import { useStats } from "@/hooks/use-stats";
import { resetStats } from "@/lib/storage";
import type { DayLog } from "@/lib/storage";
import {
  Trash2,
  Sparkles,
  Brain,
  Flame,
  HardDrive,
  Image as ImageIcon,
  Target,
  RotateCcw,
  X,
  Scale,
  Timer,
  Trophy,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function StatsPage() {
  const s = useStats();
  const totalReviewed = s.cleaned + s.deleted + s.slimmed;
  const accuracy = s.memoryPlayed ? Math.round((s.memoryCorrect / s.memoryPlayed) * 100) : 0;
  const avgDelta = s.memoryPlayed ? (s.memoryTotalDelta / s.memoryPlayed).toFixed(1) : "—";
  const freed = s.mbFreed;
  const freedDisplay = freed >= 1024 ? `${(freed / 1024).toFixed(2)} GB` : `${freed.toFixed(1)} MB`;

  const [period, setPeriod] = useState<"week" | "month" | "year">("week");
  const history = useMemo(() => buildActivityBuckets(s.daily, period), [s.daily, period]);
  const [selected, setSelected] = useState<DayLog | null>(null);

  return (
    <div className="px-5 pt-5 pb-8">
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Your progress</p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">Statistics</h1>
      </header>

      <section className="mt-6 overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary to-warm p-5 text-primary-foreground shadow-card">
        <p className="text-xs uppercase tracking-wider opacity-80">Total storage freed</p>
        <p className="mt-1 font-display text-5xl font-bold tabular-nums">{freedDisplay}</p>
        <p className="mt-2 text-xs opacity-85">
          From {totalReviewed} photo{totalReviewed === 1 ? "" : "s"} reviewed · 🔥 {s.streak}-day
          streak
        </p>
      </section>

      <div className="mt-7 flex items-center justify-between gap-3 px-1">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Activity
          </h2>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Tap a day to see cleanup and game stats.
          </p>
        </div>
        <div className="grid grid-cols-3 rounded-full border border-border bg-card p-1 text-[10px] font-semibold uppercase tracking-wider">
          {(["week", "month", "year"] as const).map((item) => (
            <button
              key={item}
              onClick={() => setPeriod(item)}
              className={cn(
                "rounded-full px-2.5 py-1 transition",
                period === item
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
      {history.length > 0 ? (
        <div className="mt-3 flex items-end justify-between gap-1.5">
          {history.map((d) => {
            const max = Math.max(1, ...history.map((x) => x.mbFreed));
            const heightPct = Math.max(8, Math.round((d.mbFreed / max) * 100));
            const hasActivity = hasDayActivity(d);
            const memoryCleared = d.memoryPlayed > 0;
            return (
              <button
                key={d.bucketKey}
                onClick={() => setSelected(d)}
                className="group flex min-w-0 flex-1 flex-col items-center gap-1.5"
                aria-label={`${d.ariaLabel} details`}
              >
                <div className="relative flex h-[88px] w-full items-end justify-center">
                  <div
                    className={cn(
                      "w-full rounded-2xl border transition group-hover:scale-[1.03]",
                      memoryCleared
                        ? "border-success/60 bg-success/80"
                        : hasActivity
                          ? "border-border bg-muted"
                          : "border-dashed border-border bg-transparent",
                    )}
                    style={{ height: hasActivity ? `${heightPct}%` : "30%" }}
                  />
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {d.label}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="mt-3 rounded-2xl border border-dashed border-border bg-card/60 px-4 py-8 text-center text-xs text-muted-foreground">
          No activity data yet.
        </div>
      )}

      <h2 className="mt-7 px-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Cleanup
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <StatCard icon={<ImageIcon className="h-4 w-4" />} label="Kept" value={s.cleaned} />
        <StatCard
          icon={<Sparkles className="h-4 w-4" />}
          label="Trimmed"
          value={s.slimmed}
          accent
        />
        <StatCard icon={<Trash2 className="h-4 w-4" />} label="Deleted" value={s.deleted} />
        <StatCard
          icon={<HardDrive className="h-4 w-4" />}
          label="MB Freed"
          value={freed.toFixed(0)}
        />
      </div>

      <div className="mt-5 rounded-3xl border border-primary/20 bg-primary/[0.04] p-4">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          Memory Lane
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <StatCard
            icon={<Brain className="h-4 w-4" />}
            label="Played"
            value={s.memoryPlayed}
            tint="text-primary"
          />
          <StatCard
            icon={<Target className="h-4 w-4" />}
            label="Accuracy"
            value={`${accuracy}%`}
            accent
            tint="text-primary"
          />
          <StatCard
            icon={<Flame className="h-4 w-4" />}
            label="Best streak"
            value={s.memoryBestStreak}
            tint="text-primary"
          />
          <StatCard
            icon={<Sparkles className="h-4 w-4" />}
            label="Avg yrs off"
            value={avgDelta}
            tint="text-primary"
          />
        </div>
      </div>

      <div className="mt-5 rounded-3xl border border-accent/20 bg-accent/[0.04] p-4">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-[0.18em] text-accent-foreground">
          This or That
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <StatCard
            icon={<Scale className="h-4 w-4" />}
            label="Rounds"
            value={s.thisOrThatRounds}
            tint="text-accent-foreground"
          />
          <StatCard
            icon={<Trash2 className="h-4 w-4" />}
            label="Deleted"
            value={s.thisOrThatDeleted}
            tint="text-accent-foreground"
          />
          <StatCard
            icon={<HardDrive className="h-4 w-4" />}
            label="MB Freed"
            value={s.thisOrThatMbFreed.toFixed(0)}
            accent
            tint="text-accent-foreground"
          />
        </div>
      </div>

      <div className="mt-5 rounded-3xl border border-warm/20 bg-warm/[0.04] p-4">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-[0.18em] text-warm-foreground">
          Speed Round
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <StatCard
            icon={<Timer className="h-4 w-4" />}
            label="Played"
            value={s.speedRoundPlayed}
            tint="text-warm-foreground"
          />
          <StatCard
            icon={<Trophy className="h-4 w-4" />}
            label="Best count"
            value={s.speedRoundBestCount}
            accent
            tint="text-warm-foreground"
          />
          <StatCard
            icon={<ImageIcon className="h-4 w-4" />}
            label="Total reviewed"
            value={s.speedRoundTotalReviewed}
            tint="text-warm-foreground"
          />
          <StatCard
            icon={<HardDrive className="h-4 w-4" />}
            label="MB Freed"
            value={s.speedRoundTotalMbFreed.toFixed(0)}
            tint="text-warm-foreground"
          />
        </div>
      </div>

      <div className="mt-5 rounded-3xl border border-success/20 bg-success/[0.04] p-4">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-[0.18em] text-success-foreground">
          Storage Budget
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <StatCard
            icon={<HardDrive className="h-4 w-4" />}
            label="Played"
            value={s.storageBudgetPlayed}
            tint="text-success-foreground"
          />
          <StatCard
            icon={<ImageIcon className="h-4 w-4" />}
            label="Total kept"
            value={s.storageBudgetTotalKept}
            tint="text-success-foreground"
          />
          <StatCard
            icon={<Trash2 className="h-4 w-4" />}
            label="Total cleared"
            value={s.storageBudgetTotalCleared}
            tint="text-success-foreground"
          />
          <StatCard
            icon={<Sparkles className="h-4 w-4" />}
            label="MB Freed"
            value={s.storageBudgetTotalMbFreed.toFixed(0)}
            accent
            tint="text-success-foreground"
          />
        </div>
      </div>

      <button
        onClick={() => {
          if (confirm("Reset all statistics?")) resetStats();
        }}
        className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card py-3 text-sm font-medium text-muted-foreground transition hover:text-destructive hover:border-destructive/40"
      >
        <RotateCcw className="h-4 w-4" /> Reset stats
      </button>

      {selected && <DayDetailModal day={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function emptyDay(date: string): DayLog {
  return {
    date,
    kept: 0,
    trimmed: 0,
    deleted: 0,
    mbFreed: 0,
    trimmedMbFreed: 0,
    deletedMbFreed: 0,
    memoryPlayed: 0,
    thisOrThatRounds: 0,
    speedRoundPlayed: 0,
    speedRoundReviewed: 0,
    storageBudgetPlayed: 0,
  };
}

type ActivityBucket = DayLog & {
  bucketKey: string;
  label: string;
  ariaLabel: string;
};

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function hasDayActivity(day: DayLog): boolean {
  return (
    day.kept +
      day.trimmed +
      day.deleted +
      day.memoryPlayed +
      day.thisOrThatRounds +
      day.speedRoundPlayed +
      day.storageBudgetPlayed >
    0
  );
}

function buildActivityBuckets(
  daily: DayLog[],
  period: "week" | "month" | "year",
): ActivityBucket[] {
  if (period === "week") {
    const map = new Map(daily.map((d) => [d.date, { ...emptyDay(d.date), ...d }]));
    return Array.from({ length: 7 }, (_, index) => {
      const daysAgo = 6 - index;
      const date = new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10);
      const day = map.get(date) ?? emptyDay(date);
      const label = new Date(date + "T00:00:00").toLocaleDateString("en-US", {
        weekday: "short",
      })[0];
      return { ...day, bucketKey: date, label, ariaLabel: date };
    });
  }

  const activeDays = daily.filter(hasDayActivity).sort((a, b) => a.date.localeCompare(b.date));
  const grouped = new Map<string, ActivityBucket>();

  activeDays.forEach((day) => {
    const date = new Date(day.date + "T00:00:00");
    const key = period === "month" ? day.date.slice(0, 7) : day.date.slice(0, 4);
    const label = period === "month" ? (MONTH_LABELS[date.getMonth()] ?? key) : key;
    const ariaLabel = period === "month" ? `${label} ${date.getFullYear()}` : key;
    const existing = grouped.get(key);
    const base = existing ?? {
      ...emptyDay(period === "month" ? `${key}-01` : `${key}-01-01`),
      bucketKey: key,
      label,
      ariaLabel,
    };
    grouped.set(key, { ...sumDays(base, day), bucketKey: key, label, ariaLabel });
  });

  return Array.from(grouped.values());
}

function sumDays(total: DayLog, day: DayLog): DayLog {
  return {
    ...total,
    kept: total.kept + day.kept,
    trimmed: total.trimmed + day.trimmed,
    deleted: total.deleted + day.deleted,
    mbFreed: +(total.mbFreed + day.mbFreed).toFixed(2),
    trimmedMbFreed: +(total.trimmedMbFreed + day.trimmedMbFreed).toFixed(2),
    deletedMbFreed: +(total.deletedMbFreed + day.deletedMbFreed).toFixed(2),
    memoryPlayed: total.memoryPlayed + day.memoryPlayed,
    thisOrThatRounds: total.thisOrThatRounds + day.thisOrThatRounds,
    speedRoundPlayed: total.speedRoundPlayed + day.speedRoundPlayed,
    speedRoundReviewed: total.speedRoundReviewed + day.speedRoundReviewed,
    storageBudgetPlayed: total.storageBudgetPlayed + day.storageBudgetPlayed,
  };
}

function DayDetailModal({ day, onClose }: { day: DayLog; onClose: () => void }) {
  const dateLabel = new Date(day.date + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  const total = day.kept + day.trimmed + day.deleted;
  const playedGames =
    day.memoryPlayed + day.thisOrThatRounds + day.speedRoundPlayed + day.storageBudgetPlayed;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 px-5 pb-5 pt-[calc(var(--safe-area-top,env(safe-area-inset-top))+1rem)] backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Day detail</p>
            <h3 className="mt-1 font-display text-2xl font-bold">{dateLabel}</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {total === 0 && playedGames === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No activity on this day.</p>
        ) : (
          <>
            <div className="mt-5 rounded-2xl border border-border bg-background/50 p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Storage freed
              </p>
              <p className="mt-1 font-display text-3xl font-bold tabular-nums">
                {day.mbFreed.toFixed(1)} <span className="text-base text-muted-foreground">MB</span>
              </p>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              <MiniStat label="Kept" value={day.kept} />
              <MiniStat
                label="Trimmed"
                value={day.trimmed}
                detail={`${day.trimmedMbFreed.toFixed(1)} MB`}
                accent
              />
              <MiniStat
                label="Deleted"
                value={day.deleted}
                detail={`${day.deletedMbFreed.toFixed(1)} MB`}
              />
            </div>

            <div className="mt-3 space-y-2">
              <GameLine
                icon={<Brain className="h-4 w-4" />}
                label="Memory Lane"
                value={
                  day.memoryPlayed > 0
                    ? `${day.memoryPlayed} photo${day.memoryPlayed === 1 ? "" : "s"}`
                    : "Not played"
                }
                active={day.memoryPlayed > 0}
              />
              <GameLine
                icon={<Scale className="h-4 w-4" />}
                label="This or That"
                value={
                  day.thisOrThatRounds > 0
                    ? `${day.thisOrThatRounds} pick${day.thisOrThatRounds === 1 ? "" : "s"} · ${day.deletedMbFreed.toFixed(1)} MB saved`
                    : "Not played"
                }
                active={day.thisOrThatRounds > 0}
              />
              <GameLine
                icon={<Timer className="h-4 w-4" />}
                label="Speed Round"
                value={
                  day.speedRoundReviewed > 0
                    ? `${day.speedRoundReviewed} reviewed · ${day.deletedMbFreed.toFixed(1)} MB saved`
                    : "Not played"
                }
                active={day.speedRoundReviewed > 0}
              />
              <GameLine
                icon={<HardDrive className="h-4 w-4" />}
                label="Storage Budget"
                value={
                  day.storageBudgetPlayed > 0
                    ? `${day.storageBudgetPlayed} board · ${day.deletedMbFreed.toFixed(1)} MB saved`
                    : "Not played"
                }
                active={day.storageBudgetPlayed > 0}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  detail,
  accent,
}: {
  label: string;
  value: number;
  detail?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-background/50 p-3 text-center">
      <p className={cn("font-display text-xl font-bold tabular-nums", accent && "text-primary")}>
        {value}
      </p>
      <p className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      {detail && (
        <p className="mt-1 text-[10px] font-semibold text-muted-foreground">{detail} saved</p>
      )}
    </div>
  );
}

function GameLine({
  icon,
  label,
  value,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  active: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-2xl border p-3 text-sm",
        active
          ? "border-success/40 bg-success/10 text-success-foreground"
          : "border-border bg-muted/40 text-muted-foreground",
      )}
    >
      <div className="flex items-center gap-2">
        {icon}
        <span className="font-medium">{label}</span>
      </div>
      <span className="text-right text-xs">{value}</span>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent,
  tint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  accent?: boolean;
  tint?: string;
}) {
  const iconColor = tint || (accent ? "text-primary" : "");
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className={iconColor}>{icon}</span>
        <span className="text-[11px] font-medium uppercase tracking-wider">{label}</span>
      </div>
      <p
        className={`mt-2 font-display text-2xl font-bold tabular-nums ${accent ? tint || "text-primary" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}
