import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function DashboardPageHeader({
  title,
  subtitle,
  description,
  metaItems = [],
  actions,
  className,
  testId,
}) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-slate-950 via-slate-900 to-violet-900/90 p-6 text-white shadow-2xl sm:p-8",
        className,
      )}
      data-testid={testId}
    >
      <div className="pointer-events-none absolute -top-20 right-0 h-56 w-56 rounded-full bg-cyan-300/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-14 h-72 w-72 rounded-full bg-violet-300/20 blur-3xl" />
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 space-y-3">
          {subtitle ? (
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-white/70">{subtitle}</p>
          ) : null}
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">{title}</h1>
          {description ? (
            <p className="max-w-3xl text-sm leading-relaxed text-white/80 sm:text-base">{description}</p>
          ) : null}
          {metaItems.length ? (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {metaItems.map((item, idx) => (
                <Badge
                  key={`${item}-${idx}`}
                  variant="secondary"
                  className="rounded-full border-0 bg-white/15 px-3 py-1 text-white hover:bg-white/20"
                >
                  {item}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
        {actions ? (
          <div className="flex w-full flex-wrap gap-2 lg:w-auto lg:justify-end">{actions}</div>
        ) : null}
      </div>
    </section>
  );
}
