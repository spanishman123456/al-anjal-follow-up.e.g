import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/** Sort key for class names: grade then section so 6A < 6B, 7A < 7B. */
export function parseClassNameParts(className) {
  if (!className || typeof className !== "string") return { grade: null, section: "" };
  const normalized = String(className).trim();

  let match = normalized.match(/^(\d+)\s*([A-Za-z])$/);
  if (match) {
    return { grade: parseInt(match[1], 10), section: match[2].toUpperCase() };
  }

  match = normalized.match(/^grade\s*(\d+)(?:\s*([A-Za-z]))?$/i);
  if (match) {
    return {
      grade: parseInt(match[1], 10),
      section: (match[2] || "").toUpperCase(),
    };
  }

  match = normalized.match(/^(\d+)$/);
  if (match) {
    return { grade: parseInt(match[1], 10), section: "" };
  }

  match = normalized.match(/(\d+)/);
  if (match) {
    const sectionMatch = normalized.match(/([A-Za-z])$/);
    return {
      grade: parseInt(match[1], 10),
      section: sectionMatch ? sectionMatch[1].toUpperCase() : "",
    };
  }

  return { grade: null, section: "" };
}

export function classSortKey(className) {
  const parsed = parseClassNameParts(className);
  return [parsed.grade ?? 999, parsed.section || ""];
}

export function getClassGradeValue(classItem) {
  const rawGrade = Number(classItem?.grade);
  if (Number.isFinite(rawGrade) && rawGrade > 0) return rawGrade;
  const name = classItem?.class_name ?? classItem?.name ?? "";
  const parsed = parseClassNameParts(name);
  return parsed.grade;
}

/** Sort a list of items by class name (grade then section). Item can be { class_name } or { name }. */
export function sortByClassOrder(items) {
  if (!Array.isArray(items)) return items;
  return [...items].sort((a, b) => {
    const nameA = a.class_name ?? a.name ?? "";
    const nameB = b.class_name ?? b.name ?? "";
    const [gA, sA] = classSortKey(nameA);
    const [gB, sB] = classSortKey(nameB);
    if (gA !== gB) return gA - gB;
    return (sA || "").localeCompare(sB || "");
  });
}
