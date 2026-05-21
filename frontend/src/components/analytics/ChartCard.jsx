import { cn } from "@/lib/utils";

export function ChartCard({
  title,
  subtitle,
  summary,
  summaryLabel,
  insight,
  children,
  testId,
  className,
  span,
}) {
  return (
    <article
      className={cn(
        "chart-card flex flex-col rounded-2xl border border-border/60 bg-card shadow-sm",
        span === "full" && "md:col-span-2",
        className,
      )}
      data-testid={testId}
    >
      <header className="border-b border-border/50 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
            {subtitle != null && subtitle !== false ? (
              <div className="mt-1 text-xs leading-relaxed text-muted-foreground [&_.inline-flex]:text-foreground">
                {subtitle}
              </div>
            ) : null}
          </div>
          {summary != null && summary !== "" ? (
            <div className="shrink-0 rounded-xl bg-primary/5 px-3 py-2 text-right dark:bg-primary/10">
              {summaryLabel ? (
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {summaryLabel}
                </p>
              ) : null}
              <p className="text-lg font-bold tabular-nums text-primary">{summary}</p>
            </div>
          ) : null}
        </div>
      </header>
      <div className="flex flex-1 flex-col px-4 py-4 sm:px-5">{children}</div>
      {insight ? (
        <footer className="border-t border-border/50 px-5 py-3 text-xs leading-relaxed text-muted-foreground">
          {insight}
        </footer>
      ) : null}
    </article>
  );
}
