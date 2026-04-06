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

export function resolveTermScope(id) {
  return TERM_SCOPES.find((x) => x.id === id) || TERM_SCOPES[0];
}
