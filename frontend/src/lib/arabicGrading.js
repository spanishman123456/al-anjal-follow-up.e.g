export const ARABIC_CONTINUOUS_FIELDS = [
  { key: "performance_tasks", max: 10 },
  { key: "participation", max: 10 },
  { key: "interaction", max: 10 },
  { key: "attendance", max: 10 },
];

export const ARABIC_EXAM_FIELDS = ["theory_test_1", "theory_test_2", "practical_test"];
export const ARABIC_SCORE_FIELDS = [
  ...ARABIC_CONTINUOUS_FIELDS,
  ...ARABIC_EXAM_FIELDS.map((key) => ({ key, test: true })),
];

export function getArabicFieldMaximum(fieldKey, student) {
  const field = ARABIC_SCORE_FIELDS.find(({ key }) => key === fieldKey);
  if (!field) throw new Error(`Unknown Arabic score field: ${fieldKey}`);
  return field.test ? Number(student?.exam_raw_max) : field.max;
}

export function fillArabicScoreColumnWithMaximum(values, students, fieldKey) {
  const next = { ...(values || {}) };
  for (const student of students || []) {
    next[student.id] = {
      ...(next[student.id] || {}),
      [fieldKey]: getArabicFieldMaximum(fieldKey, student),
    };
  }
  return next;
}

const entered = (value) => value !== null && value !== undefined && value !== "";

export function calculateArabicQuarter(values, examRawMax, derivedContinuousTotal = undefined) {
  const source = values || {};
  const hasDerivedContinuous = entered(derivedContinuousTotal);
  const continuousTotal = hasDerivedContinuous
    ? Number(derivedContinuousTotal)
    : ARABIC_CONTINUOUS_FIELDS.reduce(
        (sum, field) => sum + (entered(source[field.key]) ? Number(source[field.key]) : 0),
        0,
      );
  const theories = [source.theory_test_1, source.theory_test_2]
    .filter(entered)
    .map(Number);
  const bestTheoryRaw = theories.length ? Math.max(...theories) : null;
  const practicalRaw = entered(source.practical_test) ? Number(source.practical_test) : null;
  const bestTheoryWeighted = bestTheoryRaw === null ? null : (bestTheoryRaw / examRawMax) * 30;
  const practicalWeighted = practicalRaw === null ? null : (practicalRaw / examRawMax) * 30;
  const testsTotal = (bestTheoryWeighted ?? 0) + (practicalWeighted ?? 0);
  const hasGrades = hasDerivedContinuous || ARABIC_SCORE_FIELDS.some(({ key }) => entered(source[key]));
  return {
    continuousTotal: hasGrades ? continuousTotal : null,
    bestTheoryRaw,
    bestTheoryWeighted,
    practicalWeighted,
    testsTotal: hasGrades ? testsTotal : null,
    quarterTotal: hasGrades ? continuousTotal + testsTotal : null,
  };
}

export function formatArabicScore(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "—";
  return Number(Number(value).toFixed(1)).toString();
}
