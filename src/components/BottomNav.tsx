import { Link, useLocation } from "@tanstack/react-router";
import { Layers, Brain, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/", label: "Swipe", icon: Layers },
  { to: "/memory", label: "Memory", icon: Brain },
  { to: "/stats", label: "Stats", icon: BarChart3 },
] as const;

export function BottomNav() {
  const { pathname } = useLocation();
  return (
    <nav
      aria-label="Primary"
      className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/85 backdrop-blur-xl"
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {tabs.map((t) => {
          const active = pathname === t.to;
          const Icon = t.icon;
          return (
            <li key={t.to} className="flex-1">
              <Link
                to={t.to}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 rounded-xl py-2 text-xs font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className={cn("h-5 w-5", active && "stroke-[2.4]")} />
                <span className="tracking-tight">{t.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
