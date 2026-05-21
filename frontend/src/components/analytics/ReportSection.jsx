import { cn } from "@/lib/utils";

export function ReportSection({
  title,
  description,
  lead,
  actions,
  children,
  testId,
  className,
  variant = "default",
}) {
  return (
    <section
      className={cn(
        "report-section overflow-hidden rounded-3xl border border-border/60 bg-card shadow-sm print:break-inside-avoid",
        variant === "muted" && "bg-muted/20",
        variant === "accent" && "border-primary/20 bg-primary/[0.03]",
        className,
      )}
      data-testid={testId}
    >
      <header className="border-b border-border/50 bg-muted/25 px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">{title}</h3>
            {description ? (
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
            ) : null}
            {lead ? (
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-foreground/85">{lead}</p>
            ) : null}
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
        </div>
      </header>
      <div className="p-4 sm:p-6">{children}</div>
    </section>
  );
}
