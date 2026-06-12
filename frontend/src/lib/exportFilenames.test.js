import { buildAcademicExportFilename, formatDownloadFilePart } from "./exportFilenames";

describe("exportFilenames", () => {
  test("formatDownloadFilePart sanitizes class labels", () => {
    expect(formatDownloadFilePart("All Classes")).toBe("all-classes");
    expect(formatDownloadFilePart("8A")).toBe("8a");
  });

  test("uses display quarter 4 for semester 2 internal quarter 2", () => {
    expect(
      buildAcademicExportFilename({
        prefix: "total-marks",
        academicYear: "2025-2026",
        semester: "semester2",
        quarter: 2,
        className: "All Classes",
        extension: "xlsx",
      }),
    ).toBe("total-marks-2025-2026-semester-2-quarter-4-all-classes.xlsx");
  });

  test("uses display quarter 2 for semester 1 internal quarter 2", () => {
    expect(
      buildAcademicExportFilename({
        prefix: "total-marks",
        academicYear: "2025-2026",
        semester: "semester1",
        quarter: 2,
        className: "5B",
        suffix: "template",
        extension: "xlsx",
      }),
    ).toBe("total-marks-2025-2026-semester-1-quarter-2-5b-template.xlsx");
  });
});
