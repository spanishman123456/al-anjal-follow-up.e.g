import { cn } from "@/lib/utils";

export function ReportSection({
  title,
  description,
  children,
  testId,
  className,
  variant = "default",
}) {
  return (
    <section
      className={cn(
        "report-section rounded-2xl border border-border/60 bg-card shadow-sm print:break-inside-avoid",
        variant === "muted" && "bg-muted/20",
        className,
      )}
      data-testid={testId}
    >
      <header className="border-b border-border/50 px-5 py-4 sm:px-6">
        <h3 className="text-base font-semibold tracking-tight text-foreground">{title}</h3>
        {description ? (
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </header>
      <div className="p-4 sm:p-6">{children}</div>
    </section>
  );
}
