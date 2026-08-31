import { useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { toast } from "sonner";
import { api, getApiErrorMessage, BULK_SAVE_TIMEOUT_MS } from "@/lib/api";
import { useTranslations } from "@/lib/i18n";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AssessmentPageFooter } from "@/components/AssessmentPageFooter";
import { buildAcademicExportFilename } from "@/lib/exportFilenames";
import { sortByClassOrder } from "@/lib/utils";
import { PerformanceLevelBadge } from "@/components/PerformanceLevelBadge";
import { ScoreSheetImportControl } from "@/components/ScoreSheetImportControl";
import { StudentScoreClearButton } from "@/components/StudentScoreClearButton";

const formatScore = (value, suffix = "") => {
  if (value === null || value === undefined) {
    return "—";
  }
  return `${value}${suffix}`;
};

function parseApiSubtotal(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

const parseScore = (value) => {
  if (value === "" || value === null || value === undefined) {
    return null;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

// Students-page total = attendance (2.5) + participation (2.5) + behavior (5) + homework (5), max 15.
const STUDENTS_TOTAL_MAX = 15;
function computeStudentsTotal(student) {
  const a = Number(student?.attendance) || 0;
  const p = Number(student?.participation) || 0;
  const b = Number(student?.behavior) || 0;
  const h = Number(student?.homework) || 0;
  return Math.min(STUDENTS_TOTAL_MAX, Math.round((a + p + b + h) * 100) / 100);
}

// 2nd quarter assessment total = best of Quiz 3 or Quiz 4 (5) + Chapter Test 2 Practical (10), max 15.
const ASSESSMENT_TOTAL_MAX = 15;
function computeAssessmentTotal(student) {
  const q3 = Number(student?.quiz3) ?? 0;
  const q4 = Number(student?.quiz4) ?? 0;
  const pt = Number(student?.chapter_test2_practical) ?? 0;
  const bestQuiz = Math.max(Number.isNaN(q3) ? 0 : q3, Number.isNaN(q4) ? 0 : q4);
  const sum = (Number.isNaN(pt) ? 0 : pt) + bestQuiz;
  return Math.min(ASSESSMENT_TOTAL_MAX, Math.round(sum * 100) / 100);
}

function computeWeeklySubtotalQ2(baseStudent) {
  const avgWeeks10_18 = baseStudent?.avg_weeks_10_18;
  if (avgWeeks10_18 != null && !Number.isNaN(Number(avgWeeks10_18))) {
    return Math.min(STUDENTS_TOTAL_MAX, Math.round(Number(avgWeeks10_18) * 100) / 100);
  }
  return computeStudentsTotal(baseStudent);
}

// Combined total (2nd quarter) = weekly part (max 15) + best(Quiz 3, Quiz 4) + Chapter Test 2 (max 15), total max 30.
const COMBINED_TOTAL_MAX = 30;
function computeCombinedTotal(baseStudent, currentStudent = baseStudent) {
  const studentsTotal = computeWeeklySubtotalQ2(baseStudent);
  const assessmentTotal = computeAssessmentTotal(currentStudent);
  return Math.min(COMBINED_TOTAL_MAX, Math.round((studentsTotal + assessmentTotal) * 100) / 100);
}

function computeAssessmentPerformanceLevel(baseStudent, currentStudent = baseStudent) {
  const total = computeCombinedTotal(baseStudent, currentStudent);
  const hasAvg1018 =
    baseStudent?.avg_weeks_10_18 != null && !Number.isNaN(Number(baseStudent.avg_weeks_10_18));
  const hasStudents =
    hasAvg1018 ||
    [baseStudent?.attendance, baseStudent?.participation, baseStudent?.behavior, baseStudent?.homework].some(
      (v) => v != null && v !== "" && !Number.isNaN(Number(v))
    );
  const hasAssessment = [currentStudent?.quiz3, currentStudent?.quiz4, currentStudent?.chapter_test2_practical].some(
    (v) => v != null && v !== "" && !Number.isNaN(Number(v))
  );
  if (!hasStudents && !hasAssessment) return "no_data";
  if (total >= 25) return "on_level";
  if (total >= 20) return "approach";
  return "below";
}

export default function AssessmentMarksQ2() {
  const { language, semester, quarter, academicYear, profile, classes: contextClasses, classesLoaded } = useOutletContext();
  const t = useTranslations(language);
  const isTeacher = profile?.role_name === "Teacher";
  const semesterNumber = semester === "semester2" ? 2 : 1;
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [weeks, setWeeks] = useState([]);
  const [activeWeekId, setActiveWeekId] = useState("");
  const [filterClass, setFilterClass] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [performanceFilter, setPerformanceFilter] = useState("all");
  const [scoreMin, setScoreMin] = useState("");
  const [scoreMax, setScoreMax] = useState("");
  const [bulkEditMode, setBulkEditMode] = useState(false);
  const [bulkScores, setBulkScores] = useState({});
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [clearScoresOpen, setClearScoresOpen] = useState(false);
  const [fillValues, setFillValues] = useState({ quiz3: "", quiz4: "", chapter_test2_practical: "" });
  const latestLoadRequestIdRef = useRef(0);

  const loadData = async (weekId = activeWeekId) => {
    const requestId = ++latestLoadRequestIdRef.current;
    try {
      const needClassesFromApi = !(classesLoaded && contextClasses?.length);
      const [studentRes, classRes] = await Promise.all([
        api.get("/students", { params: weekId ? { week_id: weekId } : {} }),
        needClassesFromApi
          ? api.get("/classes").catch(() => ({ data: null }))
          : Promise.resolve({ data: null }),
      ]);
      if (latestLoadRequestIdRef.current !== requestId) return;
      setStudents(studentRes.data || []);
      if (needClassesFromApi) {
        const classesFromApi = classRes?.data;
        if (classesFromApi?.length) setClasses(classesFromApi);
        else setClasses(contextClasses || []);
      } else {
        setClasses(contextClasses || []);
      }
    } catch (error) {
      if (latestLoadRequestIdRef.current !== requestId) return;
      toast.error(getApiErrorMessage(error) || "Failed to load data");
    }
  };

  const loadWeeks = async () => {
    try {
      const response = await api.get("/weeks", {
        params: { semester: semesterNumber, quarter },
      });
      setWeeks(response.data || []);
      // Do not set activeWeekId here; let useEffect([weeks]) restore from sessionStorage so both pages stay in sync
    } catch (error) {
      toast.error(getApiErrorMessage(error) || "Failed to load weeks");
    }
  };

  useEffect(() => {
    setWeeks([]);
    setActiveWeekId("");
    loadWeeks();
  }, [semesterNumber, quarter]);

  useEffect(() => {
    if (!activeWeekId || !weeks.length) return;
    if (!weeks.some((w) => w.id === activeWeekId)) return;
    setBulkEditMode(false);
    setBulkScores({});
    loadData(activeWeekId);
  }, [activeWeekId, weeks]);

  useEffect(() => {
    if (!weeks.length) return;
    if (weeks.find((w) => w.id === activeWeekId)) return;
    const key = `app_selected_week_id_s${semesterNumber}_q${quarter}`;
    const saved = sessionStorage.getItem(key);
    if (saved && weeks.some((w) => w.id === saved)) setActiveWeekId(saved);
    else setActiveWeekId(weeks[0]?.id || "");
  }, [weeks, semesterNumber, quarter]);

  useEffect(() => {
    if (!classes?.length) return;
    const key = `app_selected_class_id_s${semesterNumber}_q${quarter}`;
    const saved = sessionStorage.getItem(key);
    if (saved === "all" || classes.some((c) => c.id === saved)) setFilterClass(saved || "all");
  }, [classes, semesterNumber, quarter]);

  const filteredStudents = useMemo(() => {
    const minValue = scoreMin ? Number(scoreMin) : null;
    const maxValue = scoreMax ? Number(scoreMax) : null;
    return students.filter((student) => {
      if (filterClass !== "all" && student.class_id !== filterClass) return false;
      if (searchTerm && !student.full_name?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      const totalScore = computeCombinedTotal(student);
      const perfLevel = computeAssessmentPerformanceLevel(student);
      if (performanceFilter !== "all" && perfLevel !== performanceFilter) return false;
      if (minValue !== null && totalScore < minValue) return false;
      if (maxValue !== null && totalScore > maxValue) return false;
      return true;
    });
  }, [students, filterClass, searchTerm, performanceFilter, scoreMin, scoreMax]);

  const resetFilters = () => {
    sessionStorage.setItem(`app_selected_class_id_s${semesterNumber}_q${quarter}`, "all");
    setFilterClass("all");
    setSearchTerm("");
    setPerformanceFilter("all");
    setScoreMin("");
    setScoreMax("");
  };

  const startBulkEdit = () => {
    setBulkScores({});
    setBulkEditMode(true);
  };

  const updateBulkScore = (studentId, field, value) => {
    setBulkScores((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], [field]: value },
    }));
  };

  const handleScoreChange = (studentId, field, value, max) => {
    if (value === "" || value === null || value === undefined) {
      updateBulkScore(studentId, field, value);
      return;
    }
    const num = Number(value);
    if (!Number.isNaN(num) && num > max) {
      updateBulkScore(studentId, field, String(max));
      toast.warning(t("marks_exceeded").replace(/{max}/g, String(max)));
      return;
    }
    updateBulkScore(studentId, field, value);
  };

  const saveScoreOnBlur = async (student, field, newVal) => {
    const origVal = parseScore(student[field]);
    if (newVal === origVal) return;
    if (!activeWeekId) {
      toast.error(t("select_week_before_import") || "Please select a week first.");
      return;
    }
    try {
      await api.post("/students/bulk-scores", {
        updates: [{ id: student.id, [field]: newVal }],
        week_id: activeWeekId,
      }, { timeout: BULK_SAVE_TIMEOUT_MS });
      setBulkScores((prev) => {
        const next = { ...prev };
        delete next[student.id];
        return next;
      });
      window.dispatchEvent(new CustomEvent("students-updated"));
      loadData(activeWeekId);
      toast.success(t("student_updated"));
    } catch (error) {
      toast.error(getApiErrorMessage(error) || t("student_update_failed"));
    }
  };

  const handleQuiz3Blur = async (student) => {
    const current = bulkScores[student.id] || student;
    await saveScoreOnBlur(student, "quiz3", parseScore(current.quiz3));
  };

  const handleQuiz4Blur = async (student) => {
    const current = bulkScores[student.id] || student;
    await saveScoreOnBlur(student, "quiz4", parseScore(current.quiz4));
  };

  const handleChapterTest2Blur = async (student) => {
    const current = bulkScores[student.id] || student;
    await saveScoreOnBlur(student, "chapter_test2_practical", parseScore(current.chapter_test2_practical));
  };

  const handleFillColumn = (field, max) => {
    if (filterClass === "all") {
      toast.error(t("select_class_to_clear_scores"));
      return;
    }
    const raw = fillValues[field];
    const resolvedRaw = raw === "" || raw === null || raw === undefined ? String(max) : raw;
    const num = Number(resolvedRaw);
    if (Number.isNaN(num) || num < 0) {
      toast.error(t("enter_valid_value") || "Enter a valid number");
      return;
    }
    const value = num > max ? String(max) : resolvedRaw;
    if (num > max) toast.warning(t("marks_exceeded").replace(/{max}/g, String(max)));
    setBulkEditMode(true);
    setBulkScores((prev) => {
      const next = { ...prev };
      filteredStudents.forEach((s) => {
        next[s.id] = { ...next[s.id], [field]: value };
      });
      return next;
    });
    toast.success(t("fill_applied") || "Value applied to all students in this column");
  };

  const openBulkSaveConfirm = () => {
    if (!activeWeekId) {
      toast.error(t("select_week_before_import") || "Please select a week first.");
      return;
    }
    setBulkConfirmOpen(true);
  };

  const handleBulkSave = async () => {
    if (!activeWeekId) {
      toast.error(t("select_week_before_import") || "Please select a week first.");
      return;
    }
    try {
      const updates = students.flatMap((student) => {
        const pending = bulkScores[student.id];
        if (!pending) return [];
        const current = { ...student, ...pending };
        return [{
          id: student.id,
          quiz3: parseScore(current.quiz3),
          quiz4: parseScore(current.quiz4),
          chapter_test2_practical: parseScore(current.chapter_test2_practical),
        }];
      });
      if (!updates.length) {
        toast.info("No score changes to save.");
        return;
      }
      await api.post("/students/bulk-scores", { updates, week_id: activeWeekId }, { timeout: BULK_SAVE_TIMEOUT_MS });
      toast.success(t("student_updated"));
      setBulkEditMode(false);
      setBulkConfirmOpen(false);
      window.dispatchEvent(new CustomEvent("students-updated"));
      loadData(activeWeekId);
    } catch (error) {
      toast.error(getApiErrorMessage(error) || t("student_update_failed"));
    }
  };

  const handleClearScores = async () => {
    setClearScoresOpen(false);
    if (!activeWeekId) {
      toast.error(t("select_week_before_import") || "Please select a week first.");
      return;
    }
    if (filterClass === "all") {
      toast.error(t("select_class_to_clear_scores") || "Please select a class first. Clear scores only affects the selected class.");
      return;
    }
    // Clear only 2nd quarter assessment fields for the selected class for this week.
    const studentsToClear = students.filter((s) => s.class_id === filterClass);
    const updates = studentsToClear.map((student) => ({
      id: student.id,
      quiz3: null,
      quiz4: null,
      chapter_test2_practical: null,
    }));
    if (!updates.length) {
      toast.error(t("no_students_in_class") || "No students in the selected class.");
      return;
    }
    try {
      await api.post("/students/bulk-scores", { updates, week_id: activeWeekId }, { timeout: BULK_SAVE_TIMEOUT_MS });
      setBulkEditMode(false);
      setBulkScores({});
      toast.success(t("scores_cleared"));
      window.dispatchEvent(new CustomEvent("students-updated"));
      loadData(activeWeekId);
    } catch (error) {
      toast.error(getApiErrorMessage(error) || t("student_update_failed"));
    }
  };

  const handleClearStudentScores = async (student) => {
    if (!activeWeekId) {
      toast.error(t("select_week_before_import") || "Please select a week first.");
      return;
    }
    if (!window.confirm(t("clear_student_scores_confirm").replace("{student}", student.full_name || ""))) return;
    const updates = [{
      id: student.id,
      quiz3: null,
      quiz4: null,
      chapter_test2_practical: null,
    }];
    try {
      await api.post("/students/bulk-scores", { updates, week_id: activeWeekId }, { timeout: BULK_SAVE_TIMEOUT_MS });
      setBulkScores((prev) => {
        const next = { ...prev };
        delete next[student.id];
        return next;
      });
      toast.success(t("student_scores_cleared"));
      window.dispatchEvent(new CustomEvent("students-updated"));
      loadData(activeWeekId);
    } catch (error) {
      toast.error(getApiErrorMessage(error) || t("student_update_failed"));
    }
  };

  const activeWeek = weeks.find((w) => w.id === activeWeekId);
  const selectedClassName =
    filterClass === "all"
      ? (t("all_classes") || "all-classes")
      : (classes.find((cls) => cls.id === filterClass)?.name || filterClass);

  const handleDownloadMarks = async () => {
    try {
      const response = await api.get("/students/export", {
        params: {
          week_id: activeWeekId || undefined,
          class_id: filterClass !== "all" ? filterClass : undefined,
          view: "assessment_q2",
        },
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        buildAcademicExportFilename({
          prefix: "chapter-tests-and-quizzes",
          academicYear,
          semester,
          quarter,
          className: selectedClassName,
          extension: "xlsx",
        })
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(t("export_success"));
    } catch (error) {
      toast.error(error?.response?.data?.detail || t("export_failed"));
    }
  };

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible" && activeWeekId) loadData(activeWeekId);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [activeWeekId]);

  return (
    <div className="space-y-8" data-testid="assessment-q2-marks-q2-page">
      <PageHeader
        pageKey="assessment_marks_q2"
        testIdPrefix="assessment-marks-q2"
        action={
          <div className="flex flex-wrap gap-2">
            <Button onClick={openBulkSaveConfirm} data-testid="assessment-q2-bulk-save">
              {t("save_all_scores")}
            </Button>
            {bulkEditMode ? (
              <Button variant="outline" onClick={() => setBulkEditMode(false)} data-testid="assessment-q2-bulk-cancel">
                {t("cancel")}
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={startBulkEdit} data-testid="assessment-q2-edit-scores">
                  {t("edit_scores")}
                </Button>
                <Button variant="outline" onClick={() => setClearScoresOpen(true)} disabled={filterClass === "all"} data-testid="assessment-q2-clear-scores">
                  {t("clear_selected_class_scores")}
                </Button>
              </>
            )}
          </div>
        }
      />

      <Card data-testid="assessment-q2-bulk-import-card">
        <CardContent className="space-y-3 pt-6">
          <div className="flex flex-wrap items-end justify-end gap-3">
          <ScoreSheetImportControl
            t={t}
            endpoint="/score-sheet/import"
            params={{ context: "international_quiz", week_id: activeWeekId || undefined, academic_year: academicYear, semester: semesterNumber, quarter, class_id: filterClass !== "all" ? filterClass : undefined }}
            targets={[
              { value: "quiz3", label: `${t("quiz3")} (5)` },
              { value: "quiz4", label: `${t("quiz4")} (5)` },
            ]}
            disabled={!activeWeekId || bulkEditMode}
            onImported={() => {
              sessionStorage.setItem(`app_selected_week_id_s${semesterNumber}_q${quarter}`, activeWeekId);
              window.dispatchEvent(new CustomEvent("students-updated"));
              loadData(activeWeekId);
            }}
            testIdPrefix="assessment-q2-score-import"
          />
          <Button
            variant="secondary"
            onClick={handleDownloadMarks}
            data-testid="assessment-q2-download-marks"
          >
            {t("score_sheet_export_excel")}
          </Button>
          </div>
          <p className="text-sm text-muted-foreground">{t("score_sheet_attempt_hint")}</p>
          {bulkEditMode && <p className="text-sm text-amber-600">{t("score_sheet_save_first")}</p>}
        </CardContent>
      </Card>

      <Card data-testid="assessment-q2-filter-card">
        <CardContent className="grid gap-4 pt-6 md:grid-cols-2 xl:grid-cols-6">
          <Input
            placeholder={t("search_students")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            data-testid="assessment-q2-search"
          />
          <Select
            value={filterClass}
            onValueChange={(value) => {
              sessionStorage.setItem(`app_selected_class_id_s${semesterNumber}_q${quarter}`, value);
              setFilterClass(value);
            }}
            data-testid="assessment-q2-class-filter"
          >
            <SelectTrigger data-testid="assessment-q2-class-filter-trigger">
              <SelectValue placeholder={t("select_class")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("all_classes")}</SelectItem>
              {sortByClassOrder(classes).map((cls) => (
                <SelectItem key={cls.id} value={cls.id}>
                  {cls.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={performanceFilter} onValueChange={setPerformanceFilter} data-testid="assessment-q2-performance-filter">
            <SelectTrigger>
              <SelectValue placeholder={t("performance_filter")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("performance_filter")}</SelectItem>
              <SelectItem value="on_level">{t("on_level")}</SelectItem>
              <SelectItem value="approach">{t("approach")}</SelectItem>
              <SelectItem value="below">{t("below")}</SelectItem>
            </SelectContent>
          </Select>
          <Input placeholder={t("min_score")} value={scoreMin} onChange={(e) => setScoreMin(e.target.value)} />
          <Input placeholder={t("max_score")} value={scoreMax} onChange={(e) => setScoreMax(e.target.value)} />
          <Button variant="outline" onClick={resetFilters} data-testid="assessment-q2-reset-filters">
            {t("reset_filters")}
          </Button>
        </CardContent>
      </Card>

      <Card data-testid="assessment-q2-table-card">
        <CardContent className="pt-6">
          <Table data-testid="assessment-q2-marks-table">
            <TableHeader>
              <TableRow>
                <TableHead>{t("student_name")}</TableHead>
                <TableHead>{t("class_name")}</TableHead>
                <TableHead className="text-center">{t("quiz3")} (5)</TableHead>
                <TableHead className="text-center">{t("quiz4")} (5)</TableHead>
                <TableHead className="text-center">{t("chapter_test2_practical")} (10)</TableHead>
                <TableHead className="text-center" title={t("total_score_tooltip_q2")}>
                  {t("total_score")}
                </TableHead>
                <TableHead className="text-center">{t("performance_level")}</TableHead>
                <TableHead className="text-center">{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="bg-muted/50" data-testid="assessment-q2-fill-row">
                <TableCell colSpan={2} className="text-muted-foreground text-sm py-2">
                  {t("fill_column")}:
                </TableCell>
                <TableCell className="text-center py-2">
                  <div className="flex items-center justify-center gap-1">
                    <Input
                      type="number"
                      min={0}
                      max={5}
                      step={0.5}
                      className="score-table-input-5-fill"
                      aria-label={t("quiz3")}
                      value={fillValues.quiz3}
                      onChange={(e) => setFillValues((prev) => ({ ...prev, quiz3: e.target.value }))}
                      data-testid="assessment-q2-fill-quiz3"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 shrink-0"
                      onClick={() => handleFillColumn("quiz3", 5)}
                      data-testid="assessment-q2-fill-quiz3-btn"
                    >
                      {t("fill_column")}
                    </Button>
                  </div>
                </TableCell>
                <TableCell className="text-center py-2">
                  <div className="flex items-center justify-center gap-1">
                    <Input
                      type="number"
                      min={0}
                      max={5}
                      step={0.5}
                      className="score-table-input-5-fill"
                      aria-label={t("quiz4")}
                      value={fillValues.quiz4}
                      onChange={(e) => setFillValues((prev) => ({ ...prev, quiz4: e.target.value }))}
                      data-testid="assessment-q2-fill-quiz4"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 shrink-0"
                      onClick={() => handleFillColumn("quiz4", 5)}
                      data-testid="assessment-q2-fill-quiz4-btn"
                    >
                      {t("fill_column")}
                    </Button>
                  </div>
                </TableCell>
                <TableCell className="text-center py-2">
                  <div className="flex items-center justify-center gap-1">
                    <Input
                      type="number"
                      min={0}
                      max={10}
                      step={0.5}
                      className="score-table-input-10-fill"
                      aria-label={t("chapter_test2_practical")}
                      value={fillValues.chapter_test2_practical}
                      onChange={(e) => setFillValues((prev) => ({ ...prev, chapter_test2_practical: e.target.value }))}
                      data-testid="assessment-q2-fill-practical"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 shrink-0"
                      onClick={() => handleFillColumn("chapter_test2_practical", 10)}
                      data-testid="assessment-q2-fill-practical-btn"
                    >
                      {t("fill_column")}
                    </Button>
                  </div>
                </TableCell>
                <TableCell colSpan={3} />
              </TableRow>
              {filteredStudents.length ? (
                filteredStudents.map((student) => {
                  const current = bulkScores[student.id] || student;
                  const hasPendingChanges = Boolean(
                    bulkScores[student.id] && Object.keys(bulkScores[student.id]).length
                  );
                  let weeklyPart = computeWeeklySubtotalQ2(student);
                  let marksPart = computeAssessmentTotal(current);
                  if (!bulkEditMode && !hasPendingChanges) {
                    const ws = parseApiSubtotal(student.assessment_q2_weekly_subtotal);
                    const ms = parseApiSubtotal(student.assessment_q2_marks_subtotal);
                    if (ws != null && ms != null) {
                      weeklyPart = Math.min(STUDENTS_TOTAL_MAX, ws);
                      marksPart = Math.min(ASSESSMENT_TOTAL_MAX, ms);
                    }
                  }
                  const total =
                    !bulkEditMode && !hasPendingChanges
                      ? student.assessment_q2_combined_total != null &&
                        !Number.isNaN(Number(student.assessment_q2_combined_total))
                        ? Number(student.assessment_q2_combined_total)
                        : student.assessment_q2_performance_level === "no_data"
                          ? 0
                          : computeCombinedTotal(student, current)
                      : computeCombinedTotal(student, current);
                  const perfLevel =
                    !bulkEditMode && !hasPendingChanges && student.assessment_q2_performance_level
                      ? student.assessment_q2_performance_level
                      : computeAssessmentPerformanceLevel(student, current);
                  const partsLine = t("combined_total_parts")
                    .replace("{weekly}", String(weeklyPart))
                    .replace("{marks}", String(marksPart));
                  return (
                    <TableRow key={student.id} data-testid={`assessment-row-${student.id}`}>
                      <TableCell>{student.full_name}</TableCell>
                      <TableCell>{student.class_name}</TableCell>
                      <TableCell className="text-center">
                        <Input
                          type="number"
                          min={0}
                          max={5}
                          step={0.5}
                          className="score-table-input-5"
                          value={current.quiz3 ?? ""}
                          onChange={(e) => handleScoreChange(student.id, "quiz3", e.target.value, 5)}
                          onBlur={() => handleQuiz3Blur(student)}
                          aria-label={t("quiz3")}
                          data-testid={`assessment-quiz3-${student.id}`}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Input
                          type="number"
                          min={0}
                          max={5}
                          step={0.5}
                          className="score-table-input-5"
                          value={current.quiz4 ?? ""}
                          onChange={(e) => handleScoreChange(student.id, "quiz4", e.target.value, 5)}
                          onBlur={() => handleQuiz4Blur(student)}
                          aria-label={t("quiz4")}
                          data-testid={`assessment-quiz4-${student.id}`}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Input
                          type="number"
                          min={0}
                          max={10}
                          step={0.5}
                          className="score-table-input-10"
                          value={current.chapter_test2_practical ?? ""}
                          onChange={(e) => handleScoreChange(student.id, "chapter_test2_practical", e.target.value, 10)}
                          onBlur={() => handleChapterTest2Blur(student)}
                          aria-label={t("chapter_test2_practical")}
                          data-testid={`assessment-practical-${student.id}`}
                        />
                      </TableCell>
                      <TableCell
                        className="text-center"
                        data-testid={`assessment-total-${student.id}`}
                        title={t("total_score_tooltip_q2")}
                      >
                        <div className="font-semibold tabular-nums">{formatScore(total, "/30")}</div>
                        <div className="mt-0.5 text-[10px] leading-tight text-muted-foreground tabular-nums">{partsLine}</div>
                      </TableCell>
                      <TableCell className="text-center">
                        <PerformanceLevelBadge
                          variant="outline"
                          level={perfLevel}
                          label={t(perfLevel)}
                          data-testid={`assessment-perf-${student.id}`}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <StudentScoreClearButton
                          t={t}
                          studentName={student.full_name}
                          onClear={() => handleClearStudentScores(student)}
                          testId={`assessment-q2-clear-student-${student.id}`}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    {t("no_data")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={bulkConfirmOpen} onOpenChange={setBulkConfirmOpen}>
        <DialogContent data-testid="assessment-q2-bulk-confirm-dialog">
          <DialogHeader>
            <DialogTitle>{t("save_all_scores")}</DialogTitle>
            <DialogDescription>{t("save_changes")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkConfirmOpen(false)}>
              {t("cancel")}
            </Button>
            <Button variant="success" onClick={handleBulkSave} data-testid="assessment-q2-bulk-confirm">
              {t("save_changes")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={clearScoresOpen} onOpenChange={setClearScoresOpen}>
        <DialogContent data-testid="assessment-q2-clear-dialog">
          <DialogHeader>
            <DialogTitle>{t("clear_selected_class_scores")}</DialogTitle>
            <DialogDescription>{t("clear_selected_class_scores_confirm")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClearScoresOpen(false)}>
              {t("cancel")}
            </Button>
            <Button variant="destructive" onClick={handleClearScores} data-testid="assessment-q2-clear-confirm">
              {t("clear_selected_class_scores")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AssessmentPageFooter language={language} />
    </div>
  );
}
