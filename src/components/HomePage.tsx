import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useStats } from "@/hooks/use-stats";
import { calculateGoalCheckpoints, getTodayLog } from "@/lib/storage";
import {
  Scissors,
  Flame,
  HardDrive,
  Image,
  Info,
  ShieldCheck,
  X,
  Clock3,
  Trash2,
} from "lucide-react";

export function HomePage() {
  const s = useStats();
  const [trimInfoOpen, setTrimInfoOpen] = useState(false);
  const totalReviewed = s.cleaned + s.deleted + s.slimmed;
  const freed = s.mbFreed;
  const freedDisplay = freed >= 1024 ? `${(freed / 1024).toFixed(1)} GB` : `${freed.toFixed(0)} MB`;
  const today = getTodayLog(s);
  const todayFreed = today.mbFreed;
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

      <section className="mt-5 rounded-2xl border border-border bg-card p-4 shadow-card/50">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Clock3 className="h-4 w-4" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Today’s activity
              </p>
              <p className="text-sm font-semibold text-foreground">
                {todayFreed > 0 ? `${todayFreed.toFixed(1)} MB freed` : "No cleanup yet"}
              </p>
            </div>
          </div>
          {s.pendingDelete.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive">
              <Trash2 className="h-3.5 w-3.5" /> {s.pendingDelete.length} pending
            </span>
          )}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-xl bg-muted/60 p-2">
            <p className="font-display text-lg font-bold tabular-nums">{today.kept}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Kept</p>
          </div>
          <div className="rounded-xl bg-muted/60 p-2">
            <p className="font-display text-lg font-bold tabular-nums">{today.trimmed}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Trimmed</p>
          </div>
          <div className="rounded-xl bg-muted/60 p-2">
            <p className="font-display text-lg font-bold tabular-nums">{today.deleted}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Deleted</p>
          </div>
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

      <section className="mt-5 rounded-2xl border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Info className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">What does trimming do?</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Learn what gets removed, what stays, and how captions/descriptions are handled.
            </p>
          </div>
          <button
            onClick={() => setTrimInfoOpen(true)}
            className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition hover:border-primary/40"
          >
            Info
          </button>
        </div>
      </section>

      {trimInfoOpen && <TrimInfoModal onClose={() => setTrimInfoOpen(false)} />}
    </div>
  );
}

function TrimInfoModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 px-5 pb-5 pt-[calc(var(--safe-area-top,env(safe-area-inset-top))+3rem)] backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label="Close trimming info"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <h2 className="mt-4 font-display text-2xl font-bold">What trimming changes</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Trimming keeps the visible picture, but re-saves a cleaner copy so the file carries less
          extra data.
        </p>

        <div className="mt-5 space-y-4 text-sm">
          <InfoBlock
            title="Removed"
            items={[
              "GPS/location coordinates and place hints",
              "Camera/device details such as model, lens, exposure, ISO, and software tags",
              "Embedded thumbnails/previews and other bulky EXIF-style metadata",
              "App-specific sidecar notes that can include generated descriptions or text-recognition data when they are stored in the image metadata",
            ]}
          />
          <InfoBlock
            title="Kept"
            items={[
              "The actual pixels you see in the photo",
              "Basic library details needed to show the new image in Photos",
              "Your app stats, streak, and TrimSwipe history",
              "Visible text inside the picture itself, because it is part of the image pixels",
            ]}
          />
        </div>

        <p className="mt-5 rounded-2xl bg-muted p-3 text-xs text-muted-foreground">
          Important: trimming does not read, describe, or upload your pictures. If text is visibly
          printed in the image, it remains visible. If a description, caption, or recognized text
          was stored only as metadata, the re-saved copy may not keep it.
        </p>

        <button
          onClick={onClose}
          className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-card transition hover:opacity-90"
        >
          Got it
        </button>
      </div>
    </div>
  );
}

function InfoBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {title}
      </p>
      <ul className="mt-2 space-y-1.5 text-muted-foreground">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
