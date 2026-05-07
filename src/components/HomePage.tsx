import { Link } from "@tanstack/react-router";
import { useStats } from "@/hooks/use-stats";
import { calculateGoalCheckpoints, getTodayLog } from "@/lib/storage";
import { Scissors, Flame, HardDrive, Image } from "lucide-react";

export function HomePage() {
  const s = useStats();
  const totalReviewed = s.cleaned + s.deleted + s.slimmed;
  const freed = s.mbFreed;
  const freedDisplay = freed >= 1024 ? `${(freed / 1024).toFixed(1)} GB` : `${freed.toFixed(0)} MB`;
  const todayFreed = getTodayLog(s).mbFreed;
  const dailyGoal = Math.max(1, s.settings.dailyGoalMB);
  const dailyProgress = Math.min(100, (todayFreed / dailyGoal) * 100);
  const checkpoints = calculateGoalCheckpoints(dailyGoal);

  return (
    <div className="px-5 pt-6 pb-8">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Hey{s.settings.displayName !== "You" ? `, ${s.settings.displayName}` : ""} 👋
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Ready to slim your camera roll?</p>
      </header>

      {/* Quick stats */}
      <div className="mt-5 grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-border bg-card p-3 text-center">
          <HardDrive className="mx-auto h-4 w-4 text-primary" />
          <p className="mt-1 font-display text-lg font-bold tabular-nums">{freedDisplay}</p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Freed</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-3 text-center">
          <Image className="mx-auto h-4 w-4 text-accent-foreground" />
          <p className="mt-1 font-display text-lg font-bold tabular-nums">{totalReviewed}</p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Reviewed</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-3 text-center">
          <Flame className="mx-auto h-4 w-4 text-warm-foreground" />
          <p className="mt-1 font-display text-lg font-bold tabular-nums">{s.streak}</p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Streak</p>
        </div>
      </div>

      <section className="mt-5 rounded-2xl border border-border bg-card p-4 shadow-card/50">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Daily goal
            </p>
            <p className="mt-1 font-display text-2xl font-bold tabular-nums">
              {todayFreed.toFixed(1)} / {dailyGoal} MB
            </p>
          </div>
          <p className="text-right text-xs text-muted-foreground">Resets daily</p>
        </div>
        <div className="relative mt-4 h-3 rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-warm transition-[width] duration-500 ease-out"
            style={{ width: `${dailyProgress}%` }}
          />
          {[25, 50, 75].map((position) => (
            <span
              key={position}
              className="absolute top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-background shadow-[0_0_0_1px_hsl(var(--border))]"
              style={{ left: `${position}%` }}
              aria-hidden="true"
            />
          ))}
        </div>
        <div className="mt-2 grid grid-cols-3 text-[10px] font-medium text-muted-foreground">
          {checkpoints.map((checkpoint) => (
            <span key={checkpoint} className="text-center tabular-nums">
              {checkpoint} MB
            </span>
          ))}
        </div>
      </section>

      {/* Start cleaning CTA */}
      <Link
        to="/games"
        className="mt-6 block rounded-2xl bg-primary p-5 text-center text-primary-foreground shadow-card transition hover:opacity-90"
      >
        <Scissors className="mx-auto h-6 w-6" />
        <p className="mt-2 font-display text-lg font-bold">Start cleaning</p>
        <p className="mt-1 text-xs opacity-80">Pick a game and free up space</p>
      </Link>
    </div>
  );
}
