# 07 — UI / UX DNA

## Visual identity (CONFIRMED — current product, not old design_guidelines.json alone)

**Primary chrome / heroes**

- Deep navy: `#0D1222` / `#10162A`
- Purple gradient end: `#432874` / accents `#8B2BEC`
- Magenta accent: `#E91E8F` / `#C626A0` (nav pills)
- Cyan highlight / CTA: `#7ED7F7` / `#06B6D4` / `#38BDF8`
- Performance: emerald / amber / rose / slate

**PageHero** (`PageHero.jsx`): wide rounded-3xl navy→purple banner, uppercase eyebrow, large title, muted description, pill badges, actions on the opposite side; RTL via `dir`.

**Do not** invent a different header style per page — use `PageHeader` + `pageKey` / `pageHeroConfig.js`.

Note: Root `design_guidelines.json` describes an older “EduTrack Pro / Swiss Utility” palette (navy `#1e3a8a`, Manrope). **Current shipping UI** follows Al Mubarmij–inspired navy/purple/cyan. Prefer live components over that JSON when they conflict. (CONFIRMED divergence)

## Layout DNA

- Top horizontal grouped navigation (not left colorful sidebar — removed).
- Academic context bar: year + semester/quarter select + refresh.
- Cards with soft borders; tables share navy-gradient headers, comfortable cells, subtle cyan row hover, RTL/LTR logical alignment, and horizontal scroll wrappers.
- Expandable sections for dense content.
- Sonner toasts for feedback.
- Heavy `data-testid` for critical controls.

## Interaction patterns

- Confirm dialogs for bulk save / destructive clears.
- Visibility-change refetch on many pages.
- Custom events: `students-updated`, `app-refresh-data`, `auth-logout`, `profile-updated`.
- Mobile: nav sheet; hero stacks; toolbars wrap.
- Main chrome includes a persistent International/Arabic Section pill switcher. The selected section uses a restrained cyan/teal glow and is stored locally; missing legacy state defaults to International.
- Priority cards/buttons and active navigation may use subtle cyan illumination, polished hover transitions, and short fade/slide entrances. Respect reduced-motion rules and avoid decorative animation overload.
- `components/ui/button.jsx` is the shared illuminated interaction language; semantic destructive/success/secondary variants retain their color meaning.
- `components/ui/table.jsx` plus the `main table` normalization in `index.css` is the visual table baseline for both native and shared-table pages.

## Bilingual

- All user strings via `i18n.js` keys.
- RTL: `dir` on document + AppShell + PageHero.
- Arabic fonts: Tajawal / Kufam / IBM Plex Sans Arabic (CSS).

## Charts

- Recharts on web; Matplotlib in PDF.
- VisualBoard shared palette for Analytics/Reports consistency.
- Arabic Dashboard and Analytics share the International product's polished card/chart language while aggregating only the selected Arabic quarter `/100`. Their distribution uses neutral 10-point score ranges, not performance classifications; support remains an explicit unconfigured state until Arabic thresholds are approved.
- Analytics/Reports PDFs share `pdf_report_engine.py` cover, KPI, insight, section-heading, table, compact empty-state, and footer components. Charts are emitted only when their dataset is meaningful; long tables repeat headers and Arabic reports embed Amiri with RTL shaping.

## Reuse before inventing

`PageHero`, `AcademicTermSelect`, `PerformanceLevelBadge`, `AssessmentPageFooter`, `ExpandableSection`, analytics `MetricCard`/`ChartCard`/`AnalyticsToolbar`, `components/ui/*`.
