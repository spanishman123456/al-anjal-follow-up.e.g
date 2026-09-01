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

- Baseline addition (2026-08-28): `/baseline-scores` under Assessments is **Pre-test Scores / الاختبارات القبلية** for International and **Diagnostic Test Scores / الاختبارات التشخيصية** for Arabic. `/baseline-analytics` under Insights provides overview, individual analysis and report preview. Reuses PageHeader/PageHero, AcademicTermSelect, MetricCard, ChartCard and existing cards/buttons.
- Teachers set up **mark entry**, not a test builder. A title/date/maximum and selected classes define a fixed historical roster. Input accepts Western, Arabic and Persian digits, preserving blank vs zero. Saved results remain visible until edits are saved; transient drafts are in sessionStorage keyed by account and record, and revision conflicts require an explicit reload.
- Baseline maximum input (2026-08-29) uses a `0.00` placeholder, `0.01` minimum/step and two-place formatting on blur (`30` -> `30.00`). New setup rejects excess fractional precision instead of silently rounding the denominator; zero remains invalid. Existing records and all scoring/PDF calculations are unchanged.
- Baseline donut is prominent in overview, individual view and report preview. Horizontal percentage bars, level distribution and class comparisons use server values. PDF uses the same snapshot with vector charts and Amiri; print pagination differs from the responsive screen layout, but results, narratives and chart quantities do not.
- Baseline entry in both sections includes an Edit test details card for the selected record. It edits only the title and snapshot class labels, clearly states that enrollment/marks/maximum/scope are preserved, and uses the same bilingual RTL surface and revision-conflict behavior as mark entry.

- Top horizontal grouped navigation (not left colorful sidebar — removed).
- Academic context bar: year + semester/quarter select + refresh.
- Cards with soft borders; tables share navy-gradient headers, comfortable cells, subtle cyan row hover, RTL/LTR logical alignment, and horizontal scroll wrappers.
- Expandable sections for dense content.
- Sonner toasts for feedback.
- Heavy `data-testid` for critical controls.

## Interaction patterns

- Login has one decorative contact bubble with a direction-independent `gap-3` before the bilingual label. No idle server/database-status row is shown; a localized waiting message appears only after an actual sign-in has been pending for four seconds.
- Gmail first use never enters the application immediately: it shows the bilingual pending-Admin message. In Settings, promotion, role management, Gmail approvals and user management render only after the exact Admin profile is loaded; unknown/non-Admin profiles never receive an optimistic Admin UI. The notification bell is likewise Admin-only, polls every 30 seconds and displays a recent-alert count.
- Confirm dialogs for bulk save / destructive clears.
- Visibility-change refetch on many pages.
- Custom events: `students-updated`, `app-refresh-data`, `auth-logout`, `profile-updated`.
- Mobile: nav sheet; hero stacks; toolbars wrap.
- Main chrome includes a persistent International/Arabic Section pill switcher. The selected section uses a restrained cyan/teal glow and is stored locally; missing legacy state defaults to International.
- Both section Dashboards render the same `DashboardTimetable`/`TimetableEditor` surface in the equivalent bottom section: Sunday–Thursday, eight editable periods, academic-year label, illuminated save action, responsive horizontal scroll, and RTL/LTR labels.
- Priority cards/buttons and active navigation may use subtle cyan illumination, polished hover transitions, and short fade/slide entrances. Respect reduced-motion rules and avoid decorative animation overload.
- Awarding an eligible badge uses the shared local `RewardCelebration` overlay in both sections: a five-second full-screen animation with dense multicolor confetti, falling paper, ribbons, stars, repeated side/center bursts, party-popper cannons, a bilingual student-name banner, badge glow, reduced-motion handling, and no CDN dependency. The International and Arabic student menus both use the same direct toggle: `Badge` awards immediately, and an awarded student's menu changes that action to `Remove badge` with no intermediate reward modal. The generated PDF must not auto-open and steal focus while the animation is playing; a long-lived Open certificate action appears after the celebration. Arabic Student Management shows the same premium badge beside the student's name instead of plain reward text.
- `components/ui/button.jsx` is the shared illuminated interaction language; semantic destructive/success/secondary variants retain their color meaning.
- `components/ui/table.jsx` plus the `main table` normalization in `index.css` is the visual table baseline for both native and shared-table pages.
- The Programs group is available in both sections. Rewards use the active section/year roster, Lesson Plan Generator shows a section-specific template note, and Remedial Plans uses an assessment/class selector, evidence cards, manual report fields, a below-50% candidate table and one PDF export action.

## Bilingual

- All user strings via `i18n.js` keys.
- Arabic-section reward certificates stay Arabic regardless of the global UI language; both the dialog and generated PDF use RTL Arabic copy, while the PDF uses Amiri shaping.
- RTL: `dir` on document + AppShell + PageHero.
- Arabic fonts: Tajawal / Kufam / IBM Plex Sans Arabic (CSS).

## Charts

- Recharts on web; Matplotlib in PDF.
- VisualBoard shared palette for Analytics/Reports consistency.
- Arabic Dashboard and Analytics share the International product's polished card/chart language while aggregating only the selected Arabic quarter `/100`. Arabic Analytics follows the same class-first, then optional-student selection workflow and uses the adopted proportional performance bands rather than neutral score buckets.
- Arabic Analytics now carries the same dense decision-support structure as International Analytics: completion cards, donut distributions, class and student bars, normalized per-test comparison, weighted component contribution, top/support lists, narrative insight rows, and a detailed student table. Student selection remains disabled until one class is selected.
- Arabic Reports deliberately reuses the Arabic Analytics board in report mode, including the class-first/optional-student filters. Its export controls preserve the selected scope, and the generated PDF mirrors the on-screen chart families and explanatory sections instead of falling back to a summary table.
- Score-entry tables use a compact red eraser icon in the Actions column for one-student clearing. Bulk destructive wording always names the selected class; all-classes score-clear buttons are intentionally absent. Blank fill inputs act as a shortcut to the column maximum only after an exact class is selected.
- Analytics/Reports PDFs share `pdf_report_engine.py` cover, KPI, insight, section-heading, table, compact empty-state, and footer components. Charts are emitted only when their dataset is meaningful; long tables repeat headers and Arabic reports embed Amiri with RTL shaping.

## Reuse before inventing

`PageHero`, `AcademicTermSelect`, `PerformanceLevelBadge`, `AssessmentPageFooter`, `ExpandableSection`, analytics `MetricCard`/`ChartCard`/`AnalyticsToolbar`, `components/ui/*`.
