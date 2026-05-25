/** Four academic terms used for Analytics & Reports (full separation S1Q1–S2Q2). */
export const TERM_SCOPES = [
  { id: "s1q1", semester: 1, quarter: 1 },
  { id: "s1q2", semester: 1, quarter: 2 },
  { id: "s2q1", semester: 2, quarter: 1 },
  { id: "s2q2", semester: 2, quarter: 2 },
];

export function termScopeIdFromOutlet(semester, quarter) {
  const s = semester === "semester2" ? 2 : 1;
  const digits = String(quarter ?? "").replace(/\D/g, "");
  const qNum = digits ? parseInt(digits, 10) : typeof quarter === "number" ? quarter : 1;
  const q = Number(qNum) === 2 ? 2 : 1;
  return `s${s}q${q}`;
}

/** Push a term scope id (s1q1, s2q2, …) into App-level semester + quarter state. */
export function applyTermScopeId(termScopeId, setSemester, setQuarter) {
  const term = resolveTermScope(termScopeId);
  setSemester(term.semester === 2 ? "semester2" : "semester1");
  setQuarter(term.quarter);
}

/** AppShell header value: "semester1-1" | "semester2-2" etc. */
export function semesterQuarterSelectValue(semester, quarter) {
  const sem = semester === "semester2" ? "semester2" : "semester1";
  const q = Number(quarter) === 2 ? 2 : 1;
  return `${sem}-${q}`;
}

export function applySemesterQuarterSelectValue(value, setSemester, setQuarter) {
  const [s, q] = String(value || "").split("-");
  if (s) setSemester(s === "semester2" ? "semester2" : "semester1");
  if (q) setQuarter(parseInt(q, 10) === 2 ? 2 : 1);
}

export function resolveTermScope(id) {
  return TERM_SCOPES.find((x) => x.id === id) || TERM_SCOPES[0];
}

export function displayQuarterNumber(semester, quarter) {
  const semesterNumber = semester === "semester2" ? 2 : Number(semester) === 2 ? 2 : 1;
  const q = Number(quarter) === 2 ? 2 : 1;
  return semesterNumber === 2 ? q + 2 : q;
}

export function displayQuarterLabel(t, semester, quarter) {
  return `${t("quarter")} ${displayQuarterNumber(semester, quarter)}`;
}
