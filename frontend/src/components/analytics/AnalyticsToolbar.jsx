import { cn } from "@/lib/utils";

/** Groups filter controls and export actions for analytics/report headers. */
export function AnalyticsToolbar({ filters, actions, className, testId }) {
  return (
    <div
      className={cn(
        "analytics-toolbar flex w-full flex-col gap-4 rounded-3xl border border-border/60 bg-card/90 p-4 shadow-sm backdrop-blur-sm lg:flex-row lg:items-end lg:justify-between lg:p-5",
        className,
      )}
      data-testid={testId}
    >
      {filters ? (
        <div className="flex min-w-0 flex-1 flex-wrap items-end gap-3">{filters}</div>
      ) : null}
      {actions ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-border/40 pt-3 lg:border-t-0 lg:pt-0">
          {actions}
        </div>
      ) : null}
    </div>
  );
}

export function FilterField({ label, children, className }) {
  return (
    <div className={cn("flex min-w-[190px] flex-col gap-1.5", className)}>
      {label ? (
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
      ) : null}
      {children}
    </div>
  );
}
