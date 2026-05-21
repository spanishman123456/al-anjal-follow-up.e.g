import { cn } from "@/lib/utils";

export function MetricCard({
  label,
  value,
  hint,
  accent = "default",
  testId,
  className,
}) {
  const accentRing =
    accent === "primary"
      ? "ring-2 ring-primary/30 ring-offset-2 ring-offset-background"
      : accent === "success"
        ? "border-emerald-200/80 dark:border-emerald-900/40"
        : "";

  return (
    <div
      className={cn(
        "metric-card rounded-2xl border border-border/60 bg-card p-5 shadow-sm transition-shadow hover:shadow-md",
        accentRing,
        className,
      )}
      data-testid={testId}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-2 text-3xl font-bold tabular-nums tracking-tight",
          accent === "success" && "text-emerald-600 dark:text-emerald-400",
          accent === "primary" && "text-primary",
        )}
        data-testid={testId ? `${testId}-value` : undefined}
      >
        {value}
      </p>
      {hint ? <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
