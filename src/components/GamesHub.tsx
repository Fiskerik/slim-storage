import { Link } from "@tanstack/react-router";
import { Brain, Scale, Timer, HardDrive, ArrowRight } from "lucide-react";

type Game = {
  to: string;
  title: string;
  tagline: string;
  icon: React.ReactNode;
  iconBg: string;
  iconFg: string;
  available: boolean;
};

export function GamesHub() {

  const games: Game[] = [
    {
      to: "/memory",
      title: "Memory Lane",
      tagline: "Guess the year of forgotten photos, then keep or clear.",
      icon: <Brain className="h-5 w-5" />,
      iconBg: "bg-primary/15",
      iconFg: "text-primary",
      available: true,
    },
    {
      to: "/games/this-or-that",
      title: "This or That",
      tagline: "Two near-duplicates side by side. Pick the keeper, lose the rest.",
      icon: <Scale className="h-5 w-5" />,
      iconBg: "bg-accent/20",
      iconFg: "text-accent-foreground",
      available: true,
    },
    {
      to: "/games/speed-round",
      title: "Speed Round",
      tagline: "30 seconds, swipe as many photos as you can. Score = MB freed.",
      icon: <Timer className="h-5 w-5" />,
      iconBg: "bg-warm/25",
      iconFg: "text-warm-foreground",
      available: true,
    },
    {
      to: "/games/storage-budget",
      title: "Storage Budget",
      tagline: "50 MB budget. Keep only what fits. Real trade-offs, real space.",
      icon: <HardDrive className="h-5 w-5" />,
      iconBg: "bg-secondary",
      iconFg: "text-secondary-foreground",
      available: true,
    },
  ];

  return (
    <div className="px-5 pt-5 pb-8">
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Game hub</p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">Pick your game</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Different ways to clean — same result: less clutter, more space.
        </p>
      </header>

      <div className="mt-5 space-y-3">
        {games.map((g) => (
          <Link
            key={g.to}
            to={g.to}
            className="block rounded-2xl border border-border bg-card p-4 shadow-soft transition hover:border-primary/40 hover:shadow-card"
          >
            <div className="flex items-start gap-3">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${g.iconBg} ${g.iconFg}`}>
                {g.icon}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-display text-lg font-bold tracking-tight">{g.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{g.tagline}</p>
              </div>
              <ArrowRight className="mt-3 h-4 w-4 shrink-0 text-muted-foreground" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
