import { useState } from "react";
import {
  User,
  Cloud,
  Bell,
  Layers,
  Shield,
  Trash2,
  RotateCcw,
  ChevronRight,
  Sparkles,
  Share2,
  Crown,
  Pencil,
  Check,
  FileText,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useStats } from "@/hooks/use-stats";
import { updateSettings, deleteAllData, setPro } from "@/lib/storage";
import { isNativeApp } from "@/lib/photo-source";
import {
  restorePurchases,
  presentPaywall,
  presentCustomerCenter,
  openSubscriptionSettings,
} from "@/lib/purchases";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ShareStatsCard } from "@/components/ShareStatsCard";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function ProfilePage() {
  const stats = useStats();
  const s = stats.settings;
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(s.displayName);
  const [shareOpen, setShareOpen] = useState(false);
  const [upgradeBusy, setUpgradeBusy] = useState(false);
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [manageBusy, setManageBusy] = useState(false);

  const freed = stats.mbFreed;
  const freedLabel = freed >= 1024 ? `${(freed / 1024).toFixed(2)} GB` : `${freed.toFixed(1)} MB`;
  const reviewed = stats.cleaned + stats.deleted + stats.slimmed;

  function saveName() {
    updateSettings({ displayName: name.trim() || "You" });
    setEditingName(false);
  }

  function deleteAll() {
    if (
      confirm(
        "Delete all Slim data? This wipes your stats, streak, settings, and history. This cannot be undone.",
      )
    ) {
      deleteAllData();
      toast.success("All data deleted");
    }
  }

  return (
    <div className="px-5 pt-5 pb-8">
      {/* Header / identity */}
      <header className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary to-warm text-primary-foreground shadow-card">
          <User className="h-7 w-7" />
        </div>
        <div className="min-w-0 flex-1">
          {editingName ? (
            <div className="flex items-center gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={20}
                autoFocus
                className="w-full rounded-lg border border-border bg-background px-2 py-1 font-display text-xl font-bold focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                onClick={saveName}
                className="rounded-full bg-primary p-1.5 text-primary-foreground"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditingName(true)}
              className="group flex items-center gap-1.5 text-left"
            >
              <h1 className="font-display text-2xl font-bold tracking-tight">{s.displayName}</h1>
              <Pencil className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
            </button>
          )}
          <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
            {stats.isPro ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 font-semibold text-primary">
                <Crown className="h-3 w-3" /> Slim Pro
              </span>
            ) : (
              <span>Free plan · {Math.max(0, 10 - (stats.trimsToday ?? 0))} trims left today</span>
            )}
          </div>
        </div>
      </header>

      {/* Stats summary */}
      <section className="mt-6 grid grid-cols-3 gap-3">
        <SummaryStat label="Freed" value={freedLabel} accent />
        <SummaryStat label="Reviewed" value={reviewed} />
        <SummaryStat label="Streak" value={`🔥 ${stats.streak}`} />
      </section>

      <button
        onClick={() => setShareOpen(true)}
        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card py-3 text-sm font-semibold text-foreground transition hover:border-primary/40"
      >
        <Share2 className="h-4 w-4" /> Share my Slim card
      </button>

      {/* Pro upsell (free users only) */}
      {!stats.isPro && (
        <button
          onClick={async () => {
            if (!isNativeApp()) {
              toast.error("Upgrades are only available in the iOS app.");
              return;
            }

            try {
              setUpgradeBusy(true);
              const success = await presentPaywall();
              if (success) {
                setPro(true);
                toast.success("TrimSwipe Pro unlocked!");
              } else {
                toast("Purchase not completed");
              }
            } finally {
              setUpgradeBusy(false);
            }
          }}
          disabled={upgradeBusy}
          className="mt-3 flex w-full items-center justify-between rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-warm/15 p-4 text-left transition hover:from-primary/15 disabled:opacity-60"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Crown className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold">
                {upgradeBusy ? "Opening upgrade…" : "Upgrade to TrimSwipe Pro"}
              </p>
              <p className="text-xs text-muted-foreground">
                Unlimited trims · lifetime access · purchase shown in native paywall
              </p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
      )}

      {/* Settings */}
      <h2 className="mt-7 px-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Game settings
      </h2>
      <div className="mt-3 space-y-3">
        <SliderRow
          icon={<Layers className="h-4 w-4" />}
          label="Cards per round"
          hint="How many photos per Memory and Swipe round"
          value={s.cardsPerRound}
          min={5}
          max={30}
          step={1}
          onChange={(v) => updateSettings({ cardsPerRound: v })}
          suffix="cards"
        />
      </div>

      <h2 className="mt-7 px-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Sync &amp; reminders
      </h2>
      <div className="mt-3 space-y-3">
        <ToggleRow
          icon={<Cloud className="h-4 w-4" />}
          label="Sync with iCloud"
          hint="Keep stats and streak across your devices"
          checked={s.iCloudSync}
          onChange={(v) => updateSettings({ iCloudSync: v })}
        />
        <ToggleRow
          icon={<Shield className="h-4 w-4" />}
          label="Warn before deleting un-backed-up photos"
          hint="Recommended. Stops you from losing originals."
          checked={s.iCloudBackupWarn}
          onChange={(v) => updateSettings({ iCloudBackupWarn: v })}
        />
        <ToggleRow
          icon={<Bell className="h-4 w-4" />}
          label="Daily reminder"
          hint={s.reminderEnabled ? `At ${s.reminderTime}` : "Off"}
          checked={s.reminderEnabled}
          onChange={(v) => updateSettings({ reminderEnabled: v })}
        />
        {s.reminderEnabled && (
          <div className="rounded-2xl border border-border bg-card p-4">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Reminder time
            </label>
            <input
              type="time"
              value={s.reminderTime}
              onChange={(e) => updateSettings({ reminderTime: e.target.value })}
              className="mt-2 block w-full max-w-full box-border appearance-none rounded-lg border border-border bg-background px-3 py-2 font-display text-lg font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        )}
      </div>

      <h2 className="mt-7 px-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Privacy
      </h2>
      <div className="mt-3 space-y-2">
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-success/15 text-success">
              <Shield className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold">Data Not Collected</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                No analytics, no ads, no cloud upload of your photos. Ever.
              </p>
            </div>
          </div>
        </div>
        <Link
          to="/privacy"
          className="flex w-full items-center justify-between rounded-2xl border border-border bg-card p-4 text-left transition hover:border-primary/40"
        >
          <div className="flex items-center gap-3">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Privacy Policy</span>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
        <Link
          to="/terms"
          className="flex w-full items-center justify-between rounded-2xl border border-border bg-card p-4 text-left transition hover:border-primary/40"
        >
          <div className="flex items-center gap-3">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Terms of Use (EULA)</span>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      </div>

      <h2 className="mt-7 px-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Account
      </h2>
      <div className="mt-3 space-y-2">
        <button
          onClick={async () => {
            if (!isNativeApp()) {
              toast.error("Restore is only available in the iOS app.");
              return;
            }

            try {
              setRestoreBusy(true);
              console.log("[Profile] restore purchases tapped");
              const restored = await restorePurchases();
              if (restored) {
                setPro(true);
                toast.success("Purchases restored!");
              } else {
                toast("No previous purchases found");
              }
            } catch (error) {
              console.log("[Profile] restore purchases failed", error);
              toast.error("Could not restore purchases");
            } finally {
              setRestoreBusy(false);
            }
          }}
          disabled={restoreBusy}
          className="flex w-full items-center justify-between rounded-2xl border border-border bg-card p-4 text-left transition hover:border-primary/40 disabled:opacity-60"
        >
          <div className="flex items-center gap-3">
            <RotateCcw className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">
              {restoreBusy ? "Restoring purchases…" : "Restore purchases"}
            </span>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
        {stats.isPro && import.meta.env.DEV && (
          <button
            onClick={() => {
              setPro(false);
              toast.success("Reverted to free plan");
            }}
            className="flex w-full items-center justify-between rounded-2xl border border-border bg-card p-4 text-left transition hover:border-primary/40"
          >
            <div className="flex items-center gap-3">
              <RotateCcw className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Switch back to free (test)</span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
        {stats.isPro && (
          <button
            onClick={async () => {
              if (!isNativeApp()) {
                toast("Customer Center is only available in the app");
                return;
              }

              try {
                setManageBusy(true);
                console.log("[Profile] manage subscription tapped");
                const opened = await presentCustomerCenter();
                if (!opened) {
                  await openSubscriptionSettings();
                  toast("Opening Apple subscription settings");
                }
              } catch (error) {
                console.log("[Profile] manage subscription failed", error);
                await openSubscriptionSettings();
                toast.error("Could not open Customer Center. Opening Apple settings instead.");
              } finally {
                setManageBusy(false);
              }
            }}
            disabled={manageBusy}
            className="flex w-full items-center justify-between rounded-2xl border border-border bg-card p-4 text-left transition hover:border-primary/40 disabled:opacity-60"
          >
            <div className="flex items-center gap-3">
              <Crown className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                {manageBusy ? "Opening subscription…" : "Manage subscription"}
              </span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
        <button
          onClick={deleteAll}
          className="flex w-full items-center justify-between rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-left text-destructive transition hover:bg-destructive/10"
        >
          <div className="flex items-center gap-3">
            <Trash2 className="h-4 w-4" />
            <span className="text-sm font-semibold">Delete all Slim data</span>
          </div>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <p className="mt-6 text-center text-[10px] text-muted-foreground">
        Slim · v1.0 · Made with ❤️ for cluttered camera rolls
      </p>

      {shareOpen && <ShareStatsCard onClose={() => setShareOpen(false)} />}
    </div>
  );
}

function SummaryStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3 text-center shadow-soft">
      <p
        className={cn(
          "font-display text-lg font-bold tabular-nums leading-tight",
          accent && "text-primary",
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}

function ToggleRow({
  icon,
  label,
  hint,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium">{label}</p>
          {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function SliderRow({
  icon,
  label,
  hint,
  value,
  min,
  max,
  step,
  onChange,
  suffix,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-medium">{label}</p>
            <p className="font-display text-base font-bold tabular-nums text-primary">
              {value} {suffix}
            </p>
          </div>
          {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
        </div>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(v[0])}
        className="mt-4"
      />
      <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}
