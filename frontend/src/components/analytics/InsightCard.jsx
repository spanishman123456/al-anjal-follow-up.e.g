import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export function InsightPanel({ title, badge, children, testId, className }) {
  return (
    <section
      className={cn(
        "insight-panel overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/[0.08] via-card to-cyan-500/[0.07] shadow-lg",
        className,
      )}
      data-testid={testId}
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-primary/10 px-5 py-4">
        <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
          <Sparkles className="h-4 w-4 text-primary" aria-hidden />
          {title}
        </h2>
        {badge}
      </header>
      <div className="space-y-2.5 p-4 sm:p-5">{children}</div>
    </section>
  );
}

export function InsightRow({ icon: Icon, tone, text, testId }) {
  return (
    <div
      className="rounded-2xl border border-border/50 bg-background/80 px-4 py-3 text-sm shadow-sm backdrop-blur-sm transition-all duration-smooth hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
      data-testid={testId}
    >
      <p className="flex items-start gap-2.5">
        {Icon ? <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", tone)} aria-hidden /> : null}
        <span className="leading-relaxed text-foreground/90">{text}</span>
      </p>
    </div>
  );
}
