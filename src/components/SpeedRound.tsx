import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Timer, Trash2, Check, Sparkles, Play } from "lucide-react";
import { getPhotoSourceAsync, type LibraryPhoto } from "@/lib/photo-source";
import { displayPhotoUrl, preloadPhotoImages } from "@/lib/image-preload";
import { setStats, logDay } from "@/lib/storage";
import { useStats } from "@/hooks/use-stats";
import { convertHeicPhotosToJpeg, isHeicPhoto } from "@/lib/photo-conversion";
import { cn } from "@/lib/utils";
import { FullPhotoDialog } from "@/components/FullPhotoDialog";
import { PhotoSourceBar } from "@/components/PhotoSourceBar";
import { toast } from "sonner";

const DURATION = 30;

type Phase = "intro" | "play" | "review" | "done";

type Decision = { photo: LibraryPhoto; keep: boolean };

export function SpeedRound() {
  const stats = useStats();
  const [phase, setPhase] = useState<Phase>("intro");
  const [queue, setQueue] = useState<LibraryPhoto[]>([]);
  const [time, setTime] = useState(DURATION);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [fullPhoto, setFullPhoto] = useState<LibraryPhoto | null>(null);
  const tickRef = useRef<number | null>(null);
  const completedRoundLoggedRef = useRef(false);
  const preloadedQueueRef = useRef<Promise<LibraryPhoto[]> | null>(null);
  const conversionCandidatesRef = useRef<LibraryPhoto[]>([]);

  function preloadNextQueue() {
    if (!preloadedQueueRef.current) {
      preloadedQueueRef.current = getPhotoSourceAsync()
        .then((src) => src.getRandom(40))
        .then((photos) => {
          console.log("[SpeedRound] preloaded next round", { count: photos.length });
          preloadPhotoImages(photos.slice(0, 6));
          return photos;
        })
        .catch((error) => {
          console.log("[SpeedRound] preload failed", { error });
          return [];
        });
    }
  }

  useEffect(() => {
    preloadNextQueue();
  }, []);

  useEffect(() => {
    if (phase !== "play") return;
    tickRef.current = window.setInterval(() => {
      setTime((t) => {
        if (t <= 1) {
          if (tickRef.current) window.clearInterval(tickRef.current);
          setPhase("review");
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
  }, [phase]);

  useEffect(() => {
    if (queue.length === 0) return;
    preloadPhotoImages(queue.slice(1, 6));
  }, [queue]);

  async function start() {
    const src = await getPhotoSourceAsync();
    const permission = await src.requestPermission();
    if (!permission.granted) {
      console.log("[SpeedRound] photo access denied or no folder selected", {
        isNative: src.isNative,
      });
      return;
    }
    const pending = preloadedQueueRef.current;
    preloadedQueueRef.current = null;
    const preloadedPhotos = pending ? await pending : [];
    const photos = preloadedPhotos.length > 0 ? preloadedPhotos : await src.getRandom(40);
    if (photos.length === 0) {
      console.log("[SpeedRound] no photos available to start");
      setQueue([]);
      setDecisions([]);
      setPhase("intro");
      return;
    }
    setQueue(photos);
    preloadPhotoImages(photos.slice(0, 6));
    preloadNextQueue();
    setTime(DURATION);
    setDecisions([]);
    conversionCandidatesRef.current = [];
    completedRoundLoggedRef.current = false;
    setPhase("play");
  }

  function decide(keep: boolean) {
    const top = queue[0];
    if (!top) return;
    setDecisions((d) => [...d, { photo: top, keep }]);
    if (keep) {
      conversionCandidatesRef.current = [...conversionCandidatesRef.current, top];
    }
    if (!keep) {
      setStats((s) => ({
        ...s,
        deleted: s.deleted + 1,
        mbFreed: s.mbFreed + top.sizeMB,
      }));
      logDay({
        deleted: 1,
        mbFreed: top.sizeMB,
        deletedMbFreed: top.sizeMB,
        speedRoundReviewed: 1,
      });
    } else {
      setStats((s) => ({ ...s, cleaned: s.cleaned + 1 }));
      logDay({ kept: 1, speedRoundReviewed: 1 });
    }
    setQueue((q) => {
      const rest = q.slice(1);
      if (rest.length === 0) setPhase("review");
      return rest;
    });
  }

  const [reviewSelection, setReviewSelection] = useState<Record<string, boolean>>({});

  const trashed = useMemo(() => decisions.filter((d) => !d.keep), [decisions]);
  const selectedForDelete = useMemo(
    () =>
      trashed.filter(
        (d, index) =>
          reviewSelection[`${d.photo.id}:${d.photo.nativeId ?? "web"}:${index}`] !== false,
      ),
    [reviewSelection, trashed],
  );
  const freedMB = useMemo(
    () => selectedForDelete.reduce((s, d) => s + d.photo.sizeMB, 0),
    [selectedForDelete],
  );

  useEffect(() => {
    if (phase !== "review") return;
    if (!completedRoundLoggedRef.current) {
      completedRoundLoggedRef.current = true;
      setStats((s) => ({
        ...s,
        speedRoundPlayed: s.speedRoundPlayed + 1,
        speedRoundBestCount: Math.max(s.speedRoundBestCount, decisions.length),
        speedRoundBestMb: Math.max(s.speedRoundBestMb, freedMB),
        speedRoundTotalReviewed: s.speedRoundTotalReviewed + decisions.length,
        speedRoundTotalMbFreed: s.speedRoundTotalMbFreed + freedMB,
      }));
      logDay({ speedRoundPlayed: 1 });
    }
    const initial: Record<string, boolean> = {};
    trashed.forEach((d, index) => {
      initial[`${d.photo.id}:${d.photo.nativeId ?? "web"}:${index}`] = true;
    });
    setReviewSelection(initial);
  }, [decisions.length, freedMB, phase, trashed]);

  async function convertSpeedRoundHeicPhotos(photos: LibraryPhoto[]) {
    if (!stats.settings.convertHeicToJpegAfterRounds) return;
    const heicCount = photos.filter(isHeicPhoto).length;
    if (heicCount === 0) return;

    toast.loading(`Converting ${heicCount} HEIC photo${heicCount === 1 ? "" : "s"} to JPG…`, {
      id: "heic-conversion",
    });
    const result = await convertHeicPhotosToJpeg(photos);
    if (result.converted > 0) {
      toast.success(
        `Converted ${result.converted} HEIC photo${result.converted === 1 ? "" : "s"} to JPG`,
        {
          id: "heic-conversion",
        },
      );
    } else if (result.failed > 0 || result.skipped > 0) {
      toast.error("HEIC to JPG conversion could not finish", { id: "heic-conversion" });
    } else {
      toast.dismiss("heic-conversion");
    }
  }

  async function confirmDelete() {
    const src = await getPhotoSourceAsync();
    const ids = selectedForDelete.map((d) => d.photo.nativeId || d.photo.id);
    if (ids.length > 0) {
      const result = await src.deletePhotos(ids);
      console.log("[SpeedRound] delete result", result);
    }
    const retainedPhotos = decisions
      .filter((decision) => {
        if (decision.keep) return true;
        const trashIndex = trashed.findIndex((item) => item === decision);
        if (trashIndex === -1) return true;
        const key = `${decision.photo.id}:${decision.photo.nativeId ?? "web"}:${trashIndex}`;
        return reviewSelection[key] === false;
      })
      .map((decision) => decision.photo);
    const restoredTrash = trashed.filter((decision, index) => {
      const key = `${decision.photo.id}:${decision.photo.nativeId ?? "web"}:${index}`;
      return reviewSelection[key] === false;
    });
    const restoredMB = +restoredTrash
      .reduce((sum, decision) => sum + decision.photo.sizeMB, 0)
      .toFixed(2);
    if (restoredTrash.length > 0) {
      setStats((s) => ({
        ...s,
        deleted: Math.max(0, s.deleted - restoredTrash.length),
        mbFreed: Math.max(0, +(s.mbFreed - restoredMB).toFixed(2)),
        speedRoundTotalMbFreed: Math.max(0, +(s.speedRoundTotalMbFreed - restoredMB).toFixed(2)),
      }));
      logDay({ deleted: -restoredTrash.length, mbFreed: -restoredMB, deletedMbFreed: -restoredMB });
    }
    await convertSpeedRoundHeicPhotos(retainedPhotos);
    conversionCandidatesRef.current = [];
    setPhase("done");
  }

  async function skipDelete() {
    const restoredMB = +trashed
      .reduce((sum, decision) => sum + decision.photo.sizeMB, 0)
      .toFixed(2);
    if (trashed.length > 0) {
      setStats((s) => ({
        ...s,
        deleted: Math.max(0, s.deleted - trashed.length),
        mbFreed: Math.max(0, +(s.mbFreed - restoredMB).toFixed(2)),
        speedRoundTotalMbFreed: Math.max(0, +(s.speedRoundTotalMbFreed - restoredMB).toFixed(2)),
      }));
      logDay({ deleted: -trashed.length, mbFreed: -restoredMB, deletedMbFreed: -restoredMB });
    }
    await convertSpeedRoundHeicPhotos(decisions.map((decision) => decision.photo));
    conversionCandidatesRef.current = [];
    setPhase("done");
  }

  if (phase === "intro") {
    return (
      <div className="flex flex-col items-center px-6 pt-4 text-center">
        <PhotoSourceBar
          onChanged={() => {
            preloadedQueueRef.current = null;
          }}
        />
        <div className="mt-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-warm/30 text-warm-foreground shadow-card">
          <Timer className="h-7 w-7" />
        </div>
        <h2 className="mt-4 font-display text-3xl font-bold">Speed Round</h2>
        <p className="mt-2 max-w-xs text-sm text-muted-foreground text-balance">
          30 seconds. Tap Keep or Trash as fast as you can.
        </p>
        <button
          onClick={start}
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3 text-sm font-semibold text-primary-foreground shadow-card hover:opacity-90"
        >
          <Play className="h-4 w-4" /> Start
        </button>
      </div>
    );
  }

  if (phase === "review") {
    return (
      <div className="flex flex-col items-center px-6 pt-4 text-center">
        <PhotoSourceBar />
        <div className="mt-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Sparkles className="h-7 w-7" />
        </div>
        <h2 className="mt-4 font-display text-2xl font-bold">Time's up!</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {decisions.length} photos reviewed · {trashed.length} marked during round
        </p>
        {trashed.length > 0 && (
          <p className="mt-1 text-sm text-muted-foreground">
            Review your trash picks below, then confirm deletion
          </p>
        )}

        {trashed.length > 0 && (
          <div className="mt-4 w-full max-w-sm rounded-2xl border border-border bg-card p-3 text-left">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Review before deleting
            </p>
            <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
              {trashed.map(({ photo }, index) => {
                const key = `${photo.id}:${photo.nativeId ?? "web"}:${index}`;
                const checked = reviewSelection[key] !== false;
                return (
                  <label
                    key={key}
                    className="flex items-center gap-3 rounded-xl border border-border/60 p-2"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => setReviewSelection((prev) => ({ ...prev, [key]: !checked }))}
                      className="h-4 w-4"
                    />
                    <img
                      src={displayPhotoUrl(photo)}
                      alt={photo.title}
                      className="h-12 w-12 rounded-lg object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{photo.title}</p>
                      <p className="text-xs text-muted-foreground">{photo.sizeMB.toFixed(1)} MB</p>
                    </div>
                  </label>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Selected to delete: {selectedForDelete.length} · {freedMB.toFixed(1)} MB
            </p>
          </div>
        )}

        {trashed.length > 0 ? (
          <div className="mt-4 flex w-full max-w-xs flex-col gap-3">
            <button
              onClick={confirmDelete}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-destructive px-6 py-3 text-sm font-semibold text-destructive-foreground shadow-card hover:opacity-90"
            >
              <Trash2 className="h-4 w-4" /> Delete {selectedForDelete.length} photos
            </button>
            <button
              onClick={skipDelete}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground hover:bg-muted"
            >
              Skip — keep all
            </button>
          </div>
        ) : (
          <button
            onClick={async () => {
              await convertSpeedRoundHeicPhotos(conversionCandidatesRef.current);
              conversionCandidatesRef.current = [];
              setPhase("done");
            }}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-card hover:opacity-90"
          >
            Continue
          </button>
        )}
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div className="flex flex-col items-center px-6 pt-4 text-center">
        <PhotoSourceBar
          onChanged={() => {
            preloadedQueueRef.current = null;
          }}
        />
        <div className="mt-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Sparkles className="h-7 w-7" />
        </div>
        <h2 className="mt-4 font-display text-2xl font-bold">Round complete</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {decisions.length} photos in {DURATION}s
        </p>
        <button
          onClick={start}
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-card hover:opacity-90"
        >
          Play again
        </button>
      </div>
    );
  }

  const top = queue[0];
  const pct = (time / DURATION) * 100;
  const count = decisions.length;
  const freed = freedMB;

  return (
    <div className="flex flex-col items-center px-5 pt-4">
      <PhotoSourceBar
        onChanged={() => {
          preloadedQueueRef.current = null;
          void start();
        }}
      />
      <div className="mt-3 w-full max-w-sm">
        <div className="flex items-center justify-between text-xs">
          <span className="inline-flex items-center gap-1.5 uppercase tracking-[0.18em] text-muted-foreground">
            <Timer className="h-3.5 w-3.5" /> Speed Round
          </span>
          <span
            className={cn(
              "font-display text-lg font-bold tabular-nums",
              time <= 5 && "text-destructive",
            )}
          >
            {time}s
          </span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              time <= 5 ? "bg-destructive" : "bg-primary",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
          <span>{count} reviewed</span>
          <span className="tabular-nums">{freed.toFixed(1)} MB marked</span>
        </div>
      </div>

      <div className="relative mt-4 h-[420px] w-full max-w-sm">
        <AnimatePresence mode="popLayout">
          {top && (
            <motion.div
              key={top.id + queue.length}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0 overflow-hidden rounded-3xl border border-border bg-card shadow-card"
            >
              <img
                src={displayPhotoUrl(top)}
                alt={top.title}
                className="h-full w-full cursor-zoom-in object-cover"
                onClick={() => setFullPhoto(top)}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/65 to-transparent" />
              <div className="absolute bottom-5 left-5 right-5 text-white">
                <p className="text-xs opacity-80">{top.sizeMB.toFixed(1)} MB</p>
                <h3 className="font-display text-2xl font-bold">{top.title}</h3>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-5 grid w-full max-w-sm grid-cols-2 gap-3">
        <button
          onClick={() => decide(true)}
          className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card py-4 font-semibold text-foreground transition active:scale-95 hover:border-success/50"
        >
          <Check className="h-5 w-5 text-success" /> Keep
        </button>
        <button
          onClick={() => decide(false)}
          className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card py-4 font-semibold text-destructive transition active:scale-95 hover:border-destructive/50"
        >
          <Trash2 className="h-5 w-5" /> Trash
        </button>
      </div>
      <FullPhotoDialog photo={fullPhoto} onClose={() => setFullPhoto(null)} />
    </div>
  );
}
