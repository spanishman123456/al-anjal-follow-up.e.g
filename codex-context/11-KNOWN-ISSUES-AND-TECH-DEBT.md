# 11 — Known Issues and Tech Debt

## Fragile / high complexity (CONFIRMED)

1. **`server.py` size** — scoring, PDF, auth, CRUD intertwined.
2. **Duplicated score math** on frontend pages vs backend — drift risk.
3. **Q1/Q2 page duplication** — double maintenance.
4. **Week number spillover/remap** helpers — exist to fix bad data; easy to break.
5. **Circular import** risk between `pdf_report_engine` and `server`.
6. **Role permissions lists** stored but not consistently enforced (only Admin/Teacher checks).
7. **Hardcoded calendar** academic year content — must be updated manually and currently trails the frontend academic-year label by one year.
8. **Long-lived JWT** + auth_version bump — multi-device login kicks older session.
9. **Seed/default admin password paths** — production hygiene risk (do not document values).
10. **`design_guidelines.json` vs live UI** — outdated relative to navy/purple heroes.
11. **Reward certificate Arabic rendering** — certificate names/award text are drawn directly with Helvetica in `server.py`, outside the protected Amiri + reshaper/bidi report pipeline; Arabic may render incorrectly.
12. **Academic year/calendar mismatch** — `App.js` derives the current academic year dynamically (currently 2026–2027), while `build_anjal_academic_calendar()` is still hardcoded to 1447H / 2025–2026 dates.
13. **Windows build command portability** — the package `build` script uses POSIX inline environment-variable syntax, so normal `npm run build` fails under Windows `cmd.exe`; the documented PowerShell-equivalent CRACO + postbuild sequence succeeds.
14. **Frontend dependency audit backlog** — `npm ci` currently reports 58 vulnerabilities (12 low, 14 moderate, 30 high, 2 critical). Do not run automatic audit fixes or upgrade packages without explicit approval and regression planning.
15. **Settings collections are split** — general settings use `app_settings`, while weekly report scheduling uses the separate `report_settings` collection; this distinction was missing from the original handoff memory.

## Recent bug themes (from git — CONFIRMED)

- Login flicker / session remount loops.
- Cumulative /50 calculation when marks missing.
- PDF Arabic/layout quality.
- Term desync across UI.
- Support-list threshold mismatches.
- Export filename / display quarter correctness.

## TODOs / PRD drift

`memory/PRD.md` still lists some P0 items (auth enforcement) that are **partially superseded** by JWT + role checks — treat PRD as historical, verify code. (**INFERRED**)

## Workarounds

- Offline PDF test: `backend/scripts/test_pdf_export.py` (no Mongo).
- Render cold starts: frontend warm `/health/live` + optional keep-awake cron.
- Windows production build: set `DISABLE_ESLINT_PLUGIN=true` in PowerShell, run the installed CRACO build, then run `scripts/postbuild-spa.cjs` (full commands in `15-SETUP-AND-RUNBOOK.md`).
- Safe backend baseline excludes MongoDB/login/integration scripts because they require external credentials and may access or mutate live services.

## Do not “clean up” casually

- Unused-looking score fields / Excel aliases may still be needed for import.
- Counselor role — unused routes ≠ safe delete.
