import { Eraser } from "lucide-react";
import { Button } from "@/components/ui/button";

export function StudentScoreClearButton({
  t,
  studentName,
  onClear,
  disabled = false,
  testId,
}) {
  const label = `${t("clear_student_scores")} — ${studentName || ""}`;
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="border-red-300/70 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-800/70 dark:text-red-300 dark:hover:bg-red-950/40"
      title={label}
      aria-label={label}
      onClick={onClear}
      disabled={disabled}
      data-testid={testId}
    >
      <Eraser className="h-4 w-4" />
    </Button>
  );
}
