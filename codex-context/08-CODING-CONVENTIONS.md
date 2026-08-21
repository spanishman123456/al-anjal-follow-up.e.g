# 08 — Coding Conventions

Extracted from the **actual** codebase (CONFIRMED unless noted).

## Language & modules

- Frontend: JavaScript React (not TypeScript in `src/`).
- Backend: Python 3.13 FastAPI, Pydantic v2 models inline in `server.py`.
- Path alias `@/` on frontend.

## Naming

- Pages: `PascalCase.jsx` under `pages/`.
- Components: `PascalCase.jsx`.
- Libs: `camelCase.js`.
- API routes: kebab-ish paths under `/api/...`.
- Test ids: `data-testid="area-action"` strings everywhere.

## Frontend patterns

- Functional components; default export pages.
- `useOutletContext()` for global academic/auth chrome state.
- Lazy routes + `routePreloaders.js`.
- Duplicate **Q1 and Q2 page files** rather than one parameterized page (CONFIRMED) — when changing assessment UX, update both or extract carefully.
- Score helper functions often **copied per page** (tech debt) — prefer shared extraction only when asked or when fixing bugs across pages.

## Backend patterns

- Monolithic `server.py` with helpers + routes.
- `logger` for errors.
- HTTPException for API errors.
- PDF generation returns `bytes`; StreamingResponse/FileResponse at endpoints.
- Lazy Mongo: `get_mongo_client()` / `_LazyMongoDB` so imports can work offline.

## State & persistence

- `localStorage`: language, theme, semester, quarter, auth token helpers.
- `sessionStorage`: class cache, selected week/class keys per term.

## Error / UX feedback

- Frontend: `toast` (sonner) + `getApiErrorMessage`.
- 401 → `auth-logout` event.

## Testing

- Backend: pytest files for score calculation, support thresholds, mongo login scripts.
- Frontend: limited Jest tests (`exportFilenames.test.js`, `Analytics.focus.test.js`).
- Many root/backend manual verification scripts.

## Comments

- Arabic/English mix in comments; scoring rules often documented above helpers — **trust those comments and keep them accurate when changing math**.
