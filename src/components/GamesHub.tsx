import { useState, useRef, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { Layers, Brain, Scale, Timer, HardDrive } from "lucide-react";
import { cn } from "@/lib/utils";

type Game = {
  to: string;
  title: string;
  tagline: string;
  icon: React.ReactNode;
  iconBg: string;
  iconFg: string;
};

export function GamesHub() {
  const [tooltip, setTooltip] = useState<{ title: string; tagline: string; x: number; y: number } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const miniGames: Game[] = [
    {
      to: "/memory",
      title: "Memory Lane",
      tagline: "Guess the year of forgotten photos, then keep or clear.",
      icon: <Brain className="h-6 w-6" />,
      iconBg: "bg-primary/15",
      iconFg: "text-primary",
    },
    {
      to: "/games/this-or-that",
      title: "This or That",
      tagline: "Two near-duplicates side by side. Pick the keeper, lose the rest.",
      icon: <Scale className="h-6 w-6" />,
      iconBg: "bg-accent/20",
      iconFg: "text-accent-foreground",
    },
    {
      to: "/games/speed-round",
      title: "Speed Round",
      tagline: "30 seconds, swipe as many photos as you can. Score = MB freed.",
      icon: <Timer className="h-6 w-6" />,
      iconBg: "bg-warm/25",
      iconFg: "text-warm-foreground",
    },
    {
      to: "/games/storage-budget",
      title: "Storage Budget",
      tagline: "50 MB budget. Keep only what fits. Real trade-offs, real space.",
      icon: <HardDrive className="h-6 w-6" />,
      iconBg: "bg-secondary",
      iconFg: "text-secondary-foreground",
    },
  ];

  function handleLongPress(e: React.TouchEvent | React.MouseEvent, game: Game) {
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setTooltip({ title: game.title, tagline: game.tagline, x: rect.left + rect.width / 2, y: rect.top - 8 });
  }

  function startPress(game: Game) {
    timerRef.current = setTimeout(() => {
      // Use center of viewport as fallback
      setTooltip({ title: game.title, tagline: game.tagline, x: window.innerWidth / 2, y: 200 });
    }, 500);
  }

  function endPress() {
    if (timerRef.current) clearTimeout(timerRef.current);
  }

  return (
    <div className="px-5 pt-5 pb-8">
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Game hub</p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">Pick your game</h1>
      </header>

      {/* Main game — Swipe */}
      <Link
        to="/"
        search={{}}
        className="mt-5 block w-full overflow-hidden rounded-2xl border border-border bg-card shadow-card transition hover:border-primary/40 hover:shadow-lg"
      >
        <div className="flex items-center gap-4 p-5">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Layers className="h-7 w-7" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-xl font-bold tracking-tight">Swipe</h3>
            <p className="mt-1 text-sm text-muted-foreground">Keep, trim, or delete — one swipe at a time.</p>
          </div>
        </div>
      </Link>

      {/* 2x2 grid */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        {miniGames.map((g) => (
          <Link
            key={g.to}
            to={g.to}
            className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-5 shadow-soft transition hover:border-primary/40 hover:shadow-card"
            onContextMenu={(e) => handleLongPress(e, g)}
            onTouchStart={() => startPress(g)}
            onTouchEnd={endPress}
            onTouchCancel={endPress}
          >
            <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl", g.iconBg, g.iconFg)}>
              {g.icon}
            </div>
            <h3 className="mt-3 text-center font-display text-sm font-bold tracking-tight">{g.title}</h3>
          </Link>
        ))}
      </div>

      {/* Long-press tooltip */}
      {tooltip && (
        <div
          className="fixed inset-0 z-50"
          onClick={() => setTooltip(null)}
          onTouchStart={() => setTooltip(null)}
        >
          <div
            className="absolute z-50 w-64 -translate-x-1/2 -translate-y-full rounded-xl border border-border bg-card p-3 shadow-lg"
            style={{ left: tooltip.x, top: tooltip.y }}
          >
            <p className="font-display text-sm font-bold">{tooltip.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{tooltip.tagline}</p>
          </div>
        </div>
      )}
    </div>
  );
}
