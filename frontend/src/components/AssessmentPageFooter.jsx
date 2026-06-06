import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useTranslations } from "@/lib/i18n";
import { sortByClassOrder } from "@/lib/utils";

/**
 * Footer for assessment, quizzes, chapter marks, and final exams pages.
 * Shows the number of students in each class for transparency and context.
 */
export function AssessmentPageFooter({ language }) {
  const t = useTranslations(language);
  const [classSummary, setClassSummary] = useState([]);

  const fetchSummary = () => {
    api
      .get("/classes/summary")
      .then((res) => {
        if (Array.isArray(res?.data)) setClassSummary(res.data);
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchSummary();
    const onStudentsUpdated = () => fetchSummary();
    window.addEventListener("students-updated", onStudentsUpdated);
    return () => window.removeEventListener("students-updated", onStudentsUpdated);
  }, []);

  if (!classSummary.length) return null;

  return (
    <footer
      className="assessment-students-per-class-footer mt-8 rounded-xl border px-4 py-3 shadow-sm"
      data-testid="assessment-page-footer"
    >
      <p className="assessment-students-per-class-title text-xs font-medium mb-2">
        {t("students_per_class")}
      </p>
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        {sortByClassOrder(classSummary).map((cls) => (
          <span
            key={cls.class_id}
            className="assessment-students-per-class-entry"
            data-testid={`footer-class-${cls.class_id}`}
          >
            <span className="font-medium">{cls.class_name}</span>
            <span className="assessment-students-per-class-count ml-1">({cls.student_count})</span>
          </span>
        ))}
      </div>
    </footer>
  );
}
