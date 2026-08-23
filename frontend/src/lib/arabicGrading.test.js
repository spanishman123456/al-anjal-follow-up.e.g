import { calculateArabicQuarter, formatArabicScore } from "./arabicGrading";

describe("stage-aware Arabic quarter grading", () => {
  it("weights the best primary theory and one practical", () => {
    const result = calculateArabicQuarter(
      { theory_test_1: 11, theory_test_2: 13, practical_test: 12 },
      15,
    );
    expect(result.bestTheoryRaw).toBe(13);
    expect(result.bestTheoryWeighted).toBe(26);
    expect(result.practicalWeighted).toBe(24);
    expect(result.testsTotal).toBe(50);
  });

  it("weights middle and secondary exams from raw scores out of 20", () => {
    const result = calculateArabicQuarter(
      { theory_test_1: 14, theory_test_2: 17, practical_test: 18 },
      20,
    );
    expect(result.bestTheoryWeighted).toBe(25.5);
    expect(result.practicalWeighted).toBe(27);
    expect(result.testsTotal).toBe(52.5);
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
    expect(formatArabicScore(26)).toBe("26");
    expect(formatArabicScore(25.5)).toBe("25.5");
  });
});
