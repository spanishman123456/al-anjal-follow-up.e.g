import { PageHero } from "@/components/layout/PageHero";

/**
 * @deprecated Use PageHero from @/components/layout/PageHero — kept for Analytics/Reports imports.
 */
export function DashboardPageHeader({
  title,
  subtitle,
  description,
  metaItems = [],
  actions,
  className,
  testId,
}) {
  const dir =
    typeof document !== "undefined" && document.documentElement.dir === "rtl" ? "rtl" : "ltr";

  return (
    <PageHero
      dir={dir}
      eyebrow={subtitle}
      title={title}
      description={description}
      badges={metaItems}
      actions={actions}
      className={className}
      testId={testId}
    />
  );
}
