import { useOutletContext } from "react-router-dom";
import { useTranslations } from "@/lib/i18n";
import { resolvePageHeroCopy } from "@/lib/pageHeroConfig";
import { PageHero } from "@/components/layout/PageHero";

/**
 * App-wide page header — renders the premium PageHero banner.
 * Pass `pageKey` for default eyebrow/title/description from pageHeroConfig.js.
 */
export function PageHeader({
  title,
  subtitle,
  eyebrow,
  description,
  badges = [],
  action,
  actions,
  pageKey,
  testIdPrefix = "page",
  className,
  children,
}) {
  const { language } = useOutletContext() || {};
  const lang = language || (typeof document !== "undefined" && document.documentElement.lang === "ar" ? "ar" : "en");
  const t = useTranslations(lang);
  const isRTL = lang === "ar";

  const resolved = resolvePageHeroCopy(pageKey, t, {
    title,
    subtitle,
    eyebrow,
    description,
  });

  const heroActions = actions ?? action;

  return (
    <PageHero
      dir={isRTL ? "rtl" : "ltr"}
      eyebrow={resolved.eyebrow}
      title={resolved.title}
      description={resolved.description}
      badges={badges}
      actions={heroActions}
      className={className}
      testId={`${testIdPrefix}-hero`}
    >
      {children}
    </PageHero>
  );
}
