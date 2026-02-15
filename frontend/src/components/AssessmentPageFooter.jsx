import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useTranslations } from "@/lib/i18n";

/**
 * Footer for assessment, quizzes, chapter marks, and final exams pages.
 * Shows the number of students in each class for transparency and context.
 */
export function AssessmentPageFooter({ language }) {
  const t = useTranslations(language);
  const [classSummary, setClassSummary] = useState([]);

  useEffect(() => {
    let cancelled = false;
    api
      .get("/classes/summary")
      .then((res) => {
        if (!cancelled && Array.isArray(res.data)) setClassSummary(res.data);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  if (!classSummary.length) return null;

  return (
    <footer
      className="mt-8 border-t border-border/60 bg-muted/40 px-4 py-3 rounded-b-xl"
      data-testid="assessment-page-footer"
    >
      <p className="text-xs font-medium text-muted-foreground mb-2">
        {t("students_per_class")}
      </p>
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        {classSummary.map((cls) => (
          <span
            key={cls.class_id}
            className="text-foreground/90"
            data-testid={`footer-class-${cls.class_id}`}
          >
            <span className="font-medium">{cls.class_name}</span>
            <span className="text-muted-foreground ml-1">({cls.student_count})</span>
          </span>
        ))}
      </div>
    </footer>
  );
}
