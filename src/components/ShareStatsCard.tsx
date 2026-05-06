import { useRef, useState } from "react";
import { Share2, Sparkles, Download, X } from "lucide-react";
import { useStats } from "@/hooks/use-stats";
import { toast } from "sonner";

export function ShareStatsCard({ onClose }: { onClose: () => void }) {
  const stats = useStats();
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const freed = stats.mbFreed;
  const freedLabel = freed >= 1024 ? `${(freed / 1024).toFixed(2)} GB` : `${freed.toFixed(1)} MB`;
  const reviewed = stats.cleaned + stats.deleted + stats.slimmed;

  const fmtDate = (iso: string) =>
    new Date(iso + "T00:00:00").toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  const startedLabel = stats.startedAt ? fmtDate(stats.startedAt) : null;
  const bestDay = (stats.daily ?? []).reduce(
    (best, d) => (d.mbFreed > (best?.mbFreed ?? 0) ? d : best),
    null as null | (typeof stats.daily)[number],
  );
  const bestLabel = bestDay
    ? `${bestDay.mbFreed >= 1024 ? (bestDay.mbFreed / 1024).toFixed(2) + " GB" : bestDay.mbFreed.toFixed(1) + " MB"} · ${fmtDate(bestDay.date)}`
    : null;

  async function share() {
    try {
      setBusy(true);
      const text = `I freed ${freedLabel} with Slim 🧹\n${reviewed} photos reviewed · 🔥 ${stats.streak}-day streak`;
      const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
      if (nav.share) {
        await nav.share({ title: "Slim", text });
      } else {
        await navigator.clipboard.writeText(text);
        toast.success("Copied to clipboard");
      }
    } catch {
      // user cancelled — silent
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/55 px-5 pb-5 pt-[calc(var(--safe-area-top,env(safe-area-inset-top))+1rem)] backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-3xl border border-border bg-card p-5 shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Share</p>
            <h3 className="mt-0.5 font-display text-xl font-bold">Your Slim card</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div
          ref={ref}
          className="mt-4 overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary to-warm p-6 text-primary-foreground"
        >
          <div className="flex items-center gap-2 text-xs opacity-85">
            <Sparkles className="h-3.5 w-3.5" />
            <span className="uppercase tracking-[0.18em]">Slim · on-device</span>
          </div>
          <p className="mt-6 font-display text-5xl font-bold tabular-nums">{freedLabel}</p>
          <p className="mt-1 text-sm opacity-90">
            saved{startedLabel ? ` since ${startedLabel}` : ""}
          </p>
          {bestLabel && <p className="mt-1 text-xs opacity-80">Best day · {bestLabel}</p>}
          <div className="mt-6 grid grid-cols-3 gap-3 text-center">
            <Mini label="Reviewed" value={reviewed} />
            <Mini label="Streak" value={`🔥${stats.streak}`} />
            <Mini label="Memory" value={stats.memoryPlayed} />
          </div>
        </div>

        <button
          disabled={busy}
          onClick={share}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-card transition hover:opacity-90 disabled:opacity-60"
        >
          <Share2 className="h-4 w-4" /> Share
        </button>
        <button
          onClick={async () => {
            const text = `I freed ${freedLabel} with Slim — ${reviewed} photos reviewed.`;
            await navigator.clipboard.writeText(text);
            toast.success("Copied");
          }}
          className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
        >
          <Download className="h-4 w-4" /> Copy text
        </button>
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl bg-white/15 p-2 backdrop-blur">
      <p className="font-display text-base font-bold tabular-nums">{value}</p>
      <p className="text-[9px] uppercase tracking-wider opacity-80">{label}</p>
    </div>
  );
}
