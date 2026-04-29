import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Scissors, Flame, MoveRight, ArrowLeft, ArrowUp, ArrowRight } from "lucide-react";
import { updateSettings } from "@/lib/storage";

export function Onboarding({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);

  const steps = [
    {
      icon: <Lock className="h-7 w-7" strokeWidth={2.4} />,
      title: "Private by default",
      body: "Your photos never leave your phone.",
    },
    {
      icon: <Scissors className="h-7 w-7" strokeWidth={2.4} />,
      title: "Swipe to clean",
      body: "Keep, trim, or delete with a flick.",
    },
    {
      icon: <Flame className="h-7 w-7" strokeWidth={2.4} />,
      title: "5 minutes a day",
      body: "Free GBs. Keep your streak.",
    },
  ];

  const cur = steps[step];
  const last = step === steps.length - 1;

  function next() {
    if (last) {
      updateSettings({ onboarded: true });
      onDone();
    } else {
      setStep(step + 1);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background px-6 pb-10 pt-[max(2rem,env(safe-area-inset-top))]">
      <div className="flex justify-center gap-1.5">
        {steps.map((_, i) => (
          <div
            key={i}
            className={`h-1 w-10 rounded-full ${i <= step ? "bg-primary" : "bg-muted"}`}
          />
        ))}
      </div>

      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.25 }}
            className="flex flex-col items-center"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-card">
              {cur.icon}
            </div>
            <h2 className="mt-5 font-display text-3xl font-bold tracking-tight">{cur.title}</h2>
            <p className="mt-3 max-w-xs text-sm text-muted-foreground text-balance">{cur.body}</p>

            {step === 0 && (
              <div className="mt-6 flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-xs text-muted-foreground">
                <Lock className="h-3.5 w-3.5 text-primary" />
                Data Not Collected · No analytics · No ads
              </div>
            )}

            {step === 1 && (
              <div className="mt-7 flex items-center gap-3">
                <SwipeHint
                  icon={<ArrowLeft className="h-4 w-4" strokeWidth={2.6} />}
                  label="Keep"
                  tone="success"
                />
                <SwipeHint
                  icon={<ArrowUp className="h-4 w-4" strokeWidth={2.6} />}
                  label="Trim"
                  tone="primary"
                />
                <SwipeHint
                  icon={<ArrowRight className="h-4 w-4" strokeWidth={2.6} />}
                  label="Delete"
                  tone="destructive"
                />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <button
        onClick={next}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary py-4 text-sm font-semibold text-primary-foreground shadow-card transition hover:opacity-90"
      >
        {last ? "Get started" : "Continue"}
        <MoveRight className="h-4 w-4" strokeWidth={2.4} />
      </button>
      {!last && (
        <button
          onClick={() => {
            updateSettings({ onboarded: true });
            onDone();
          }}
          className="mt-2 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          Skip
        </button>
      )}
    </div>
  );
}

function SwipeHint({
  icon,
  label,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  tone: "success" | "primary" | "destructive";
}) {
  const styles = {
    success: "bg-success/15 text-success border-success/30",
    primary: "bg-primary/15 text-primary border-primary/30",
    destructive: "bg-destructive/15 text-destructive border-destructive/30",
  }[tone];
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className={`flex h-11 w-11 items-center justify-center rounded-2xl border ${styles}`}
      >
        {icon}
      </div>
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
    </div>
  );
}
