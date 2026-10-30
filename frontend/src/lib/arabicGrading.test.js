import {
  calculateArabicQuarter,
  fillArabicScoreColumnWithMaximum,
  formatArabicScore,
  getArabicFieldMaximum,
} from "./arabicGrading";

describe("stage-aware Arabic quarter grading", () => {
  it("doubles the better primary theory attempt and scales the practical to 40", () => {
    const result = calculateArabicQuarter(
      { theory_test_1: 8, theory_test_2: 10, practical_test: 9 },
      10,
    );
    expect(result.bestTheoryRaw).toBe(10);
    expect(result.bestTheoryWeighted).toBe(20);
    expect(result.practicalWeighted).toBe(36);
    expect(result.testsTotal).toBe(56);
  });

  it("weights middle and secondary exams from raw scores out of 20", () => {
    const result = calculateArabicQuarter(
      { theory_test_1: 14, theory_test_2: 17, practical_test: 18 },
      20,
    );
    expect(result.bestTheoryWeighted).toBe(17);
    expect(result.practicalWeighted).toBe(36);
    expect(result.testsTotal).toBe(53);
  });

  it("keeps entered zero distinct from blank and calculates provisionally", () => {
    expect(calculateArabicQuarter({ theory_test_1: 0 }, 15)).toMatchObject({
      bestTheoryRaw: 0,
      bestTheoryWeighted: 0,
      practicalWeighted: null,
      testsTotal: 0,
      quarterTotal: 0,
    });
    expect(calculateArabicQuarter({}, 15).quarterTotal).toBeNull();
    expect(calculateArabicQuarter({ theory_test_1: 6, theory_test_2: null }, 15).bestTheoryRaw).toBe(6);
    expect(formatArabicScore(36)).toBe("36");
    expect(formatArabicScore(17.5)).toBe("17.5");
  });

  it("fills one selected column with each student's correct maximum and preserves all other edits", () => {
    const students = [
      { id: "primary", exam_raw_max: 15 },
      { id: "middle", exam_raw_max: 20 },
    ];
    const source = {
      primary: { participation: 7, theory_test_1: 4 },
      middle: { participation: 8, theory_test_1: null },
    };
    const examsFilled = fillArabicScoreColumnWithMaximum(source, students, "theory_test_1");
    expect(examsFilled).toEqual({
      primary: { participation: 7, theory_test_1: 15 },
      middle: { participation: 8, theory_test_1: 20 },
    });
    const continuousFilled = fillArabicScoreColumnWithMaximum(examsFilled, students, "attendance");
    expect(continuousFilled.primary).toMatchObject({ participation: 7, theory_test_1: 15, attendance: 10 });
    expect(continuousFilled.middle).toMatchObject({ participation: 8, theory_test_1: 20, attendance: 10 });
    expect(getArabicFieldMaximum("practical_test", students[0])).toBe(15);
    expect(getArabicFieldMaximum("performance_tasks", students[1])).toBe(10);
    expect(source.primary.theory_test_1).toBe(4);
  });
});
