import { displayQuarterNumber } from "./academicScope";

/** Safe slug for class names, grades, report types, etc. */
export function formatDownloadFilePart(value, fallback = "all-classes") {
  const raw = String(value || fallback)
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return raw || fallback;
}

export function semesterNumberFromScope(semester) {
  return semester === "semester2" || Number(semester) === 2 ? 2 : 1;
}

export function sanitizeAcademicYearForFilename(academicYear) {
  return (
    String(academicYear || "unknown-year")
      .trim()
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "unknown-year"
  );
}

/**
 * Build a download filename from the current academic scope shown in the UI.
 * Example: total-marks-2025-2026-semester-2-quarter-4-all-classes.xlsx
 */
export function buildAcademicExportFilename({
  prefix,
  academicYear,
  semester,
  quarter,
  className,
  suffix,
  extraParts = [],
  extension,
}) {
  const semNum = semesterNumberFromScope(semester);
  const dispQuarter = displayQuarterNumber(semester, quarter);
  const parts = [
    prefix,
    sanitizeAcademicYearForFilename(academicYear),
    `semester-${semNum}`,
    `quarter-${dispQuarter}`,
    formatDownloadFilePart(className),
    ...extraParts.map((part) => formatDownloadFilePart(part)).filter(Boolean),
  ];
  if (suffix) {
    parts.push(formatDownloadFilePart(suffix));
  }
  const base = parts.filter(Boolean).join("-");
  if (!extension) return base;
  const ext = String(extension).replace(/^\./, "");
  return `${base}.${ext}`;
}
