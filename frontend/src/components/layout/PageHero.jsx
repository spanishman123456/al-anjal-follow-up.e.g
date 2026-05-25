import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Wide premium page banner — shared visual standard for the whole app.
 * Supports LTR/RTL via the `dir` attribute on the section.
 */
export function PageHero({
  eyebrow,
  title,
  description,
  badges = [],
  actions,
  children,
  className,
  testId,
  dir = "ltr",
}) {
  const isRTL = dir === "rtl";
  const badgeList = badges.filter(Boolean);

  return (
    <section
      dir={dir}
      className={cn(
        "page-hero relative overflow-hidden rounded-3xl border border-violet-500/25 bg-gradient-to-br from-[#0D1222] via-[#10162A] to-[#432874] p-6 text-white shadow-2xl sm:p-8",
        className,
      )}
      data-testid={testId}
    >
      <div className="pointer-events-none absolute -top-20 end-0 h-56 w-56 rounded-full bg-cyan-400/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -start-14 h-72 w-72 rounded-full bg-violet-400/20 blur-3xl" />
      <div
        className={cn(
          "relative flex flex-col gap-6",
          "lg:items-end lg:justify-between",
          isRTL ? "lg:flex-row-reverse" : "lg:flex-row",
        )}
      >
        <div className="min-w-0 flex-1 space-y-3 text-start">
          {eyebrow ? (
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-white/70">{eyebrow}</p>
          ) : null}
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">{title}</h1>
          {description ? (
            <p className="max-w-3xl text-sm leading-relaxed text-white/80 sm:text-base">{description}</p>
          ) : null}
          {badgeList.length ? (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {badgeList.map((item, idx) => (
                <Badge
                  key={`${String(item)}-${idx}`}
                  variant="secondary"
                  className="rounded-full border border-white/10 bg-white/15 px-3 py-1 text-white hover:bg-white/20"
                >
                  {item}
                </Badge>
              ))}
            </div>
          ) : null}
          {children ? <div className="pt-1">{children}</div> : null}
        </div>
        {actions ? (
          <div
            className={cn(
              "page-hero__actions flex w-full flex-wrap gap-2 sm:gap-3",
              "lg:w-auto lg:shrink-0",
              isRTL ? "lg:justify-start" : "lg:justify-end",
            )}
          >
            {actions}
          </div>
        ) : null}
      </div>
    </section>
  );
}
