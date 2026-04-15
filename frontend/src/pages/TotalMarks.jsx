import { useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { toast } from "sonner";
import { api, BULK_SAVE_TIMEOUT_MS, getApiErrorMessage } from "@/lib/api";
import { useTranslations } from "@/lib/i18n";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { sortByClassOrder } from "@/lib/utils";

const toNumberOrNull = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const parseScore = (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const numeric = Number(value);
  return Number.isNaN(numeric) ? null : numeric;
};

const sumOrNull = (...values) => {
  const parsed = values.map(toNumberOrNull);
  if (!parsed.some((value) => value !== null)) return null;
  const total = parsed.reduce((acc, value) => acc + (value ?? 0), 0);
  return Math.round(total * 100) / 100;
};

const maxOrNull = (...values) => {
  const parsed = values.map(toNumberOrNull).filter((value) => value !== null);
  if (!parsed.length) return null;
  return Math.max(...parsed);
};

const formatScore = (value) => {
  const parsed = toNumberOrNull(value);
  if (parsed === null) return "—";
  return Number.isInteger(parsed) ? String(parsed) : String(parsed);
};

const formatDownloadFilePart = (value, fallback = "all-classes") => {
  const raw = String(value || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return raw || fallback;
};

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj || {}, key);

export default function TotalMarks() {
  const { language, semester, quarter, classes: contextClasses, classesLoaded } = useOutletContext();
  const t = useTranslations(language);
  const semesterNumber = semester === "semester2" ? 2 : 1;
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [weeks, setWeeks] = useState([]);
  const [activeWeekId, setActiveWeekId] = useState("");
  const [filterClass, setFilterClass] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [bulkEditMode, setBulkEditMode] = useState(false);
  const [bulkScores, setBulkScores] = useState({});
  const [fillValues, setFillValues] = useState({
    attendance: "",
    participation: "",
    behavior: "",
    homework: "",
    quizPrimary: "",
    quizSecondary: "",
    chapter: "",
    examPractical: "",
    examTheory: "",
  });
  const bulkFileInputRef = useRef(null);
  const latestLoadRequestIdRef = useRef(0);

  const quarterConfig = useMemo(
    () =>
      quarter === 2
        ? {
            view: "total_marks_q2",
            quizPrimaryField: "quiz3",
            quizSecondaryField: "quiz4",
            chapterField: "chapter_test2_practical",
            examPracticalField: "quarter2_practical",
            examTheoryField: "quarter2_theory",
            totalField: "final_exams_q2_combined_total",
            quizPrimaryLabel: t("quiz3"),
            quizSecondaryLabel: t("quiz4"),
          }
        : {
            view: "total_marks",
            quizPrimaryField: "quiz1",
            quizSecondaryField: "quiz2",
            chapterField: "chapter_test1_practical",
            examPracticalField: "quarter1_practical",
            examTheoryField: "quarter1_theory",
            totalField: "final_exams_combined_total",
            quizPrimaryLabel: t("quiz1"),
            quizSecondaryLabel: t("quiz2"),
          },
    [quarter, t]
  );

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
    } catch (error) {
      toast.error(getApiErrorMessage(error) || "Failed to load weeks");
    }
  };

  useEffect(() => {
    setWeeks([]);
    setActiveWeekId("");
    setBulkScores({});
    setBulkEditMode(false);
    loadWeeks();
  }, [semesterNumber, quarter]);

  useEffect(() => {
    if (!activeWeekId || !weeks.length) return;
    if (!weeks.some((w) => w.id === activeWeekId)) return;
    loadData(activeWeekId);
  }, [activeWeekId, weeks]);

  useEffect(() => {
    if (!weeks.length) return;
    if (weeks.find((w) => w.id === activeWeekId)) return;
    const key = `app_selected_week_id_s${semesterNumber}_q${quarter}`;
    const saved = sessionStorage.getItem(key);
    if (saved && weeks.some((w) => w.id === saved)) setActiveWeekId(saved);
    else setActiveWeekId(weeks[0]?.id || "");
  }, [weeks, semesterNumber, quarter, activeWeekId]);

  useEffect(() => {
    if (!classes?.length) return;
    const key = `app_selected_class_id_s${semesterNumber}_q${quarter}`;
    const saved = sessionStorage.getItem(key);
    if (saved === "all" || classes.some((c) => c.id === saved)) setFilterClass(saved || "all");
  }, [classes, semesterNumber, quarter]);

  useEffect(() => {
    const onStudentsUpdated = () => {
      if (activeWeekId) loadData(activeWeekId);
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible" && activeWeekId) loadData(activeWeekId);
    };
    window.addEventListener("students-updated", onStudentsUpdated);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("students-updated", onStudentsUpdated);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [activeWeekId]);

  const getCurrentFieldValue = (student, pending, field, fallback) => {
    if (hasOwn(pending, field)) return pending[field];
    if (fallback !== undefined && fallback !== null && fallback !== "") return fallback;
    return student[field] ?? "";
  };

  const buildRow = (student) => {
    const pending = bulkScores[student.id] || {};
    const attendance = getCurrentFieldValue(student, pending, "attendance");
    const participation = getCurrentFieldValue(student, pending, "participation");
    const behavior = getCurrentFieldValue(student, pending, "behavior");
    const homework = getCurrentFieldValue(student, pending, "homework");
    const quizPrimary = getCurrentFieldValue(
      student,
      pending,
      quarterConfig.quizPrimaryField,
      student.total_marks_quiz_primary
    );
    const quizSecondary = getCurrentFieldValue(
      student,
      pending,
      quarterConfig.quizSecondaryField,
      student.total_marks_quiz_secondary
    );
    const chapter = getCurrentFieldValue(
      student,
      pending,
      quarterConfig.chapterField,
      student.total_marks_chapter_test
    );
    const examPractical = getCurrentFieldValue(
      student,
      pending,
      quarterConfig.examPracticalField,
      student.total_marks_exam_practical
    );
    const examTheory = getCurrentFieldValue(
      student,
      pending,
      quarterConfig.examTheoryField,
      student.total_marks_exam_theory
    );
    const attendanceParticipation = sumOrNull(attendance, participation);
    const quizBest = maxOrNull(quizPrimary, quizSecondary);
    const quarterExamTotal = sumOrNull(examPractical, examTheory);
    const computedTotal = sumOrNull(
      attendanceParticipation,
      behavior,
      homework,
      quizBest,
      chapter,
      quarterExamTotal
    );
    const backendTotal = toNumberOrNull(student[quarterConfig.totalField]);
    return {
      ...student,
      attendance,
      participation,
      behavior,
      homework,
      quizPrimary,
      quizSecondary,
      chapter,
      examPractical,
      examTheory,
      attendanceParticipation,
      quizBest,
      quarterExamTotal,
      total: backendTotal ?? computedTotal,
    };
  };

  const rows = useMemo(() => {
    return students
      .filter((student) => {
        if (filterClass !== "all" && student.class_id !== filterClass) return false;
        if (searchTerm && !student.full_name?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        return true;
      })
      .map(buildRow);
  }, [students, filterClass, searchTerm, bulkScores, quarterConfig]);

  const updateBulkScore = (studentId, field, value) => {
    setBulkScores((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], [field]: value },
    }));
  };

  const warnMarksExceeded = (max) => {
    toast.warning(
      t("marks_exceeded")?.replace(/{max}/g, String(max)) ||
        `This mark cannot exceed ${max}. Please enter a value from 0 to ${max}.`
    );
  };

  const handleScoreChange = (studentId, field, value, max) => {
    if (value === "" || value === null || value === undefined) {
      updateBulkScore(studentId, field, value);
      return;
    }
    const num = Number(value);
    if (Number.isNaN(num) || num < 0) {
      return;
    }
    if (num > max) {
      warnMarksExceeded(max);
      return;
    }
    updateBulkScore(studentId, field, value);
  };

  const handleFillValueChange = (field, value, max) => {
    if (value === "" || value === null || value === undefined) {
      setFillValues((prev) => ({ ...prev, [field]: value }));
      return;
    }
    const num = Number(value);
    if (Number.isNaN(num) || num < 0) return;
    if (num > max) {
      warnMarksExceeded(max);
      return;
    }
    setFillValues((prev) => ({ ...prev, [field]: value }));
  };

  const applyFillColumn = (field, fillField, max) => {
    const raw = fillValues[fillField];
    if (raw === "" || raw === null || raw === undefined) {
      toast.error(t("enter_value_to_fill") || "Enter a value to fill");
      return;
    }
    const num = Number(raw);
    if (Number.isNaN(num) || num < 0) {
      toast.error(t("enter_valid_value") || "Enter a valid number");
      return;
    }
    if (num > max) {
      warnMarksExceeded(max);
      return;
    }
    setBulkEditMode(true);
    setBulkScores((prev) => {
      const next = { ...prev };
      rows.forEach((student) => {
        next[student.id] = { ...next[student.id], [field]: raw };
      });
      return next;
    });
    toast.success(t("fill_applied") || "Value applied to all students in this column");
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
        const update = { id: student.id };
        [
          "attendance",
          "participation",
          "behavior",
          "homework",
          quarterConfig.quizPrimaryField,
          quarterConfig.quizSecondaryField,
          quarterConfig.chapterField,
          quarterConfig.examPracticalField,
          quarterConfig.examTheoryField,
        ].forEach((field) => {
          if (hasOwn(pending, field)) {
            update[field] = parseScore(pending[field]);
          }
        });
        return Object.keys(update).length > 1 ? [update] : [];
      });
      if (!updates.length) {
        toast.info("No score changes to save.");
        return;
      }
      await api.post("/students/bulk-scores", { updates, week_id: activeWeekId }, { timeout: BULK_SAVE_TIMEOUT_MS });
      setBulkScores({});
      setBulkEditMode(false);
      toast.success(t("student_updated"));
      window.dispatchEvent(new CustomEvent("students-updated"));
      loadData(activeWeekId);
    } catch (error) {
      toast.error(getApiErrorMessage(error) || t("student_update_failed"));
    }
  };

  const clearScores = async (allClasses) => {
    if (!activeWeekId) {
      toast.error(t("select_week_before_import") || "Please select a week first.");
      return;
    }
    if (!allClasses && filterClass === "all") {
      toast.error(t("select_class_to_clear_scores") || "Please select a class first.");
      return;
    }
    const targetStudents = allClasses
      ? students
      : students.filter((student) => student.class_id === filterClass);
    if (!targetStudents.length) {
      toast.error(t("no_data"));
      return;
    }
    const updates = targetStudents.map((student) => ({
      id: student.id,
      attendance: null,
      participation: null,
      behavior: null,
      homework: null,
      [quarterConfig.quizPrimaryField]: null,
      [quarterConfig.quizSecondaryField]: null,
      [quarterConfig.chapterField]: null,
      [quarterConfig.examPracticalField]: null,
      [quarterConfig.examTheoryField]: null,
    }));
    try {
      await api.post("/students/bulk-scores", { updates, week_id: activeWeekId }, { timeout: BULK_SAVE_TIMEOUT_MS });
      setBulkScores({});
      setBulkEditMode(false);
      toast.success(allClasses ? t("scores_cleared_all_classes") : t("scores_cleared"));
      window.dispatchEvent(new CustomEvent("students-updated"));
      loadData(activeWeekId);
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
          view: quarterConfig.view,
        },
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        quarter === 2 ? "total-marks-q2-template.xlsx" : "total-marks-template.xlsx"
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

  const handleDownloadMarks = async () => {
    try {
      const response = await api.get("/students/export", {
        params: {
          week_id: activeWeekId || undefined,
          class_id: filterClass !== "all" ? filterClass : undefined,
          view: quarterConfig.view,
        },
        responseType: "blob",
      });
      const selectedClassName =
        filterClass === "all"
          ? (t("all_classes") || "all-classes")
          : (classes.find((cls) => cls.id === filterClass)?.name || filterClass);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `${quarter === 2 ? "total-marks-q2-class" : "total-marks-class"}-${formatDownloadFilePart(selectedClassName)}.xlsx`
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

  const handleBulkImport = async (file) => {
    if (!file) {
      toast.error(t("please_select_file") || "Please select a file first");
      return;
    }
    if (!activeWeekId) {
      toast.error(t("select_week_before_import") || "Please select a week before importing marks so they are saved correctly.");
      return;
    }
    const formData = new FormData();
    formData.append("file", file);
    try {
      await api.post("/import/excel", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        params: { week_id: activeWeekId },
      });
      if (bulkFileInputRef.current) bulkFileInputRef.current.value = "";
      setBulkScores({});
      setBulkEditMode(false);
      toast.success(t("bulk_import_completed") || "Bulk import completed");
      window.dispatchEvent(new CustomEvent("students-updated"));
      loadData(activeWeekId);
    } catch (error) {
      toast.error(error?.response?.data?.detail || t("bulk_import_failed") || "Bulk import failed");
    }
  };

  const resetFilters = () => {
    sessionStorage.setItem(`app_selected_class_id_s${semesterNumber}_q${quarter}`, "all");
    setFilterClass("all");
    setSearchTerm("");
  };

  const renderMiniInput = ({ value, onChange, max, placeholder, testId }) => (
    <Input
      type="number"
      min={0}
      max={max}
      step={0.5}
      value={value ?? ""}
      placeholder={placeholder}
      onChange={onChange}
      disabled={!bulkEditMode}
      className="h-8 min-w-[4.5rem] text-center"
      data-testid={testId}
    />
  );

  return (
    <div className="space-y-8" data-testid="total-marks-page">
      <PageHeader
        title={t("nav_total_marks")}
        subtitle={t("overview")}
        testIdPrefix="total-marks"
        action={
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleBulkSave} data-testid="total-marks-save-all">
              {t("save_all_scores")}
            </Button>
            {bulkEditMode ? (
              <Button
                variant="outline"
                onClick={() => {
                  setBulkScores({});
                  setBulkEditMode(false);
                }}
                data-testid="total-marks-cancel-edit"
              >
                {t("cancel")}
              </Button>
            ) : (
              <Button variant="outline" onClick={() => setBulkEditMode(true)} data-testid="total-marks-edit-scores">
                {t("edit_scores")}
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => {
                if (window.confirm(t("clear_scores_confirm"))) clearScores(false);
              }}
              data-testid="total-marks-clear-scores"
            >
              {t("clear_scores")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (window.confirm(t("clear_scores_all_classes_confirm"))) clearScores(true);
              }}
              data-testid="total-marks-clear-all"
            >
              {t("clear_scores_all_classes")}
            </Button>
          </div>
        }
      />

      <p className="text-xs text-muted-foreground" data-testid="total-marks-hint">
        {t("total_marks_hint")}
      </p>

      <Card data-testid="total-marks-import-export-card">
        <CardContent className="flex flex-wrap items-center justify-end gap-3 pt-6">
          <Button variant="secondary" onClick={handleDownloadTemplate} data-testid="total-marks-download-template">
            {t("download_template")}
          </Button>
          <Button variant="secondary" onClick={handleDownloadMarks} data-testid="total-marks-download-marks">
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
            data-testid="total-marks-import-file"
          />
          <Button onClick={() => bulkFileInputRef.current?.click()} data-testid="total-marks-import-excel">
            {t("import_excel")}
          </Button>
        </CardContent>
      </Card>

      <Card data-testid="total-marks-filter-card">
        <CardContent className="grid gap-4 pt-6 md:grid-cols-2 xl:grid-cols-4">
          <Input
            placeholder={t("search_students")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Select
            value={filterClass}
            onValueChange={(value) => {
              sessionStorage.setItem(`app_selected_class_id_s${semesterNumber}_q${quarter}`, value);
              setFilterClass(value);
            }}
          >
            <SelectTrigger>
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
          <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
            {weeks.find((week) => week.id === activeWeekId)?.label || t("no_data")}
          </div>
          <Button variant="outline" onClick={resetFilters}>
            {t("reset_filters")}
          </Button>
        </CardContent>
      </Card>

      <Card data-testid="total-marks-table-card">
        <CardContent className="pt-6">
          <Table data-testid="total-marks-table">
            <TableHeader>
              <TableRow>
                <TableHead>{t("student_name")}</TableHead>
                <TableHead>{t("class_name")}</TableHead>
                <TableHead className="text-center">{t("total_marks_quizzes")} (5)</TableHead>
                <TableHead className="text-center">{t("total_marks_chapter_test")} (10)</TableHead>
                <TableHead className="text-center">{t("homework")} (5)</TableHead>
                <TableHead className="text-center">{t("total_marks_participation_attendance")} (5)</TableHead>
                <TableHead className="text-center">{t("behavior")} (5)</TableHead>
                <TableHead className="text-center">{t("quarter_exams_total")} (20)</TableHead>
                <TableHead className="text-center">{t("total_marks_overall")} (50)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bulkEditMode && (
                <TableRow className="bg-muted/50">
                  <TableCell colSpan={2} className="text-muted-foreground text-sm py-2">
                    {t("fill_column")}:
                  </TableCell>
                  <TableCell className="py-2">
                    <div className="space-y-2">
                      <div className="flex items-center justify-center gap-1">
                        <span className="w-10 text-[11px] text-muted-foreground">{quarterConfig.quizPrimaryLabel}</span>
                        {renderMiniInput({
                          value: fillValues.quizPrimary,
                          onChange: (e) => handleFillValueChange("quizPrimary", e.target.value, 5),
                          max: 5,
                          placeholder: "0-5",
                        })}
                        <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => applyFillColumn(quarterConfig.quizPrimaryField, "quizPrimary", 5)}>
                          {t("fill_column")}
                        </Button>
                      </div>
                      <div className="flex items-center justify-center gap-1">
                        <span className="w-10 text-[11px] text-muted-foreground">{quarterConfig.quizSecondaryLabel}</span>
                        {renderMiniInput({
                          value: fillValues.quizSecondary,
                          onChange: (e) => handleFillValueChange("quizSecondary", e.target.value, 5),
                          max: 5,
                          placeholder: "0-5",
                        })}
                        <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => applyFillColumn(quarterConfig.quizSecondaryField, "quizSecondary", 5)}>
                          {t("fill_column")}
                        </Button>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-2">
                    <div className="flex items-center justify-center gap-1">
                      {renderMiniInput({
                        value: fillValues.chapter,
                        onChange: (e) => handleFillValueChange("chapter", e.target.value, 10),
                        max: 10,
                        placeholder: "0-10",
                      })}
                      <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => applyFillColumn(quarterConfig.chapterField, "chapter", 10)}>
                        {t("fill_column")}
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="py-2">
                    <div className="flex items-center justify-center gap-1">
                      {renderMiniInput({
                        value: fillValues.homework,
                        onChange: (e) => handleFillValueChange("homework", e.target.value, 5),
                        max: 5,
                        placeholder: "0-5",
                      })}
                      <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => applyFillColumn("homework", "homework", 5)}>
                        {t("fill_column")}
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="py-2">
                    <div className="space-y-2">
                      <div className="flex items-center justify-center gap-1">
                        <span className="w-10 text-[11px] text-muted-foreground">A</span>
                        {renderMiniInput({
                          value: fillValues.attendance,
                          onChange: (e) => handleFillValueChange("attendance", e.target.value, 2.5),
                          max: 2.5,
                          placeholder: "0-2.5",
                        })}
                        <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => applyFillColumn("attendance", "attendance", 2.5)}>
                          {t("fill_column")}
                        </Button>
                      </div>
                      <div className="flex items-center justify-center gap-1">
                        <span className="w-10 text-[11px] text-muted-foreground">P</span>
                        {renderMiniInput({
                          value: fillValues.participation,
                          onChange: (e) => handleFillValueChange("participation", e.target.value, 2.5),
                          max: 2.5,
                          placeholder: "0-2.5",
                        })}
                        <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => applyFillColumn("participation", "participation", 2.5)}>
                          {t("fill_column")}
                        </Button>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-2">
                    <div className="flex items-center justify-center gap-1">
                      {renderMiniInput({
                        value: fillValues.behavior,
                        onChange: (e) => handleFillValueChange("behavior", e.target.value, 5),
                        max: 5,
                        placeholder: "0-5",
                      })}
                      <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => applyFillColumn("behavior", "behavior", 5)}>
                        {t("fill_column")}
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="py-2">
                    <div className="space-y-2">
                      <div className="flex items-center justify-center gap-1">
                        <span className="w-10 text-[11px] text-muted-foreground">P</span>
                        {renderMiniInput({
                          value: fillValues.examPractical,
                          onChange: (e) => handleFillValueChange("examPractical", e.target.value, 10),
                          max: 10,
                          placeholder: "0-10",
                        })}
                        <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => applyFillColumn(quarterConfig.examPracticalField, "examPractical", 10)}>
                          {t("fill_column")}
                        </Button>
                      </div>
                      <div className="flex items-center justify-center gap-1">
                        <span className="w-10 text-[11px] text-muted-foreground">T</span>
                        {renderMiniInput({
                          value: fillValues.examTheory,
                          onChange: (e) => handleFillValueChange("examTheory", e.target.value, 10),
                          max: 10,
                          placeholder: "0-10",
                        })}
                        <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => applyFillColumn(quarterConfig.examTheoryField, "examTheory", 10)}>
                          {t("fill_column")}
                        </Button>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell />
                </TableRow>
              )}
              {rows.length ? (
                rows.map((student) => (
                  <TableRow key={student.id} data-testid={`total-marks-row-${student.id}`}>
                    <TableCell>{student.full_name}</TableCell>
                    <TableCell>{student.class_name}</TableCell>
                    <TableCell className="py-3">
                      <div className="space-y-2">
                        <div className="flex items-center justify-center gap-2">
                          <span className="w-10 text-[11px] text-muted-foreground">{quarterConfig.quizPrimaryLabel}</span>
                          {renderMiniInput({
                            value: student.quizPrimary,
                            onChange: (e) => handleScoreChange(student.id, quarterConfig.quizPrimaryField, e.target.value, 5),
                            max: 5,
                            placeholder: "0-5",
                            testId: `total-marks-quiz-primary-${student.id}`,
                          })}
                        </div>
                        <div className="flex items-center justify-center gap-2">
                          <span className="w-10 text-[11px] text-muted-foreground">{quarterConfig.quizSecondaryLabel}</span>
                          {renderMiniInput({
                            value: student.quizSecondary,
                            onChange: (e) => handleScoreChange(student.id, quarterConfig.quizSecondaryField, e.target.value, 5),
                            max: 5,
                            placeholder: "0-5",
                            testId: `total-marks-quiz-secondary-${student.id}`,
                          })}
                        </div>
                        <p className="text-center text-[11px] text-muted-foreground">
                          Best: {formatScore(student.quizBest)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {renderMiniInput({
                        value: student.chapter,
                        onChange: (e) => handleScoreChange(student.id, quarterConfig.chapterField, e.target.value, 10),
                        max: 10,
                        placeholder: "0-10",
                        testId: `total-marks-chapter-${student.id}`,
                      })}
                    </TableCell>
                    <TableCell className="text-center">
                      {renderMiniInput({
                        value: student.homework,
                        onChange: (e) => handleScoreChange(student.id, "homework", e.target.value, 5),
                        max: 5,
                        placeholder: "0-5",
                        testId: `total-marks-homework-${student.id}`,
                      })}
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="space-y-2">
                        <div className="flex items-center justify-center gap-2">
                          <span className="w-10 text-[11px] text-muted-foreground">A</span>
                          {renderMiniInput({
                            value: student.attendance,
                            onChange: (e) => handleScoreChange(student.id, "attendance", e.target.value, 2.5),
                            max: 2.5,
                            placeholder: "0-2.5",
                            testId: `total-marks-attendance-${student.id}`,
                          })}
                        </div>
                        <div className="flex items-center justify-center gap-2">
                          <span className="w-10 text-[11px] text-muted-foreground">P</span>
                          {renderMiniInput({
                            value: student.participation,
                            onChange: (e) => handleScoreChange(student.id, "participation", e.target.value, 2.5),
                            max: 2.5,
                            placeholder: "0-2.5",
                            testId: `total-marks-participation-${student.id}`,
                          })}
                        </div>
                        <p className="text-center text-[11px] text-muted-foreground">
                          Total: {formatScore(student.attendanceParticipation)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {renderMiniInput({
                        value: student.behavior,
                        onChange: (e) => handleScoreChange(student.id, "behavior", e.target.value, 5),
                        max: 5,
                        placeholder: "0-5",
                        testId: `total-marks-project-${student.id}`,
                      })}
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="space-y-2">
                        <div className="flex items-center justify-center gap-2">
                          <span className="w-10 text-[11px] text-muted-foreground">P</span>
                          {renderMiniInput({
                            value: student.examPractical,
                            onChange: (e) => handleScoreChange(student.id, quarterConfig.examPracticalField, e.target.value, 10),
                            max: 10,
                            placeholder: "0-10",
                            testId: `total-marks-exam-practical-${student.id}`,
                          })}
                        </div>
                        <div className="flex items-center justify-center gap-2">
                          <span className="w-10 text-[11px] text-muted-foreground">T</span>
                          {renderMiniInput({
                            value: student.examTheory,
                            onChange: (e) => handleScoreChange(student.id, quarterConfig.examTheoryField, e.target.value, 10),
                            max: 10,
                            placeholder: "0-10",
                            testId: `total-marks-exam-theory-${student.id}`,
                          })}
                        </div>
                        <p className="text-center text-[11px] text-muted-foreground">
                          Total: {formatScore(student.quarterExamTotal)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-semibold">{formatScore(student.total)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground">
                    {t("no_data")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
