import { Scissors } from "lucide-react";
import { useStats } from "@/hooks/use-stats";

export function TopBar() {
  const stats = useStats();
  const totalMb = Math.round(stats.mbFreed);
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-md items-center justify-between px-5 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-soft">
            <Scissors className="h-4 w-4" strokeWidth={2.4} />
          </div>
          <div className="leading-tight">
            <p className="font-display text-base font-bold tracking-tight">Slim</p>
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              On-device · Private
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-right">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Freed</p>
            <p className="text-sm font-semibold tabular-nums">
              {totalMb >= 1024 ? `${(totalMb / 1024).toFixed(1)} GB` : `${totalMb} MB`}
            </p>
          </div>
          <div className="h-8 w-px bg-border" />
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Streak</p>
            <p className="text-sm font-semibold tabular-nums">🔥 {stats.streak}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
