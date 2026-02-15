import { useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { toast } from "sonner";
import { api, getApiErrorMessage, BULK_SAVE_TIMEOUT_MS } from "@/lib/api";
import { useTranslations } from "@/lib/i18n";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

const levelStyles = {
  on_level: "bg-emerald-100 text-emerald-700",
  approach: "bg-amber-100 text-amber-700",
  below: "bg-rose-100 text-rose-700",
  no_data: "bg-slate-100 text-slate-600",
};

const formatScore = (value, suffix = "") => {
  if (value === null || value === undefined) return "—";
  return `${value}${suffix}`;
};

const parseScore = (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const STUDENTS_TOTAL_MAX = 15;
const ASSESSMENT_TOTAL_MAX = 15;
const QUARTER_PRACTICAL_MAX = 10;
const QUARTER_THEORY_MAX = 10;
const FINAL_TOTAL_MAX = 50; // Assessment (30) + Quarter Practical (10) + Quarter Theory (10)

function computeStudentsTotal(student) {
  const a = Number(student?.attendance) || 0;
  const p = Number(student?.participation) || 0;
  const b = Number(student?.behavior) || 0;
  const h = Number(student?.homework) || 0;
  return Math.min(STUDENTS_TOTAL_MAX, Math.round((a + p + b + h) * 100) / 100);
}

function computeAssessmentTotal(student) {
  const q1 = Number(student?.quiz1) ?? 0;
  const q2 = Number(student?.quiz2) ?? 0;
  const pt = Number(student?.chapter_test1_practical) ?? 0;
  const bestQuiz = Math.max(Number.isNaN(q1) ? 0 : q1, Number.isNaN(q2) ? 0 : q2);
  const sum = (Number.isNaN(pt) ? 0 : pt) + bestQuiz;
  return Math.min(ASSESSMENT_TOTAL_MAX, Math.round(sum * 100) / 100);
}

// Assessment Marks total (avg first 9 weeks + best quiz + chapter test), max 30.
function computeAssessmentPartTotal(baseStudent, currentStudent = baseStudent) {
  const avgFirst9 = baseStudent?.avg_first_9_weeks;
  const studentsTotal =
    avgFirst9 != null && !Number.isNaN(Number(avgFirst9))
      ? Math.min(STUDENTS_TOTAL_MAX, Math.round(Number(avgFirst9) * 100) / 100)
      : computeStudentsTotal(baseStudent);
  const assessmentTotal = computeAssessmentTotal(currentStudent);
  return Math.min(30, Math.round((studentsTotal + assessmentTotal) * 100) / 100);
}

// Final total = Assessment part (30) + Quarter Practical (10) + Quarter Theory (10) = 50.
function computeFinalTotal(baseStudent, currentStudent = baseStudent) {
  const assessmentPart = computeAssessmentPartTotal(baseStudent, baseStudent);
  const qp = Number(currentStudent?.quarter1_practical) ?? 0;
  const qt = Number(currentStudent?.quarter1_theory) ?? 0;
  const quarterSum = (Number.isNaN(qp) ? 0 : qp) + (Number.isNaN(qt) ? 0 : qt);
  const quarterCapped = Math.min(QUARTER_PRACTICAL_MAX + QUARTER_THEORY_MAX, Math.round(quarterSum * 100) / 100);
  return Math.min(FINAL_TOTAL_MAX, Math.round((assessmentPart + quarterCapped) * 100) / 100);
}

function computeFinalPerformanceLevel(baseStudent, currentStudent = baseStudent) {
  const total = computeFinalTotal(baseStudent, currentStudent);
  const hasAssessment =
    baseStudent?.avg_first_9_weeks != null ||
    [baseStudent?.quiz1, baseStudent?.quiz2, baseStudent?.chapter_test1_practical].some(
      (v) => v != null && v !== "" && !Number.isNaN(Number(v))
    );
  const hasQuarter = [currentStudent?.quarter1_practical, currentStudent?.quarter1_theory].some(
    (v) => v != null && v !== "" && !Number.isNaN(Number(v))
  );
  if (!hasAssessment && !hasQuarter) return "no_data";
  if (total >= 42) return "on_level";
  if (total >= 35) return "approach";
  return "below";
}

export default function FinalExamsAssessment() {
  const { language, semester, profile } = useOutletContext();
  const t = useTranslations(language);
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
  const [fillValues, setFillValues] = useState({ quarter1_practical: "", quarter1_theory: "" });
  const bulkFileInputRef = useRef(null);

  const loadData = async (weekId = activeWeekId) => {
    try {
      const [studentsRes, classesRes] = await Promise.all([
        api.get("/students", { params: weekId ? { week_id: weekId } : {} }),
        api.get("/classes"),
      ]);
      setStudents(studentsRes.data);
      setClasses(classesRes.data || []);
    } catch (error) {
      toast.error(getApiErrorMessage(error) || "Failed to load data");
    }
  };

  const loadWeeks = async () => {
    try {
      const response = await api.get("/weeks", {
        params: { semester: semester === "semester2" ? 2 : 1 },
      });
      setWeeks(response.data || []);
    } catch (error) {
      toast.error(getApiErrorMessage(error) || "Failed to load weeks");
    }
  };

  useEffect(() => { loadWeeks(); }, [semester]);
  useEffect(() => {
    if (activeWeekId) {
      setBulkEditMode(false);
      setBulkScores({});
      loadData(activeWeekId);
    }
  }, [activeWeekId]);
  useEffect(() => {
    if (!weeks.length) return;
    if (weeks.find((w) => w.id === activeWeekId)) return;
    const saved = sessionStorage.getItem("app_selected_week_id");
    if (saved && weeks.some((w) => w.id === saved)) setActiveWeekId(saved);
    else setActiveWeekId(weeks[0]?.id || "");
  }, [weeks]);
  useEffect(() => {
    if (!classes?.length) return;
    const saved = sessionStorage.getItem("app_selected_class_id");
    if (saved === "all" || classes.some((c) => c.id === saved)) setFilterClass(saved || "all");
  }, [classes]);

  const filteredStudents = useMemo(() => {
    const minValue = scoreMin ? Number(scoreMin) : null;
    const maxValue = scoreMax ? Number(scoreMax) : null;
    return students.filter((student) => {
      if (filterClass !== "all" && student.class_id !== filterClass) return false;
      if (searchTerm && !student.full_name?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      const totalScore = computeFinalTotal(student);
      const perfLevel = computeFinalPerformanceLevel(student);
      if (performanceFilter !== "all" && perfLevel !== performanceFilter) return false;
      if (minValue !== null && totalScore < minValue) return false;
      if (maxValue !== null && totalScore > maxValue) return false;
      return true;
    });
  }, [students, filterClass, searchTerm, performanceFilter, scoreMin, scoreMax]);

  const resetFilters = () => {
    sessionStorage.setItem("app_selected_class_id", "all");
    setFilterClass("all");
    setSearchTerm("");
    setPerformanceFilter("all");
    setScoreMin("");
    setScoreMax("");
  };

  const startBulkEdit = () => { setBulkScores({}); setBulkEditMode(true); };

  const updateBulkScore = (studentId, field, value) => {
    setBulkScores((prev) => ({ ...prev, [studentId]: { ...prev[studentId], [field]: value } }));
  };

  const handleScoreChange = (studentId, field, value, max) => {
    if (value === "" || value === null || value === undefined) {
      updateBulkScore(studentId, field, value);
      return;
    }
    const num = Number(value);
    if (!Number.isNaN(num) && num > max) {
      updateBulkScore(studentId, field, String(max));
      toast.warning(t("marks_exceeded")?.replace(/{max}/g, String(max)) || `Max is ${max}`);
      return;
    }
    updateBulkScore(studentId, field, value);
  };

  const handleFillColumn = (field, max) => {
    const raw = fillValues[field];
    if (raw === "" || raw == null) {
      toast.error(t("enter_value_to_fill") || "Enter a value to fill");
      return;
    }
    const num = Number(raw);
    if (Number.isNaN(num) || num < 0) {
      toast.error(t("enter_valid_value") || "Enter a valid number");
      return;
    }
    const value = num > max ? String(max) : raw;
    if (num > max) toast.warning(t("marks_exceeded")?.replace(/{max}/g, String(max)));
    setBulkEditMode(true);
    setBulkScores((prev) => {
      const next = { ...prev };
      filteredStudents.forEach((s) => { next[s.id] = { ...next[s.id], [field]: value }; });
      return next;
    });
    toast.success(t("fill_applied") || "Value applied");
  };

  const handleBulkSave = async () => {
    try {
      const updates = filteredStudents.map((student) => {
        const current = bulkScores[student.id] || student;
        return {
          id: student.id,
          quarter1_practical: parseScore(current.quarter1_practical),
          quarter1_theory: parseScore(current.quarter1_theory),
        };
      });
      await api.post("/students/bulk-scores", { updates, week_id: activeWeekId || undefined }, { timeout: BULK_SAVE_TIMEOUT_MS });
      toast.success(t("student_updated"));
      setBulkEditMode(false);
      setBulkConfirmOpen(false);
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
    const updates = students.map((student) => ({
      id: student.id,
      quarter1_practical: null,
      quarter1_theory: null,
    }));
    try {
      await api.post("/students/bulk-scores", { updates, week_id: activeWeekId }, { timeout: BULK_SAVE_TIMEOUT_MS });
      await loadData(activeWeekId);
      setBulkEditMode(false);
      setBulkScores({});
      toast.success(t("scores_cleared"));
    } catch (error) {
      toast.error(getApiErrorMessage(error) || t("student_update_failed"));
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await api.get("/students/import-template", {
        params: {
          week_id: activeWeekId || undefined,
          class_id: filterClass !== "all" ? filterClass : undefined,
          view: "final_exams",
        },
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "final_exams_assessment_template.xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(t("export_success"));
    } catch (error) {
      toast.error(error?.response?.data?.detail || t("export_failed"));
    }
  };

  const activeWeek = weeks.find((w) => w.id === activeWeekId);
  const handleDownloadMarks = async () => {
    try {
      const response = await api.get("/students/export", {
        params: {
          week_id: activeWeekId || undefined,
          class_id: filterClass !== "all" ? filterClass : undefined,
          view: "final_exams",
        },
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `final-exams-assessment${activeWeek?.number ? `-week-${activeWeek.number}` : ""}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(t("export_success"));
    } catch (error) {
      toast.error(error?.response?.data?.detail || t("export_failed"));
    }
  };

  const handleBulkImport = async (fileOverride) => {
    if (!fileOverride) {
      toast.error(t("please_select_file") || "Please select a file first");
      return;
    }
    if (!activeWeekId) {
      toast.error(t("select_week_before_import") || "Please select a week before importing.");
      return;
    }
    const formData = new FormData();
    formData.append("file", fileOverride);
    try {
      await api.post("/import/excel", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        params: { week_id: activeWeekId },
      });
      toast.success(t("bulk_import_completed") || "Bulk import completed");
      sessionStorage.setItem("app_selected_week_id", activeWeekId);
      if (bulkFileInputRef.current) bulkFileInputRef.current.value = "";
      loadData(activeWeekId);
    } catch (error) {
      toast.error(error?.response?.data?.detail || t("bulk_import_failed") || "Bulk import failed");
    }
  };

  return (
    <div className="space-y-8" data-testid="final-exams-assessment-page">
      <PageHeader
        title={t("final_exams_assessment")}
        subtitle={t("overview")}
        testIdPrefix="final-exams-assessment"
        action={
          <div className="flex flex-wrap gap-2">
            {bulkEditMode ? (
              <>
                <Button onClick={() => setBulkConfirmOpen(true)} data-testid="final-exams-bulk-save">{t("save_all_scores")}</Button>
                <Button variant="outline" onClick={() => setBulkEditMode(false)}>{t("cancel")}</Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={startBulkEdit} data-testid="final-exams-edit-scores">{t("edit_scores")}</Button>
                <Button variant="outline" onClick={() => setClearScoresOpen(true)} data-testid="final-exams-clear-scores">{t("clear_scores")}</Button>
              </>
            )}
          </div>
        }
      />

      <Card data-testid="final-exams-bulk-import-card">
        <CardContent className="flex flex-wrap items-center justify-end gap-3 pt-6">
          <Button variant="secondary" onClick={handleDownloadTemplate} data-testid="final-exams-download-template">
            {t("download_template")}
          </Button>
          <Button variant="secondary" onClick={handleDownloadMarks} data-testid="final-exams-download-marks">
            {t("download_marks")}
          </Button>
          <input
            ref={bulkFileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleBulkImport(file);
              e.target.value = "";
            }}
          />
          <Button onClick={() => bulkFileInputRef.current?.click()} data-testid="final-exams-import-excel">
            {t("import_excel")}
          </Button>
        </CardContent>
      </Card>

      <Card data-testid="final-exams-filter-card">
        <CardContent className="grid gap-4 pt-6 md:grid-cols-2 xl:grid-cols-6">
          <Input placeholder={t("search_students")} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          <Select
            value={filterClass}
            onValueChange={(value) => {
              sessionStorage.setItem("app_selected_class_id", value);
              setFilterClass(value);
            }}
          >
            <SelectTrigger><SelectValue placeholder={t("select_class")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("all_classes")}</SelectItem>
              {classes.map((cls) => <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={performanceFilter} onValueChange={setPerformanceFilter}>
            <SelectTrigger><SelectValue placeholder={t("performance_filter")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("performance_filter")}</SelectItem>
              <SelectItem value="on_level">{t("on_level")}</SelectItem>
              <SelectItem value="approach">{t("approach")}</SelectItem>
              <SelectItem value="below">{t("below")}</SelectItem>
            </SelectContent>
          </Select>
          <Input placeholder={t("min_score")} value={scoreMin} onChange={(e) => setScoreMin(e.target.value)} />
          <Input placeholder={t("max_score")} value={scoreMax} onChange={(e) => setScoreMax(e.target.value)} />
          <Button variant="outline" onClick={resetFilters}>{t("reset_filters")}</Button>
        </CardContent>
      </Card>

      <Card data-testid="final-exams-table-card">
        <CardContent className="pt-6">
          <Table data-testid="final-exams-marks-table">
            <TableHeader>
              <TableRow>
                <TableHead>{t("student_name")}</TableHead>
                <TableHead>{t("class_name")}</TableHead>
                <TableHead className="text-center">{t("quarter1_practical_exam")} (10)</TableHead>
                <TableHead className="text-center">{t("quarter1_theoretical_exam")} (10)</TableHead>
                <TableHead className="text-center">{t("total_score")}</TableHead>
                <TableHead className="text-center">{t("performance_level")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="bg-muted/50">
                <TableCell colSpan={2} className="text-muted-foreground text-sm py-2">{t("fill_column")}:</TableCell>
                <TableCell className="text-center py-2">
                  <div className="flex items-center justify-center gap-1">
                    <Input type="number" min={0} max={10} step={0.5} className="w-14 h-8 text-center text-sm" placeholder="0–10"
                      value={fillValues.quarter1_practical} onChange={(e) => setFillValues((prev) => ({ ...prev, quarter1_practical: e.target.value }))} />
                    <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => handleFillColumn("quarter1_practical", 10)}>{t("fill_column")}</Button>
                  </div>
                </TableCell>
                <TableCell className="text-center py-2">
                  <div className="flex items-center justify-center gap-1">
                    <Input type="number" min={0} max={10} step={0.5} className="w-14 h-8 text-center text-sm" placeholder="0–10"
                      value={fillValues.quarter1_theory} onChange={(e) => setFillValues((prev) => ({ ...prev, quarter1_theory: e.target.value }))} />
                    <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => handleFillColumn("quarter1_theory", 10)}>{t("fill_column")}</Button>
                  </div>
                </TableCell>
                <TableCell colSpan={2} />
              </TableRow>
              {filteredStudents.length ? (
                filteredStudents.map((student) => {
                  const current = bulkScores[student.id] || student;
                  // Use backend final-exams combined total when available (50/50); in bulk edit use local computation for live preview
                  const total =
                    !bulkEditMode &&
                    student.final_exams_combined_total != null &&
                    !Number.isNaN(Number(student.final_exams_combined_total))
                      ? Number(student.final_exams_combined_total)
                      : computeFinalTotal(student, current);
                  const perfLevel =
                    !bulkEditMode && student.final_exams_performance_level
                      ? student.final_exams_performance_level
                      : computeFinalPerformanceLevel(student, current);
                  return (
                    <TableRow key={student.id} data-testid={`final-exams-row-${student.id}`}>
                      <TableCell>{student.full_name}</TableCell>
                      <TableCell>{student.class_name}</TableCell>
                      <TableCell className="text-center">
                        {bulkEditMode ? (
                          <Input type="number" min={0} max={10} step={0.5} className="text-center"
                            value={current.quarter1_practical ?? ""} onChange={(e) => handleScoreChange(student.id, "quarter1_practical", e.target.value, 10)} />
                        ) : formatScore(student.quarter1_practical)}
                      </TableCell>
                      <TableCell className="text-center">
                        {bulkEditMode ? (
                          <Input type="number" min={0} max={10} step={0.5} className="text-center"
                            value={current.quarter1_theory ?? ""} onChange={(e) => handleScoreChange(student.id, "quarter1_theory", e.target.value, 10)} />
                        ) : formatScore(student.quarter1_theory)}
                      </TableCell>
                      <TableCell className="text-center" data-testid={`final-exams-total-${student.id}`}>
                        {formatScore(total, `/${FINAL_TOTAL_MAX}`)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={levelStyles[perfLevel]}>{t(perfLevel)}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">{t("no_data")}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={bulkConfirmOpen} onOpenChange={setBulkConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("save_all_scores")}</DialogTitle>
            <DialogDescription>{t("save_changes")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkConfirmOpen(false)}>{t("cancel")}</Button>
            <Button onClick={handleBulkSave} data-testid="final-exams-bulk-confirm">{t("save_changes")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={clearScoresOpen} onOpenChange={setClearScoresOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("clear_scores")}</DialogTitle>
            <DialogDescription>{t("clear_scores_confirm")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClearScoresOpen(false)}>{t("cancel")}</Button>
            <Button variant="destructive" onClick={handleClearScores}>{t("clear_scores")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AssessmentPageFooter language={language} />
    </div>
  );
}
