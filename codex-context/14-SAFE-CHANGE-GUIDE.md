# 14 — Safe Change Guide

## Low risk

- i18n string copy (both EN+AR).
- PageHero descriptions / eyebrow text via `pageHeroConfig` + i18n.
- CSS spacing/colors that do not alter contrast on performance badges incorrectly.
- Favicon/manifest assets.
- Documentation under `codex-context/`.

## Medium risk

- New UI sections reusing existing APIs.
- Nav label/order in `navigationConfig.js` (keep routes).
- Chart cosmetics (not data mapping).
- Lesson plan prompt/mapping tweaks.
- Notification filter UI.

## High risk

- Any function named `compute_cumulative_*` or performance threshold constants.
- Bulk score save / import Excel mapping.
- Auth JWT, `auth_version`, Google approval.
- Destructive Admin endpoints (delete all classes/students/weeks/scores, reset-all-passwords).
- PDF Arabic font registration and shaping. Reward certificates are a known legacy exception and must be checked separately before claiming Arabic PDF parity.
- Global term state wiring.
- Teacher `assigned_class_ids` filtering.
- Promotion logic.
- Mongo schema field renames.

## Protected behaviors

1. Quarter total /50 and on-level thresholds.
2. S2 display as Q3/Q4.
3. Term sync across header and pages.
4. Arabic PDF readability.
5. Pending Gmail users stay inactive until approved.
6. Weekly `attendance` remains a score field unless product explicitly changes.

## Known exceptions to verify explicitly

- **Reward certificates:** currently use Helvetica/direct ReportLab canvas text rather than the Amiri + reshaper/bidi pipeline. Arabic names and award text are not protected until this path is upgraded.
- **Academic calendar:** calendar seed data is hardcoded to 1447H / 2025–2026 even when the frontend displays a later dynamically derived academic year.

## Suggested test matrix after high-risk edits

- Login Admin + Teacher
- Change term globally → Students/Analytics/Reports agree
- Enter scores /15 → /30 → /50 path
- Export Analytics PDF with Arabic names
- Teacher scoped class visibility
