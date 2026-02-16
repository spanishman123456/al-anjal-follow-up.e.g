import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/** Sort key for class names: grade then section so 6A < 6B, 7A < 7B. */
export function classSortKey(className) {
  if (!className || typeof className !== "string") return [0, ""];
  const m = String(className).trim().match(/^(\d+)([A-Za-z])?$/);
  const grade = m ? parseInt(m[1], 10) : 0;
  const section = (m && m[2]) ? m[2].toUpperCase() : "";
  return [grade, section];
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
