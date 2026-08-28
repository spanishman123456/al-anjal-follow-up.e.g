// Input validation only. Saved percentages, levels and narratives come from the API.
export function parseBaselineMark(raw, maximum) {
  if (String(raw ?? "").trim() === "") return null;
  const normalized = String(raw).trim().replace(/[٠-٩]/g, (digit) => digit.charCodeAt(0) - 1632).replace(/[۰-۹]/g, (digit) => digit.charCodeAt(0) - 1776).replace(/٫/g, ".");
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) throw new Error("baseline_invalid_score");
  const score = Number(normalized);
  if (!Number.isFinite(score) || score < 0 || score > maximum) throw new Error("baseline_invalid_score");
  return score;
}

export function changedBaselineMarks(students, values, maximum) {
  return Object.fromEntries(students.flatMap((student) => {
    const value = parseBaselineMark(values[student.id], maximum);
    return value === student.score ? [] : [[student.id, value]];
  }));
}

export const BASELINE_COLORS = { high: "#8B2BEC", medium: "#D97706", support: "#E11D48", missing: "#64748B" };
export const baselinePercent = (value) => value == null ? "—" : `${value}%`;
