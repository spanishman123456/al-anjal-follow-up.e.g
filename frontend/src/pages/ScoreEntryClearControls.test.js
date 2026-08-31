import fs from "fs";
import path from "path";

describe("score-entry pages expose a score-clear control", () => {
  const cases = [
    ["Students.jsx", "clear-scores-button"],
    ["AssessmentMarks.jsx", "assessment-clear-scores"],
    ["AssessmentMarksQ2.jsx", "assessment-q2-clear-scores"],
    ["FinalExamsAssessment.jsx", "final-exams-clear-scores"],
    ["FinalExamsAssessmentQ2.jsx", "final-exams-q2-clear-scores"],
    ["TotalMarks.jsx", "total-marks-clear-scores"],
    ["BaselineAssessments.jsx", "baseline-clear-recorded"],
    ["ArabicGrades.jsx", "arabic-clear-class-grades"],
  ];

  it.each(cases)("keeps a visible clear action in %s", (fileName, testId) => {
    const source = fs.readFileSync(path.join(__dirname, fileName), "utf8");
    expect(source).toContain(`data-testid=\"${testId}\"`);
  });

  it.each([
    "Students.jsx",
    "AssessmentMarks.jsx",
    "AssessmentMarksQ2.jsx",
    "FinalExamsAssessment.jsx",
    "FinalExamsAssessmentQ2.jsx",
    "TotalMarks.jsx",
  ])("removes the all-classes score-clear path from %s", (fileName) => {
    const source = fs.readFileSync(path.join(__dirname, fileName), "utf8");
    expect(source).not.toContain("clear-all-scores");
    expect(source).not.toContain("clear_scores_all_classes");
  });

  it.each([
    "Students.jsx",
    "AssessmentMarks.jsx",
    "AssessmentMarksQ2.jsx",
    "FinalExamsAssessment.jsx",
    "FinalExamsAssessmentQ2.jsx",
    "TotalMarks.jsx",
    "ArabicStudents.jsx",
    "ArabicGrades.jsx",
    "BaselineAssessments.jsx",
  ])("keeps per-student score clearing in %s", (fileName) => {
    const source = fs.readFileSync(path.join(__dirname, fileName), "utf8");
    expect(source).toContain("StudentScoreClearButton");
  });
});

describe("Arabic roster and diagnostic lifecycle controls stay available", () => {
  it.each([
    ["ArabicStudents.jsx", "arabic-students-import"],
    ["ArabicStudents.jsx", "delete-class-students-button"],
    ["Classes.jsx", "delete-class-confirm"],
    ["BaselineAssessments.jsx", "baseline-roster-import"],
    ["BaselineAssessments.jsx", "baseline-delete-record"],
  ])("keeps %s control %s", (fileName, testId) => {
    const source = fs.readFileSync(path.join(__dirname, fileName), "utf8");
    expect(source).toContain(`data-testid="${testId}"`);
  });

  it("removes section-wide class deletion while retaining exact-class deletion", () => {
    const source = fs.readFileSync(path.join(__dirname, "Classes.jsx"), "utf8");
    expect(source).toContain('data-testid="delete-class-confirm"');
    expect(source).not.toContain('data-testid="delete-all-classes-button"');
    expect(source).not.toContain('data-testid="delete-all-classes-confirm"');
  });

  it("keeps Arabic analytics class-first then student selection", () => {
    const source = fs.readFileSync(path.join(__dirname, "ArabicAnalytics.jsx"), "utf8");
    expect(source).toContain('data-testid="arabic-analytics-class"');
    expect(source).toContain('data-testid="arabic-analytics-student"');
    expect(source).toContain('disabled={selectedClassId === "all"}');
  });
});
