/**
 * Centralized performance-level styling (backend keys: on_level, approach, below, no_data).
 * Green = on level, amber = approach, red = below, slate = no data.
 */

export const PERFORMANCE_LEVELS = ["on_level", "approach", "below", "no_data"];

/** Chart / Recharts fill colors */
export const PERFORMANCE_CHART_COLORS = {
  on_level: "#10b981",
  approach: "#f59e0b",
  below: "#ef4444",
  no_data: "#94a3b8",
};

/** Filled pill badges */
export const performanceBadgeClasses = {
  on_level:
    "border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  approach:
    "border-transparent bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  below:
    "border-transparent bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
  no_data:
    "border-transparent bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

/** Outlined badges (assessment tables) */
export const performanceBadgeOutlineClasses = {
  on_level:
    "border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-700/50 dark:bg-emerald-950/30 dark:text-emerald-300",
  approach:
    "border-amber-300 bg-amber-100 text-amber-700 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-300",
  below:
    "border-rose-300 bg-rose-100 text-rose-700 dark:border-rose-700/50 dark:bg-rose-950/30 dark:text-rose-300",
  no_data:
    "border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-400",
};

/** Text-only accents (metrics, poppers, legends) */
export const performanceTextClasses = {
  on_level: "text-emerald-600 dark:text-emerald-400",
  approach: "text-amber-600 dark:text-amber-400",
  below: "text-rose-600 dark:text-rose-400",
  no_data: "text-slate-500 dark:text-slate-400",
};

/** Metric headline numbers on dashboard cards */
export const performanceMetricTextClasses = {
  on_level: "text-emerald-600 dark:text-emerald-400",
  approach: "text-amber-600 dark:text-amber-400",
  below: "text-rose-600 dark:text-rose-400",
  no_data: "text-slate-600 dark:text-slate-400",
};

/** Small distribution stat cells (e.g. class cards) */
export const performanceStatCellClasses = {
  on_level:
    "rounded-md bg-emerald-50 px-2 py-1 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  approach:
    "rounded-md bg-amber-50 px-2 py-1 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  below:
    "rounded-md bg-rose-50 px-2 py-1 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
  no_data:
    "rounded-md bg-slate-100 px-2 py-1 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

/** Legend swatch background (charts key) */
export const performanceLegendSwatchClasses = {
  on_level: "bg-emerald-500",
  approach: "bg-amber-500",
  below: "bg-red-500",
  no_data: "bg-slate-400",
};

/** Inline chips (strengths, weak areas, tags) */
export const performanceChipClasses = {
  on_level:
    "rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  approach:
    "rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  below:
    "rounded-md bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
  no_data:
    "rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

export function normalizePerformanceLevel(level) {
  if (PERFORMANCE_LEVELS.includes(level)) return level;
  return "no_data";
}

export function getPerformanceBadgeClass(level, variant = "filled") {
  const key = normalizePerformanceLevel(level);
  const map =
    variant === "outline" ? performanceBadgeOutlineClasses : performanceBadgeClasses;
  return map[key];
}

export function getPerformanceTextClass(level) {
  return performanceTextClasses[normalizePerformanceLevel(level)];
}

export function getPerformanceChartColor(level) {
  return PERFORMANCE_CHART_COLORS[normalizePerformanceLevel(level)];
}

/** Score band outline badge (normalized to 50-point scale). */
export function getScoreBandBadgeClass(score, max = 50) {
  const value = Number(score);
  if (!Number.isFinite(value)) return performanceBadgeOutlineClasses.no_data;
  const normalized = max === 50 ? value : (value / max) * 50;
  if (normalized >= 46) return performanceBadgeOutlineClasses.on_level;
  if (normalized >= 43) return performanceBadgeOutlineClasses.approach;
  return performanceBadgeOutlineClasses.below;
}
