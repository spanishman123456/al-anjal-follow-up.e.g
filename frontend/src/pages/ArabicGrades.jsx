import { useCallback, useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Download, Save, TestTube2 } from "lucide-react";
import { toast } from "sonner";
import { api, getLocalizedApiErrorMessage } from "@/lib/api";
import { displayQuarterNumber } from "@/lib/academicScope";
import {
  ARABIC_CONTINUOUS_FIELDS,
  ARABIC_EXAM_FIELDS,
  ARABIC_SCORE_FIELDS,
  calculateArabicQuarter,
  formatArabicScore,
} from "@/lib/arabicGrading";
import { useTranslations } from "@/lib/i18n";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScoreSheetImportControl } from "@/components/ScoreSheetImportControl";
import { LoadErrorCard } from "@/components/LoadErrorCard";

const semesterNumber = (semester) => (semester === "semester2" ? 2 : 1);

export default function ArabicGrades() {
  const { language, semester, quarter, academicYear, classes = [], schoolSection } = useOutletContext();
  const t = useTranslations(language);
  const [classId, setClassId] = useState("all");
  const [payload, setPayload] = useState(null);
  const [values, setValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const sem = semesterNumber(semester);
  const displayQuarter = displayQuarterNumber(semester, quarter);

  const loadGrades = useCallback(async () => {
    if (schoolSection !== "arabic") return;
    setLoading(true);
    setLoadError("");
    try {
      const response = await api.get("/arabic/grades", {
        params: {
          academic_year: academicYear,
          semester: sem,
          quarter,
          class_id: classId === "all" ? undefined : classId,
        },
      });
      const next = response.data;
      setPayload(next);
      setValues(
        Object.fromEntries(
          (next.students || []).map((student) => [
            student.id,
            Object.fromEntries(ARABIC_SCORE_FIELDS.map(({ key }) => [key, student[key] ?? null])),
          ]),
        ),
      );
    } catch (error) {
      const message = getLocalizedApiErrorMessage(error, t);
      setPayload(null);
      setValues({});
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [academicYear, classId, quarter, schoolSection, sem, t]);

  useEffect(() => {
    loadGrades();
  }, [loadGrades]);

  useEffect(() => {
    const refresh = () => loadGrades();
    window.addEventListener("app-refresh-data", refresh);
    return () => window.removeEventListener("app-refresh-data", refresh);
  }, [loadGrades]);

  const rows = payload?.students || [];
  const hasUnsavedChanges = useMemo(
    () => rows.some((student) => ARABIC_SCORE_FIELDS.some(({ key }) => {
      const saved = student[key] === undefined ? null : student[key];
      const edited = values[student.id]?.[key] === undefined ? null : values[student.id][key];
      return saved !== edited;
    })),
    [rows, values],
  );
  const metrics = useMemo(
    () => [
      [t("total_students"), payload?.total_students ?? 0],
      [t("students_with_grades"), payload?.students_with_grades ?? 0],
      [t("students_without_grades"), payload?.students_without_grades ?? 0],
      [t("completion_percentage"), `${payload?.completion_percentage ?? 0}%`],
    ],
    [payload, t],
  );

  const updateValue = (studentId, key, raw, max) => {
    const next = raw === "" ? null : Math.max(0, Math.min(max, Number(raw)));
    setValues((previous) => ({
      ...previous,
      [studentId]: { ...previous[studentId], [key]: Number.isFinite(next) ? next : null },
    }));
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.post("/arabic/grades/bulk", {
        academic_year: academicYear,
        semester: sem,
        quarter,
        updates: rows.map((student) => ({ student_id: student.id, ...values[student.id] })),
      });
      toast.success(t("grades_saved"));
      window.dispatchEvent(new CustomEvent("students-updated"));
      await loadGrades();
    } catch (error) {
      toast.error(error?.response?.data?.detail || t("grades_save_failed"));
    } finally {
      setSaving(false);
    }
  };

  const download = async (format) => {
    try {
      const response = await api.get("/arabic/reports/export", {
        params: {
          academic_year: academicYear,
          semester: sem,
          quarter,
          class_id: classId === "all" ? undefined : classId,
          format,
          lang: language,
        },
        responseType: "blob",
      });
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `arabic-section-${academicYear}-q${displayQuarter}.${format === "excel" ? "xlsx" : "pdf"}`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(t("export_failed"));
    }
  };

  return (
    <div className="space-y-6" data-testid="arabic-grades-page">
      <PageHeader
        title={t("arabic_quarter_grades")}
        eyebrow={`${t("arabic_section")} · ${academicYear} · Q${displayQuarter}`}
        description={t("arabic_grading_description")}
        badges={[`${t("continuous_assessment")} /40`, `${t("tests_total")} /60`, `${t("quarter_total_100")}`]}
        testIdPrefix="arabic-grades"
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => download("pdf")}><Download className="me-2 h-4 w-4" />PDF</Button>
            <Button variant="secondary" onClick={() => download("excel")}><Download className="me-2 h-4 w-4" />Excel</Button>
            <Button onClick={save} disabled={saving || loading || !rows.length} className="active-glow"><Save className="me-2 h-4 w-4" />{t("save_grades")}</Button>
          </div>
        }
      />

      {loadError ? <LoadErrorCard message={loadError} onRetry={loadGrades} t={t} testId="arabic-grades-load-error" /> : <>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 animate-stagger">
        {metrics.map(([label, value]) => (
          <Card key={label} className="premium-active-card card-hover">
            <CardContent className="pt-6"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-bold">{value}</p></CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="gap-4 md:flex-row md:items-center md:justify-between">
          <div><CardTitle>{t("test_completion")}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{t("no_performance_thresholds")}</p></div>
          <Select value={classId} onValueChange={setClassId}>
            <SelectTrigger className="w-full md:w-64" data-testid="arabic-grades-class-filter"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">{t("all_classes")}</SelectItem>{classes.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <Progress value={payload?.completion_percentage || 0} className="h-3" />
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {ARABIC_EXAM_FIELDS.map((key) => {
              const item = payload?.test_completion?.[key] || {};
              return <div key={key} className="rounded-xl border bg-muted/25 p-3"><p className="font-medium">{t(key)}</p><p className="mt-1 text-sm text-emerald-600">{t("tested")}: {item.completed || 0}</p><p className="text-sm text-rose-600">{t("not_tested")}: {item.missing || 0}</p></div>;
            })}
          </div>
          {(payload?.migration?.manual_review_count || 0) > 0 && (
            <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
              <p className="font-semibold">{t("legacy_grades_manual_review")}: {payload.migration.manual_review_count}</p>
              <p className="mt-1">{payload.migration.manual_review_students.map((student) => `${student.full_name} (${student.class_name})`).join(", ")}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card data-testid="arabic-grades-import-card">
        <CardContent className="space-y-3 pt-6">
          <div className="flex flex-wrap items-end justify-end gap-3">
            <ScoreSheetImportControl
              t={t}
              endpoint="/score-sheet/import"
              params={{
                context: "arabic_theory",
                academic_year: academicYear,
                semester: sem,
                quarter,
                class_id: classId === "all" ? undefined : classId,
              }}
              targets={[
                { value: "theory_test_1", label: `${t("theory_test_1")} (${t("raw_score")})` },
                { value: "theory_test_2", label: `${t("theory_test_2")} (${t("raw_score")})` },
              ]}
              disabled={saving || loading || !rows.length || hasUnsavedChanges}
              onImported={async () => {
                window.dispatchEvent(new CustomEvent("students-updated"));
                await loadGrades();
              }}
              testIdPrefix="arabic-grades-score-import"
            />
          </div>
          <p className="text-sm text-muted-foreground">{t("score_sheet_attempt_hint")}</p>
          {hasUnsavedChanges && <p className="text-sm text-amber-600">{t("score_sheet_save_first")}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1540px] text-sm">
              <thead className="bg-[#10162A] text-white"><tr><th className="sticky start-0 z-10 bg-[#10162A] p-3 text-start">{t("student")}</th><th className="p-3 text-start">{t("class")}</th>{ARABIC_CONTINUOUS_FIELDS.map(({ key, max }) => <th key={key} className="p-3 text-center">{t(key)} /{max}</th>)}{ARABIC_EXAM_FIELDS.map((key) => <th key={key} className="p-3 text-center">{t(key)} ({t("raw_score")})</th>)}<th className="p-3 text-center">{t("best_theory")} /30</th><th className="p-3 text-center">{t("practical_weighted")} /30</th><th className="p-3 text-center">/40</th><th className="p-3 text-center">/60</th><th className="p-3 text-center">/100</th></tr></thead>
              <tbody>
                {rows.map((student) => {
                  const current = values[student.id] || {};
                  const calculated = calculateArabicQuarter(current, student.exam_raw_max);
                  return <tr key={student.id} className="border-b transition-colors hover:bg-cyan-50/50 dark:hover:bg-cyan-950/10"><td className="sticky start-0 bg-background p-3 font-semibold">{student.full_name}</td><td className="p-3"><p>{student.class_name}</p><p className="text-xs text-muted-foreground">{t(student.educational_stage)} · /{student.exam_raw_max}</p></td>{ARABIC_CONTINUOUS_FIELDS.map(({ key, max }) => <td key={key} className="p-2"><Input type="number" min="0" max={max} step="0.5" value={current[key] ?? ""} onChange={(event) => updateValue(student.id, key, event.target.value, max)} aria-label={`${student.full_name} ${t(key)}`} /></td>)}{ARABIC_EXAM_FIELDS.map((key) => <td key={key} className="p-2"><div className="flex items-center gap-1"><Input type="number" min="0" max={student.exam_raw_max} step="0.5" value={current[key] ?? ""} onChange={(event) => updateValue(student.id, key, event.target.value, student.exam_raw_max)} className={current[key] !== null && current[key] !== undefined ? "border-emerald-400/60 shadow-[0_0_12px_rgba(16,185,129,0.12)]" : ""} aria-label={`${student.full_name} ${t(key)}`} /><span className="text-xs text-muted-foreground">/{student.exam_raw_max}</span></div></td>)}<td className="p-3 text-center font-semibold">{formatArabicScore(calculated.bestTheoryWeighted)}</td><td className="p-3 text-center font-semibold">{formatArabicScore(calculated.practicalWeighted)}</td><td className="p-3 text-center font-semibold">{formatArabicScore(calculated.continuousTotal)}</td><td className="p-3 text-center font-semibold">{formatArabicScore(calculated.testsTotal)}</td><td className="p-3 text-center text-lg font-bold text-cyan-700 dark:text-cyan-300">{formatArabicScore(calculated.quarterTotal)}</td></tr>;
                })}
              </tbody>
            </table>
          </div>
          {!loading && !rows.length && <div className="p-10 text-center text-muted-foreground"><TestTube2 className="mx-auto mb-3 h-8 w-8" />{t("no_data")}</div>}
        </CardContent>
      </Card>
      </>}
    </div>
  );
}
