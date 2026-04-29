import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useTransform, type PanInfo, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowUp, ArrowRight, MapPin, Sparkles, RefreshCw, Lock, Cloud, Undo2, PartyPopper, Trash2, Check } from "lucide-react";
import { SAMPLE_PHOTOS, type SamplePhoto } from "@/lib/photos";
import { setStats, bumpStreak, canTrim, recordTrim, logDay, trimsRemainingToday, setPro, FREE_TRIM_LIMIT, softDelete, undoDelete, updateSettings } from "@/lib/storage";
import { useStats } from "@/hooks/use-stats";
import { Onboarding } from "@/components/Onboarding";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Action = "keep" | "trim" | "delete";

type SessionRecap = {
  kept: number;
  trimmed: number;
  deleted: number;
  freed: number;
};

const SWIPE_THRESHOLD = 110;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function SwipeDeck() {
  const stats = useStats();
  const cardsPerRound = Math.min(30, Math.max(5, stats.settings.cardsPerRound));
  // Start with a deterministic order for SSR; shuffle after mount to avoid hydration mismatch.
  const [queue, setQueue] = useState<SamplePhoto[]>(() => SAMPLE_PHOTOS.slice(0, cardsPerRound));
  const [recap, setRecap] = useState<SessionRecap | null>(null);
  const [confirmList, setConfirmList] = useState<SamplePhoto[] | null>(null);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [iCloudWarn, setICloudWarn] = useState<{ photo: SamplePhoto } | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    setQueue((q) => (q === SAMPLE_PHOTOS.slice(0, cardsPerRound) ? shuffle(SAMPLE_PHOTOS).slice(0, cardsPerRound) : q));
    if (!stats.settings.onboarded) setShowOnboarding(true);
    // Run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const sessionRef = useRef<SessionRecap>({ kept: 0, trimmed: 0, deleted: 0, freed: 0 });
  const deletedPhotosRef = useRef<SamplePhoto[]>([]);
  const seenICloudWarnRef = useRef(false);

  const top = queue[0];
  const next = queue[1];
  const trimsLeft = stats.isPro ? Infinity : Math.max(0, FREE_TRIM_LIMIT - (stats.trimsTodayDate === new Date().toISOString().slice(0, 10) ? stats.trimsToday : 0));

  function commitDelete(photo: SamplePhoto) {
    const sess = sessionRef.current;
    sess.deleted += 1;
    sess.freed += photo.sizeMB;
    setStats((s) => ({ ...s, deleted: s.deleted + 1, mbFreed: s.mbFreed + photo.sizeMB }));
    logDay({ deleted: 1, mbFreed: photo.sizeMB });
    softDelete({ id: photo.id, title: photo.title, sizeMB: photo.sizeMB });

    // 30s undo window
    toast.success(`Deleted · freed ${photo.sizeMB.toFixed(1)} MB`, {
      duration: 5000,
      icon: <Undo2 className="h-4 w-4" />,
      description: "Tap Undo to restore. Stays in Recently Deleted for 30 days.",
      action: {
        label: "Undo",
        onClick: () => {
          undoDelete(photo.id);
          setStats((s) => ({
            ...s,
            deleted: Math.max(0, s.deleted - 1),
            mbFreed: Math.max(0, s.mbFreed - photo.sizeMB),
          }));
          sess.deleted = Math.max(0, sess.deleted - 1);
          sess.freed = Math.max(0, sess.freed - photo.sizeMB);
          // Put it back at the top
          setQueue((q) => [photo, ...q]);
          toast.success("Restored");
        },
      },
    });

    advance();
  }

  function advance() {
    setQueue((q) => {
      const rest = q.slice(1);
      if (rest.length === 0) {
        bumpStreak();
        setRecap({ ...sessionRef.current });
        sessionRef.current = { kept: 0, trimmed: 0, deleted: 0, freed: 0 };
      }
      return rest;
    });
  }

  function handleAction(photo: SamplePhoto, action: Action) {
    const sess = sessionRef.current;
    if (action === "trim" && !canTrim()) {
      setPaywallOpen(true);
      return;
    }

    if (action === "keep") {
      sess.kept += 1;
      setStats((s) => ({ ...s, cleaned: s.cleaned + 1 }));
      logDay({ kept: 1 });
      advance();
    } else if (action === "trim") {
      const saved = +(photo.sizeMB * 0.32).toFixed(2);
      sess.trimmed += 1;
      sess.freed += saved;
      setStats((s) => ({ ...s, slimmed: s.slimmed + 1, mbFreed: s.mbFreed + saved }));
      logDay({ trimmed: 1, mbFreed: saved });
      recordTrim();
      const remaining = trimsRemainingToday();
      toast.success(`Slimmed · saved ${saved.toFixed(1)} MB`, {
        description: stats.isPro
          ? (photo.hasGPS ? "GPS & device tags stripped" : "Metadata stripped")
          : `${remaining} free trim${remaining === 1 ? "" : "s"} left today`,
      });
      advance();
    } else if (action === "delete") {
      // iCloud backup awareness — show warning the first time per session
      if (stats.settings.iCloudBackupWarn && !seenICloudWarnRef.current) {
        seenICloudWarnRef.current = true;
        setICloudWarn({ photo });
        return;
      }
      commitDelete(photo);
    }
  }

  function reset() {
    setQueue(shuffle(SAMPLE_PHOTOS).slice(0, cardsPerRound));
    setRecap(null);
  }

  if (showOnboarding) {
    return <Onboarding onDone={() => setShowOnboarding(false)} />;
  }

  if (recap) {
    return <SessionSummary recap={recap} onContinue={reset} />;
  }

  return (
    <div className="flex flex-col items-center px-5 pt-4">
      <div className="flex w-full max-w-sm items-center justify-between">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          {queue.length} left
        </p>
        {!stats.isPro && (
          <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold tabular-nums text-muted-foreground">
            {trimsLeft}/{FREE_TRIM_LIMIT} free trims today
          </span>
        )}
      </div>

      <div className="relative mt-4 h-[460px] w-full max-w-sm">
        <AnimatePresence>
          {next && <PhotoCard key={next.id} photo={next} stacked />}
          {top && (
            <SwipeableCard
              key={top.id}
              photo={top}
              onAction={(a) => handleAction(top, a)}
            />
          )}
          {!top && !recap && <EmptyDeckCard onReset={reset} />}
        </AnimatePresence>
      </div>

      <div className="mt-6 flex w-full max-w-sm items-center justify-center gap-4">
        <ActionButton
          label="Keep"
          variant="keep"
          icon={<ArrowLeft className="h-5 w-5" />}
          onClick={() => top && handleAction(top, "keep")}
          disabled={!top}
        />
        <ActionButton
          label="Trim"
          variant="trim"
          icon={<ArrowUp className="h-6 w-6" />}
          big
          onClick={() => top && handleAction(top, "trim")}
          disabled={!top}
        />
        <ActionButton
          label="Delete"
          variant="delete"
          icon={<ArrowRight className="h-5 w-5" />}
          onClick={() => top && handleAction(top, "delete")}
          disabled={!top}
        />
      </div>

      <p className="mt-5 text-center text-xs text-muted-foreground">
        ← Keep · ↑ Trim (slim & strip metadata) · → Delete
      </p>

      {paywallOpen && (
        <PaywallModal
          onClose={() => setPaywallOpen(false)}
          onUpgrade={() => {
            setPro(true);
            setPaywallOpen(false);
            toast.success("Pro unlocked · unlimited trims");
          }}
        />
      )}

      {iCloudWarn && (
        <ICloudWarnModal
          photo={iCloudWarn.photo}
          onCancel={() => {
            seenICloudWarnRef.current = false;
            setICloudWarn(null);
          }}
          onConfirm={(disable) => {
            if (disable) updateSettings({ iCloudBackupWarn: false });
            const p = iCloudWarn.photo;
            setICloudWarn(null);
            commitDelete(p);
          }}
        />
      )}
    </div>
  );
}

function EmptyDeckCard({ onReset }: { onReset: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="absolute inset-0 flex flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-card/60 p-6 text-center"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-success/15 text-success">
        <PartyPopper className="h-6 w-6" />
      </div>
      <h3 className="mt-3 font-display text-xl font-bold">All caught up</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        You're done with this batch. Take a breath.
      </p>
      <button
        onClick={onReset}
        className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground shadow-card hover:opacity-90"
      >
        <RefreshCw className="h-3.5 w-3.5" /> Load another set
      </button>
    </motion.div>
  );
}

function ICloudWarnModal({
  photo,
  onCancel,
  onConfirm,
}: {
  photo: SamplePhoto;
  onCancel: () => void;
  onConfirm: (disableForever: boolean) => void;
}) {
  const [disable, setDisable] = useState(false);
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-t-3xl border border-border bg-card p-6 shadow-card sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-warm/30 text-warm-foreground">
          <Cloud className="h-5 w-5" />
        </div>
        <h3 className="mt-4 font-display text-2xl font-bold">Backed up to iCloud?</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          We can't tell yet whether <span className="font-medium text-foreground">{photo.title}</span> is backed up.
          Once you delete it from your library, it's gone for good after 30 days in Recently Deleted.
          Make sure iCloud Photos has finished syncing before you continue.
        </p>

        <label className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={disable}
            onChange={(e) => setDisable(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          Don't show this again
        </label>

        <div className="mt-5 flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 rounded-full border border-border bg-background py-3 text-sm font-semibold text-foreground transition hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(disable)}
            className="flex-1 rounded-full bg-destructive py-3 text-sm font-semibold text-destructive-foreground shadow-card transition hover:opacity-90"
          >
            Delete anyway
          </button>
        </div>
      </div>
    </div>
  );
}

function SwipeableCard({
  photo,
  onAction,
}: {
  photo: SamplePhoto;
  onAction: (a: Action) => void;
}) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-14, 14]);
  const keepOpacity = useTransform(x, [-150, -40, 0], [1, 0.6, 0]);
  const deleteOpacity = useTransform(x, [0, 40, 150], [0, 0.6, 1]);
  const trimOpacity = useTransform(y, [-150, -40, 0], [1, 0.6, 0]);

  function onDragEnd(_: unknown, info: PanInfo) {
    const { offset } = info;
    if (offset.y < -SWIPE_THRESHOLD && Math.abs(offset.y) > Math.abs(offset.x)) {
      onAction("trim");
    } else if (offset.x > SWIPE_THRESHOLD) {
      onAction("delete");
    } else if (offset.x < -SWIPE_THRESHOLD) {
      onAction("keep");
    }
  }

  return (
    <motion.div
      style={{ x, y, rotate }}
      drag
      dragElastic={0.6}
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      onDragEnd={onDragEnd}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.18 } }}
      className="absolute inset-0 cursor-grab active:cursor-grabbing"
    >
      <PhotoCard photo={photo}>
        {/* Left edge — KEEP (green) */}
        <motion.div
          style={{ opacity: keepOpacity }}
          className="pointer-events-none absolute inset-y-0 left-0 w-1/2"
        >
          <div className="absolute inset-y-0 left-0 w-full bg-gradient-to-r from-success/80 via-success/30 to-transparent" />
          <div className="absolute inset-y-0 left-0 w-2.5 bg-success shadow-[0_0_24px_rgba(0,200,120,0.6)]" />
          <div className="absolute left-5 top-6 rotate-[-10deg] rounded-xl border-4 border-success bg-success/20 px-4 py-1.5 text-lg font-extrabold uppercase tracking-wider text-white backdrop-blur">
            Keep
          </div>
        </motion.div>

        {/* Right edge — DELETE (red) */}
        <motion.div
          style={{ opacity: deleteOpacity }}
          className="pointer-events-none absolute inset-y-0 right-0 w-1/2"
        >
          <div className="absolute inset-y-0 right-0 w-full bg-gradient-to-l from-destructive/80 via-destructive/30 to-transparent" />
          <div className="absolute inset-y-0 right-0 w-2.5 bg-destructive shadow-[0_0_24px_rgba(220,60,40,0.6)]" />
          <div className="absolute right-5 top-6 rotate-[10deg] rounded-xl border-4 border-destructive bg-destructive/25 px-4 py-1.5 text-lg font-extrabold uppercase tracking-wider text-white backdrop-blur">
            Delete
          </div>
        </motion.div>

        {/* Top — TRIM */}
        <motion.div
          style={{ opacity: trimOpacity }}
          className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-lg border-2 border-warm bg-warm/30 px-3 py-1 text-sm font-bold uppercase tracking-wider text-white backdrop-blur"
        >
          Trim
        </motion.div>
      </PhotoCard>
    </motion.div>
  );
}

function PhotoCard({
  photo,
  stacked,
  children,
}: {
  photo: SamplePhoto;
  stacked?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "absolute inset-0 overflow-hidden rounded-3xl border border-border bg-card shadow-card",
        stacked && "scale-[0.96] opacity-70 blur-[1px]",
      )}
    >
      <img
        src={photo.url}
        alt={photo.title}
        loading="lazy"
        className="h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />

      <div className="absolute left-4 right-4 top-4 flex items-center justify-between gap-2">
        <span className="rounded-full bg-black/40 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
          {photo.sizeMB.toFixed(1)} MB
        </span>
        {photo.hasGPS && (
          <span className="flex items-center gap-1 rounded-full bg-black/40 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
            <MapPin className="h-3 w-3" /> GPS
          </span>
        )}
      </div>

      <div className="absolute bottom-5 left-5 right-5 text-white">
        <h3 className="font-display text-2xl font-bold leading-tight">{photo.title}</h3>
        <p className="mt-1 text-xs opacity-80">
          {photo.month} {photo.year} · {photo.device}
        </p>
      </div>
      {children}
    </div>
  );
}

function ActionButton({
  label,
  icon,
  onClick,
  variant,
  big,
  disabled,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  variant: "keep" | "trim" | "delete";
  big?: boolean;
  disabled?: boolean;
}) {
  const styles = {
    keep: "bg-card text-foreground border-border hover:border-accent hover:text-accent-foreground hover:bg-accent/15",
    trim: "bg-primary text-primary-foreground border-primary shadow-card",
    delete: "bg-card text-destructive border-border hover:border-destructive hover:bg-destructive/10",
  }[variant];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "group flex flex-col items-center gap-1 rounded-2xl border px-4 py-3 transition disabled:opacity-40",
        big ? "min-w-[96px]" : "min-w-[80px]",
        styles,
      )}
    >
      <span
        className={cn(
          "flex items-center justify-center rounded-full",
          big ? "h-10 w-10" : "h-8 w-8",
          variant === "trim" ? "bg-primary-foreground/15" : "bg-transparent",
        )}
      >
        {icon}
      </span>
      <span className="text-xs font-semibold tracking-wide">{label}</span>
    </button>
  );
}

function SessionSummary({
  recap,
  onContinue,
}: {
  recap: SessionRecap;
  onContinue: () => void;
}) {
  const total = recap.kept + recap.trimmed + recap.deleted;
  return (
    <div className="flex flex-col items-center px-6 pt-10 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-primary">
        <Sparkles className="h-7 w-7" />
      </div>
      <h2 className="mt-4 font-display text-2xl font-bold">Set complete</h2>
      <p className="mt-1 text-sm text-muted-foreground text-balance">
        You reviewed {total} photos and freed {recap.freed.toFixed(1)} MB.
      </p>

      <div className="mt-8 grid w-full max-w-sm grid-cols-3 gap-3">
        <Stat label="Kept" value={recap.kept} tone="text-foreground" />
        <Stat label="Trimmed" value={recap.trimmed} tone="text-primary" />
        <Stat label="Deleted" value={recap.deleted} tone="text-destructive" />
      </div>

      <div className="mt-6 w-full max-w-sm rounded-2xl border border-border bg-card p-5">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Storage freed</p>
        <p className="mt-1 font-display text-3xl font-bold tabular-nums">
          {recap.freed.toFixed(1)} <span className="text-base text-muted-foreground">MB</span>
        </p>
      </div>

      <button
        onClick={onContinue}
        className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-card transition hover:opacity-90"
      >
        <RefreshCw className="h-4 w-4" /> New set
      </button>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 text-center">
      <p className={cn("font-display text-2xl font-bold tabular-nums", tone)}>{value}</p>
      <p className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}

function PaywallModal({ onClose, onUpgrade }: { onClose: () => void; onUpgrade: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-t-3xl border border-border bg-card p-6 shadow-card sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <Lock className="h-5 w-5" />
        </div>
        <h3 className="mt-4 font-display text-2xl font-bold">Daily free limit reached</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          You've used your {FREE_TRIM_LIMIT} free trims for today. Upgrade to Slim Pro for unlimited trims, or come back tomorrow.
        </p>

        <div className="mt-5 space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Sparkles className="h-4 w-4 text-primary" /> Unlimited daily trims
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Sparkles className="h-4 w-4 text-primary" /> Strip GPS & metadata in bulk
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Sparkles className="h-4 w-4 text-primary" /> Heavy Hitters & history
          </div>
        </div>

        <button
          onClick={onUpgrade}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-card transition hover:opacity-90"
        >
          Unlock Slim Pro
        </button>
        <button
          onClick={onClose}
          className="mt-2 inline-flex w-full items-center justify-center rounded-full py-2.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}
