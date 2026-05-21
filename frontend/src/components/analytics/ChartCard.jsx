import { cn } from "@/lib/utils";

export function ChartCard({
  title,
  subtitle,
  summary,
  summaryLabel,
  badge,
  insight,
  children,
  testId,
  className,
  span,
}) {
  const cardTone = badge ? "from-primary/[0.03] via-card to-cyan-500/[0.03]" : "from-card via-card to-muted/25";
  return (
    <article
      className={cn(
        "chart-card flex flex-col overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br shadow-sm transition-all duration-smooth hover:-translate-y-0.5 hover:shadow-xl",
        cardTone,
        span === "full" && "lg:col-span-2",
        span === "hero" && "lg:col-span-3",
        className,
      )}
      data-testid={testId}
    >
      <header className="border-b border-border/50 bg-white/40 px-5 py-4 dark:bg-muted/20">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold tracking-tight text-foreground sm:text-base">{title}</h3>
              {badge}
            </div>
            {subtitle != null && subtitle !== false ? (
              <div className="mt-1 text-xs leading-relaxed text-muted-foreground [&_.inline-flex]:text-foreground sm:text-sm">
                {subtitle}
              </div>
            ) : null}
          </div>
          {summary != null && summary !== "" ? (
            <div className="shrink-0 rounded-2xl border border-primary/20 bg-primary/5 px-3 py-2 text-right dark:bg-primary/10">
              {summaryLabel ? (
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {summaryLabel}
                </p>
              ) : null}
              <p className="text-xl font-bold tabular-nums text-primary">{summary}</p>
            </div>
          ) : null}
        </div>
      </header>
      <div className="flex flex-1 flex-col px-4 py-4 sm:px-6 sm:py-5">{children}</div>
      {insight ? (
        <footer className="border-t border-border/50 bg-muted/20 px-5 py-3 text-xs leading-relaxed text-muted-foreground">
          {insight}
        </footer>
      ) : null}
    </article>
  );
}
