import { AlertCircle, BarChart3, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function DashboardLoading({ message, testId = "dashboard-loading" }) {
  return (
    <div
      className="flex min-h-[280px] flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border/70 bg-muted/20 px-6 py-16"
      data-testid={testId}
    >
      <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

export function DashboardEmpty({
  title,
  description,
  actionLabel,
  onAction,
  testId = "dashboard-empty",
}) {
  return (
    <div
      className="flex min-h-[280px] flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border/70 bg-muted/15 px-6 py-16 text-center"
      data-testid={testId}
    >
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <BarChart3 className="h-6 w-6" aria-hidden />
      </span>
      <div className="max-w-md space-y-1">
        <p className="font-semibold text-foreground">{title}</p>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actionLabel && onAction ? (
        <Button variant="outline" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}

export function DashboardError({ title, description, onRetry, retryLabel, testId = "dashboard-error" }) {
  return (
    <div
      className={cn(
        "flex min-h-[240px] flex-col items-center justify-center gap-4 rounded-2xl border border-destructive/30 bg-destructive/5 px-6 py-12 text-center",
      )}
      data-testid={testId}
    >
      <AlertCircle className="h-8 w-8 text-destructive" aria-hidden />
      <div className="max-w-md space-y-1">
        <p className="font-semibold text-foreground">{title}</p>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {onRetry && retryLabel ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}
