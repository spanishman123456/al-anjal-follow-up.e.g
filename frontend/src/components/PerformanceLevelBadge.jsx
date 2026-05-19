import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  getPerformanceBadgeClass,
  normalizePerformanceLevel,
} from "@/lib/performanceBadges";

/**
 * Color-coded badge for backend performance levels (on_level, approach, below, no_data).
 */
export function PerformanceLevelBadge({
  level,
  label,
  variant = "filled",
  className,
  ...props
}) {
  const resolved = normalizePerformanceLevel(level);
  return (
    <Badge
      variant="outline"
      className={cn(
        "transition-colors duration-200",
        getPerformanceBadgeClass(resolved, variant),
        className,
      )}
      {...props}
    >
      {label}
    </Badge>
  );
}
