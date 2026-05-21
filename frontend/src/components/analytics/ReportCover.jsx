import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function ReportCover({
  title,
  subtitle,
  organization,
  generatedLabel,
  termLabel,
  gradeLabel,
  reportTypeLabel,
  summary,
  className,
  testId = "report-cover",
}) {
  return (
    <header
      className={cn(
        "report-cover relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-slate-900 via-slate-800 to-primary/90 px-6 py-8 text-white shadow-lg print:rounded-lg print:border print:shadow-none",
        className,
      )}
      data-testid={testId}
    >
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10 blur-2xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-primary/30 blur-3xl"
        aria-hidden
      />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/15">
              <FileText className="h-4 w-4" aria-hidden />
            </span>
            {reportTypeLabel ? (
              <Badge variant="secondary" className="border-0 bg-white/15 text-white hover:bg-white/20">
                {reportTypeLabel}
              </Badge>
            ) : null}
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/70">{subtitle}</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
          </div>
          {organization ? (
            <p className="text-sm font-medium text-white/90">{organization}</p>
          ) : null}
          {summary ? (
            <p className="max-w-2xl text-sm leading-relaxed text-white/80">{summary}</p>
          ) : null}
        </div>
        <dl className="relative grid shrink-0 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-1 lg:text-right">
          {gradeLabel ? (
            <div className="rounded-lg bg-white/10 px-4 py-2.5 backdrop-blur-sm">
              <dt className="text-[10px] font-medium uppercase tracking-wide text-white/60">{gradeLabel}</dt>
              <dd className="mt-0.5 text-lg font-semibold tabular-nums" data-testid={`${testId}-grade`}>
                —
              </dd>
            </div>
          ) : null}
          {termLabel ? (
            <div className="rounded-lg bg-white/10 px-4 py-2.5 backdrop-blur-sm">
              <dt className="text-[10px] font-medium uppercase tracking-wide text-white/60">{termLabel}</dt>
              <dd className="mt-0.5 font-semibold" data-testid={`${testId}-term`}>
                —
              </dd>
            </div>
          ) : null}
          {generatedLabel ? (
            <div className="rounded-lg bg-white/10 px-4 py-2.5 backdrop-blur-sm sm:col-span-2 lg:col-span-1">
              <dt className="text-[10px] font-medium uppercase tracking-wide text-white/60">{generatedLabel}</dt>
              <dd className="mt-0.5 font-medium tabular-nums" data-testid={`${testId}-date`}>
                {new Date().toLocaleDateString()}
              </dd>
            </div>
          ) : null}
        </dl>
      </div>
    </header>
  );
}

/** Variant with explicit meta values (Reports page). */
export function ReportCoverMeta({
  title,
  subtitle,
  organization,
  generatedLabel,
  generatedValue,
  termLabel,
  termValue,
  gradeLabel,
  gradeValue,
  reportTypeLabel,
  summary,
  className,
  testId = "report-cover",
}) {
  return (
    <header
      className={cn(
        "report-cover relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-slate-900 via-slate-800 to-primary/90 px-6 py-8 text-white shadow-lg print:rounded-lg print:border print:shadow-none",
        className,
      )}
      data-testid={testId}
    >
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10 blur-2xl"
        aria-hidden
      />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/15">
              <FileText className="h-4 w-4" aria-hidden />
            </span>
            {reportTypeLabel ? (
              <Badge variant="secondary" className="border-0 bg-white/15 text-white hover:bg-white/20">
                {reportTypeLabel}
              </Badge>
            ) : null}
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/70">{subtitle}</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
          </div>
          {organization ? <p className="text-sm font-medium text-white/90">{organization}</p> : null}
          {summary ? (
            <p className="max-w-2xl text-sm leading-relaxed text-white/80">{summary}</p>
          ) : null}
        </div>
        <dl className="grid shrink-0 gap-3 text-sm sm:grid-cols-3 lg:grid-cols-1 lg:gap-2 lg:text-right">
          {gradeLabel != null ? (
            <div className="rounded-lg bg-white/10 px-4 py-2.5">
              <dt className="text-[10px] font-medium uppercase tracking-wide text-white/60">{gradeLabel}</dt>
              <dd className="mt-0.5 text-lg font-semibold tabular-nums" data-testid={`${testId}-grade`}>
                {gradeValue}
              </dd>
            </div>
          ) : null}
          {termLabel != null ? (
            <div className="rounded-lg bg-white/10 px-4 py-2.5">
              <dt className="text-[10px] font-medium uppercase tracking-wide text-white/60">{termLabel}</dt>
              <dd className="mt-0.5 font-semibold" data-testid={`${testId}-term`}>
                {termValue}
              </dd>
            </div>
          ) : null}
          {generatedLabel != null ? (
            <div className="rounded-lg bg-white/10 px-4 py-2.5">
              <dt className="text-[10px] font-medium uppercase tracking-wide text-white/60">{generatedLabel}</dt>
              <dd className="mt-0.5 font-medium tabular-nums" data-testid={`${testId}-date`}>
                {generatedValue}
              </dd>
            </div>
          ) : null}
        </dl>
      </div>
    </header>
  );
}
