import { useEffect, useState } from "react";
import { FolderOpen, Smartphone } from "lucide-react";
import { getPhotoSourceSummary, selectPhotoSourceFolder } from "@/lib/photo-source";
import { cn } from "@/lib/utils";

export function PhotoSourceBar({
  className,
  onChanged,
}: {
  className?: string;
  onChanged?: () => void;
}) {
  const [source, setSource] = useState(() => getPhotoSourceSummary());

  useEffect(() => {
    const update = () => setSource(getPhotoSourceSummary());
    update();
    window.addEventListener("slimPhotoSourceChanged", update);
    return () => window.removeEventListener("slimPhotoSourceChanged", update);
  }, []);

  async function changeFolder() {
    if (source.isNative) return;
    const permission = await selectPhotoSourceFolder();
    console.log("[PhotoSourceBar] folder selection finished", {
      granted: permission.granted,
      label: getPhotoSourceSummary().label,
    });
    setSource(getPhotoSourceSummary());
    onChanged?.();
  }

  const Icon = source.isNative ? Smartphone : FolderOpen;
  const label = source.isNative ? "iPhone storage" : source.label;

  return (
    <div
      className={cn(
        "flex w-full max-w-sm items-center justify-between rounded-2xl border border-border bg-card/80 px-3 py-2 text-left shadow-soft",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Photos from
          </p>
          <p className="truncate text-sm font-semibold text-foreground">{label}</p>
        </div>
      </div>
      {!source.isNative && (
        <button
          type="button"
          onClick={changeFolder}
          className="shrink-0 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition hover:border-primary/40"
        >
          {source.hasPhotos ? "Change" : "Select"}
        </button>
      )}
    </div>
  );
}
