const SCORE_BIN_SIZE = 10;

const hasActualQuarterData = (student) =>
  student?.has_grades === true && student?.quarter_total !== null && student?.quarter_total !== undefined;

const scoreBinLabel = (index) => {
  const start = index * SCORE_BIN_SIZE;
  const end = index === 9 ? 100 : start + SCORE_BIN_SIZE - 1;
  return `${start}-${end}`;
};

export function buildArabicPerformanceSummary(payload) {
  const studentsWithData = (payload?.students || []).filter(hasActualQuarterData);
  const distribution = Array.from({ length: 10 }, (_, index) => ({
    range: scoreBinLabel(index),
    count: 0,
  }));

  studentsWithData.forEach((student) => {
    const score = Math.min(100, Math.max(0, Number(student.quarter_total)));
    const index = Math.min(Math.floor(score / SCORE_BIN_SIZE), 9);
    distribution[index].count += 1;
  });

  const scoreTotal = studentsWithData.reduce(
    (sum, student) => sum + Number(student.quarter_total),
    0,
  );
  const averageTotal = studentsWithData.length
    ? Math.round((scoreTotal / studentsWithData.length) * 100) / 100
    : null;

  const topStudents = [...studentsWithData]
    .sort((left, right) => {
      const scoreDifference = Number(right.quarter_total) - Number(left.quarter_total);
      return scoreDifference || String(left.full_name || "").localeCompare(String(right.full_name || ""));
    })
    .slice(0, 5);

  const studentsPerClass = (payload?.class_breakdown || []).map((item) => ({
    class_id: item.class_id,
    class_name: item.class_name,
    count: Number(item.student_count || 0),
  }));

  return {
    studentsWithData,
    distribution,
    averageTotal,
    topStudents,
    studentsPerClass,
    thresholdsConfigured: Boolean(payload?.performance_thresholds),
    studentsNeedingSupport: studentsWithData.filter((student) => ["approach", "below"].includes(student.performance_level)),
  };
}
