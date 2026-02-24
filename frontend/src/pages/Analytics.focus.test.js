/**
 * Quick test for Analytics Focus insight: no "lowest vs leading" when classes are tied.
 * Logic mirrors frontend/src/pages/Analytics.jsx aiInsightRows Focus row.
 */
function getFocusInsight(classSummary) {
  const classesWithAvg = [...classSummary].filter((c) => c.avg_total_score != null);
  const byAscendingAvg = [...classesWithAvg].sort(
    (a, b) => (a.avg_total_score ?? 999) - (b.avg_total_score ?? 999)
  );
  const weakestClass = byAscendingAvg[0] ?? null;
  const strongestClass = byAscendingAvg.length > 0 ? byAscendingAvg[byAscendingAvg.length - 1] : null;
  const weakestAvg = Number(weakestClass?.avg_total_score ?? 0);
  const strongestAvg = Number(strongestClass?.avg_total_score ?? 0);
  const hasContrast =
    weakestClass &&
    strongestClass &&
    weakestClass.class_id !== strongestClass.class_id &&
    weakestAvg < strongestAvg;

  if (hasContrast) {
    return `Focus: ${weakestClass.class_name} is currently the lowest average class, while ${strongestClass.class_name} leads the cohort.`;
  }
  if (classesWithAvg.length) {
    return "Focus: Class averages are currently tied or only one class has data; more scored records will show a clear lowest vs leading contrast.";
  }
  return "Focus: Class-level contrast insight will appear once class averages are available.";
}

describe("Analytics Focus insight", () => {
  it("does not show lowest vs leading when 4A and 8B have the same average (tied)", () => {
    const classSummary = [
      { class_id: 1, class_name: "4A", avg_total_score: 10 },
      { class_id: 2, class_name: "8B", avg_total_score: 10 },
    ];
    const text = getFocusInsight(classSummary);
    expect(text).not.toMatch(/4A is currently the lowest.*8B leads/);
    expect(text).toMatch(/tied or only one class/);
  });

  it("shows lowest vs leading when two classes have different averages", () => {
    const classSummary = [
      { class_id: 1, class_name: "4A", avg_total_score: 8 },
      { class_id: 2, class_name: "8B", avg_total_score: 12 },
    ];
    const text = getFocusInsight(classSummary);
    expect(text).toMatch(/4A is currently the lowest average class.*8B leads the cohort/);
  });

  it("shows tied message when only one class has data", () => {
    const classSummary = [{ class_id: 1, class_name: "4A", avg_total_score: 10 }];
    const text = getFocusInsight(classSummary);
    expect(text).toMatch(/tied or only one class/);
  });

  it("shows placeholder when no class averages", () => {
    const text = getFocusInsight([]);
    expect(text).toMatch(/once class averages are available/);
  });
});
