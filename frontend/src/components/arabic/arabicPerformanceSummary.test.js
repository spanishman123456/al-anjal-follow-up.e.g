import { buildArabicPerformanceSummary } from "./arabicPerformanceSummary";

describe("Arabic quarter performance summary", () => {
  const payload = {
    students: [
      { id: "zero", full_name: "Zero", class_name: "4A", has_grades: true, quarter_total: 0 },
      { id: "high", full_name: "High", class_name: "5A", has_grades: true, quarter_total: 92.5 },
      { id: "mid", full_name: "Mid", class_name: "4A", has_grades: true, quarter_total: 50 },
      { id: "blank", full_name: "Blank", class_name: "5A", has_grades: false, quarter_total: null },
    ],
    class_breakdown: [
      { class_id: "4A", class_name: "4A", student_count: 2 },
      { class_id: "5A", class_name: "5A", student_count: 2 },
    ],
    performance_thresholds: null,
  };

  it("includes entered zero and excludes a completely blank quarter", () => {
    const summary = buildArabicPerformanceSummary(payload);
    expect(summary.studentsWithData.map((student) => student.id)).toEqual(["zero", "high", "mid"]);
    expect(summary.distribution[0].count).toBe(1);
    expect(summary.distribution[9].count).toBe(1);
    expect(summary.averageTotal).toBe(47.5);
  });

  it("ranks only students with entered quarter grades", () => {
    const summary = buildArabicPerformanceSummary(payload);
    expect(summary.topStudents.map((student) => student.id)).toEqual(["high", "mid", "zero"]);
  });

  it("uses the scoped API class counts and does not invent support thresholds", () => {
    const summary = buildArabicPerformanceSummary(payload);
    expect(summary.studentsPerClass).toEqual([
      { class_id: "4A", class_name: "4A", count: 2 },
      { class_id: "5A", class_name: "5A", count: 2 },
    ]);
    expect(summary.thresholdsConfigured).toBe(false);
  });
});
