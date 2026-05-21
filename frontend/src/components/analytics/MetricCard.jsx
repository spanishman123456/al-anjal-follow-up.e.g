import { cn } from "@/lib/utils";

export function MetricCard({
  icon: Icon,
  label,
  value,
  delta,
  deltaTone = "neutral",
  status,
  hint,
  accent = "default",
  testId,
  className,
}) {
  const accentRing =
    accent === "primary"
      ? "border-primary/40 bg-primary/[0.04]"
      : accent === "success"
        ? "border-emerald-200/80 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-950/20"
        : accent === "warning"
          ? "border-amber-200/80 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/20"
          : "border-border/60";
  const deltaToneClass =
    deltaTone === "positive"
      ? "text-emerald-600 dark:text-emerald-400"
      : deltaTone === "negative"
        ? "text-rose-600 dark:text-rose-400"
        : "text-muted-foreground";

  return (
    <div
      className={cn(
        "metric-card relative overflow-hidden rounded-3xl border p-5 shadow-sm transition-all duration-smooth hover:-translate-y-0.5 hover:shadow-lg sm:p-6",
        accentRing,
        className,
      )}
      data-testid={testId}
    >
      <div className="pointer-events-none absolute -right-10 -top-12 h-28 w-28 rounded-full bg-primary/10 blur-2xl" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-1 w-full bg-gradient-to-r from-primary/70 via-cyan-500/45 to-emerald-500/55" />
      <div className="relative space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
            {delta ? (
              <p className={cn("text-xs font-medium", deltaToneClass)} data-testid={testId ? `${testId}-delta` : undefined}>
                {delta}
              </p>
            ) : null}
          </div>
          {Icon ? (
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-background/80 text-primary dark:bg-background/40">
              <Icon className="h-4 w-4" aria-hidden />
            </span>
          ) : null}
        </div>
      <p
        className={cn(
          "text-3xl font-bold tabular-nums tracking-tight sm:text-4xl",
          accent === "success" && "text-emerald-600 dark:text-emerald-400",
          accent === "warning" && "text-amber-600 dark:text-amber-400",
          accent === "primary" && "text-primary",
        )}
        data-testid={testId ? `${testId}-value` : undefined}
      >
        {value}
      </p>
        <div className="flex flex-wrap items-center gap-2">
          {hint ? <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p> : null}
          {status ? (
            <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
              {status}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
