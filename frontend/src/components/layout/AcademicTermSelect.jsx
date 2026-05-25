import { useOutletContext } from "react-router-dom";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslations } from "@/lib/i18n";
import { TERM_SCOPES, applyTermScopeId, termScopeIdFromOutlet } from "@/lib/academicScope";
import { cn } from "@/lib/utils";

/**
 * Global semester/quarter picker — always reads and writes App-level state via outlet context.
 */
export function AcademicTermSelect({
  triggerClassName,
  testIdPrefix = "term-scope",
  disabled = false,
}) {
  const { language, semester, quarter, setSemester, setQuarter } = useOutletContext();
  const t = useTranslations(language);
  const value = termScopeIdFromOutlet(semester, quarter);

  return (
    <Select
      value={value}
      disabled={disabled}
      onValueChange={(id) => applyTermScopeId(id, setSemester, setQuarter)}
    >
      <SelectTrigger
        className={cn("w-full min-w-[12rem] sm:w-48", triggerClassName)}
        data-testid={`${testIdPrefix}-trigger`}
      >
        <SelectValue placeholder={t("select_semester_quarter")} />
      </SelectTrigger>
      <SelectContent>
        {TERM_SCOPES.map((scope) => (
          <SelectItem
            key={scope.id}
            value={scope.id}
            data-testid={`${testIdPrefix}-${scope.id}`}
          >
            {t(`term_${scope.id}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
