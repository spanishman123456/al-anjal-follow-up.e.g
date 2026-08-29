import { useEffect, useRef, useState } from "react";
import { useOutletContext, Link } from "react-router-dom";
import { buildAcademicExportFilename } from "@/lib/exportFilenames";
import { toast } from "sonner";
import { api, getApiErrorMessage, getLocalizedApiErrorMessage } from "@/lib/api";
import { displayQuarterLabel } from "@/lib/academicScope";
import { useTranslations } from "@/lib/i18n";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Trash2 } from "lucide-react";
import { performanceStatCellClasses } from "@/lib/performanceBadges";

export default function Classes() {
  const { language, profile, semester, quarter, academicYear, schoolSection, loadClasses: refreshGlobalClasses } = useOutletContext();
  const semesterNumber = semester === "semester2" ? 2 : 1;
  const isTeacher = profile?.role_name === "Teacher";
  const t = useTranslations(language);
  const quarterOneLabel = displayQuarterLabel(t, semesterNumber, 1);
  const quarterTwoLabel = displayQuarterLabel(t, semesterNumber, 2);
  const [classes, setClasses] = useState([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [form, setForm] = useState({ name: "", grade: "", section: "" });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState(null);
  const [clearScoresDialogOpen, setClearScoresDialogOpen] = useState(false);
  const [classToClear, setClassToClear] = useState(null);
  const latestLoadRequestIdRef = useRef(0);

  const selectedTermLabel =
    semesterNumber === 2
      ? quarter === 2
        ? t("semester_two_quarter_two")
        : t("semester_two_quarter_one")
      : quarter === 2
        ? t("semester_one_quarter_two")
        : t("semester_one_quarter_one");

  const filterTeacherClasses = (data) => {
    if (!isTeacher) return data;
    if (!profile?.assigned_class_ids?.length) return [];
    const ids = new Set(profile.assigned_class_ids);
    return data.filter((c) => ids.has(c.class_id));
  };

  const loadClasses = async () => {
    const requestId = ++latestLoadRequestIdRef.current;
    try {
      const baseClassesRes = await api.get("/classes", { params: { school_section: schoolSection, academic_year: academicYear } });
      if (latestLoadRequestIdRef.current !== requestId) return;
      const baseClasses = (baseClassesRes.data || []).map((cls) => ({
        class_id: cls.id,
        class_name: cls.name,
        grade: cls.grade,
        section: cls.section,
        student_count: 0,
        avg_total_score: null,
        distribution: { on_level: 0, approach: 0, below: 0, no_data: 0 },
        quarter1_on_level_rate: 0,
        quarter2_on_level_rate: 0,
        quarter1_avg_total: null,
        quarter2_avg_total: null,
        students_needing_support_count: 0,
        top_performers_count: 0,
      }));
      setClasses(filterTeacherClasses(baseClasses));

      api
        .get(schoolSection === "arabic" ? "/arabic/grades" : "/classes/summary", { params: schoolSection === "arabic" ? { academic_year: academicYear, semester: semesterNumber, quarter } : { semester: semesterNumber, quarter } })
        .then((response) => {
          if (latestLoadRequestIdRef.current !== requestId) return;
          const summaryData = schoolSection === "arabic"
            ? (response.data?.class_breakdown || []).map((item) => ({ ...item, avg_total_score: null, distribution: {}, students_needing_support_count: 0 }))
            : (response.data || []);
          if (!summaryData.length) return;
          setClasses(filterTeacherClasses(summaryData));
        })
        .catch(() => null);
    } catch (error) {
      if (latestLoadRequestIdRef.current !== requestId) return;
      try {
        const response = await api.get(schoolSection === "arabic" ? "/arabic/grades" : "/classes/summary", {
          params: schoolSection === "arabic" ? { academic_year: academicYear, semester: semesterNumber, quarter } : { semester: semesterNumber, quarter },
        });
        if (latestLoadRequestIdRef.current !== requestId) return;
        const summaryData = schoolSection === "arabic" ? (response.data?.class_breakdown || []) : (response.data || []);
        setClasses(filterTeacherClasses(summaryData));
      } catch {
        if (latestLoadRequestIdRef.current !== requestId) return;
        toast.error(getApiErrorMessage(error) || "Failed to load classes");
      }
    }
  };

  const handleDownload = async (format) => {
    try {
      const response = await api.get(schoolSection === "arabic" ? "/arabic/reports/export" : "/classes/summary/export", {
        params: schoolSection === "arabic" ? { format, semester: semesterNumber, quarter, academic_year: academicYear, lang: language } : { format, semester: semesterNumber, quarter },
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        buildAcademicExportFilename({
          prefix: "class-summary",
          academicYear,
          semester,
          quarter,
          className: "all-classes",
          extension: format === "excel" ? "xlsx" : "pdf",
        }),
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      toast.error(t("download_fail"));
    }
  };

  useEffect(() => {
    loadClasses();
  }, [semesterNumber, quarter, schoolSection, academicYear]);

  // Refetch when user returns to this tab so class/student counts stay in sync with Assessment page
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") loadClasses();
    };
    const onStudentsUpdated = () => loadClasses();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("students-updated", onStudentsUpdated);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("students-updated", onStudentsUpdated);
    };
  }, [semesterNumber, quarter]);

  const handleCreate = async () => {
    try {
      await api.post("/classes", {
        name: form.name,
        grade: form.grade ? Number(form.grade) : undefined,
        section: form.section || undefined,
        school_section: schoolSection,
        academic_year: academicYear,
      });
      toast.success(t("class_added"));
      setIsAddOpen(false);
      setForm({ name: "", grade: "", section: "" });
      loadClasses();
      if (typeof refreshGlobalClasses === "function") refreshGlobalClasses();
    } catch (error) {
      const status = error?.response?.status;
      const detail = error?.response?.data?.detail;
      if (status === 409 || detail === "class_already_exists") {
        toast.error(t("class_already_exists"));
        loadClasses();
        if (typeof refreshGlobalClasses === "function") refreshGlobalClasses();
      } else {
        toast.error(getLocalizedApiErrorMessage(error, t, "class_add_failed"));
      }
    }
  };

  const openDeleteDialog = (cls) => {
    setSelectedClass(cls);
    setDeleteDialogOpen(true);
  };

  const openClearScoresDialog = (cls) => {
    setClassToClear(cls);
    setClearScoresDialogOpen(true);
  };

  const handleClearQuarterScores = async () => {
    if (!classToClear) return;
    try {
      await api.delete(`/classes/${classToClear.class_id}/quarter-scores`, {
        params: { semester: semesterNumber, quarter },
      });
      toast.success(t("clear_quarter_scores_done"));
      setClearScoresDialogOpen(false);
      setClassToClear(null);
      loadClasses();
    } catch (error) {
      toast.error(getApiErrorMessage(error) || t("clear_quarter_scores_failed"));
    }
  };

  const handleDeleteClass = async () => {
    if (!selectedClass) return;
    try {
      await api.delete(`/classes/${selectedClass.class_id}`);
      toast.success(t("class_deleted"));
      setDeleteDialogOpen(false);
      loadClasses();
      if (typeof refreshGlobalClasses === "function") refreshGlobalClasses();
    } catch (error) {
      toast.error(getApiErrorMessage(error) || t("class_delete_failed"));
    }
  };

  const handleDeleteAllClasses = async () => {
    try {
      await api.delete("/classes", { params: { school_section: schoolSection, academic_year: academicYear } });
      toast.success(t("all_classes_deleted"));
      setDeleteAllDialogOpen(false);
      loadClasses();
      if (typeof refreshGlobalClasses === "function") refreshGlobalClasses();
    } catch (error) {
      toast.error(getApiErrorMessage(error) || t("delete_all_classes_failed"));
    }
  };

  return (
    <div className="space-y-8" data-testid="classes-page">
      <PageHeader
        pageKey="classes"
        testIdPrefix="classes"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => handleDownload("pdf")}
              data-testid="classes-download-pdf"
            >
              {t("download_pdf")}
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleDownload("excel")}
              data-testid="classes-download-excel"
            >
              {t("download_excel")}
            </Button>
            {!isTeacher && (
              <>
                <Button
                  variant="destructive"
                  onClick={() => setDeleteAllDialogOpen(true)}
                  data-testid="delete-all-classes-button"
                >
                  {t("delete_all_classes")}
                </Button>
              </>
            )}
            <Button onClick={() => setIsAddOpen(true)} data-testid="add-class-button">
              {t("add_class")}
            </Button>
          </div>
        }
      />

      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10 dark:from-primary/10 dark:to-primary/5">
        <CardContent className="py-4">
          <p className="text-sm text-muted-foreground">
            {t("classes_synced_with_quarters")}
          </p>
          <div className="mt-2 flex flex-wrap gap-4">
            {schoolSection === "arabic" ? (
              <Link to="/arabic-grades" className="text-sm font-medium text-primary hover:underline">
                {t("arabic_quarter_grades")} →
              </Link>
            ) : <>
            <Link
              to="/assessment-marks"
              className="text-sm font-medium text-primary hover:underline"
            >
              {t("first_quarter_marks")} →
            </Link>
            </>}
            <Link
              to="/assessment-marks-q2"
              className="text-sm font-medium text-primary hover:underline"
            >
              {t("second_quarter_marks")} →
            </Link>
          </div>
        </CardContent>
      </Card>

      <section className="section-bg-alt-1 grid gap-6 rounded-xl border border-border/50 p-4 md:grid-cols-2 xl:grid-cols-3 animate-stagger" data-testid="classes-grid">
        {classes.map((cls) => (
          <Card key={cls.class_id} className="card-hover" data-testid={`class-card-${cls.class_id}`}>
            <CardHeader className="flex flex-row items-start justify-between">
              <CardTitle data-testid={`class-card-title-${cls.class_id}`}>
                {cls.class_name}
              </CardTitle>
              {!isTeacher && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openDeleteDialog(cls)}
                  data-testid={`class-delete-${cls.class_id}`}
                >
                  {t("delete")}
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between" data-testid={`class-card-students-${cls.class_id}`}>
                <span className="text-sm text-muted-foreground">{t("total_students")}</span>
                <span className="text-sm font-semibold">{cls.student_count}</span>
              </div>
              {schoolSection === "arabic" ? (
                <>
                  <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">{t("students_with_grades")}</span><span className="text-sm font-semibold">{cls.students_with_grades ?? 0}</span></div>
                  <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">{t("completion_percentage")}</span><span className="text-sm font-semibold text-cyan-700 dark:text-cyan-300">{cls.completion_percentage ?? 0}%</span></div>
                </>
              ) : <>
              <div className="flex items-center justify-between" data-testid={`class-card-avg-${cls.class_id}`}>
                <span className="text-sm text-muted-foreground">{t("avg_total_score")}</span>
                <span className="text-sm font-semibold">
                  {cls.avg_total_score != null ? cls.avg_total_score : "—"}
                </span>
              </div>
              </>}
              <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2" data-testid={`class-card-quarter-rates-${cls.class_id}`}>
                <div className={performanceStatCellClasses.on_level}>
                  {quarterOneLabel}: {(cls.quarter1_on_level_rate ?? 0)}% {t("on_level")}
                </div>
                <div className={performanceStatCellClasses.on_level}>
                  {quarterTwoLabel}: {(cls.quarter2_on_level_rate ?? 0)}% {t("on_level")}
                </div>
              </div>
              <div className="text-xs text-muted-foreground" data-testid={`class-card-selected-term-${cls.class_id}`}>
                {t("performance_distribution")} - {selectedTermLabel}
              </div>
              <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2" data-testid={`class-card-distribution-${cls.class_id}`}>
                <div className={performanceStatCellClasses.on_level}>
                  {t("on_level")}: {cls.distribution?.on_level ?? 0}
                </div>
                <div className={performanceStatCellClasses.approach}>
                  {t("approach")}: {cls.distribution?.approach ?? 0}
                </div>
                <div className={performanceStatCellClasses.below}>
                  {t("below")}: {cls.distribution?.below ?? 0}
                </div>
                <div className={performanceStatCellClasses.no_data}>
                  {t("need_support")}: {cls.students_needing_support_count ?? 0}
                </div>
                {(cls.distribution?.no_data ?? 0) > 0 && (
                  <div className={`col-span-1 sm:col-span-2 ${performanceStatCellClasses.no_data}`}>
                    {t("no_data")}: {cls.distribution.no_data}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2 border-t border-border/60 pt-2">
                {schoolSection === "arabic" ? (
                  <Link to="/arabic-grades" className="text-xs font-medium text-primary hover:underline">{t("arabic_quarter_grades")}</Link>
                ) : <>
                <Link
                  to="/assessment-marks"
                  onClick={() => sessionStorage.setItem("app_selected_class_id_q1", cls.class_id)}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  {t("first_quarter_marks")}
                </Link>
                <Link
                  to="/assessment-marks-q2"
                  onClick={() => sessionStorage.setItem("app_selected_class_id_q2", cls.class_id)}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  {t("second_quarter_marks")}
                </Link>
                <button
                  type="button"
                  onClick={() => openClearScoresDialog(cls)}
                  className="text-xs font-medium text-muted-foreground hover:text-destructive hover:underline"
                  data-testid={`class-clear-scores-${cls.class_id}`}
                >
                  {t("clear_quarter_scores")}
                </button>
                </>}
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent data-testid="add-class-dialog">
          <DialogHeader>
            <DialogTitle data-testid="add-class-title">{t("add_class")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <Input
              placeholder={t("class_name")}
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              data-testid="add-class-name"
            />
            <Input
              placeholder={t("grade")}
              value={form.grade}
              onChange={(event) => setForm((prev) => ({ ...prev, grade: event.target.value }))}
              data-testid="add-class-grade"
            />
            <Input
              placeholder="Section"
              value={form.section}
              onChange={(event) => setForm((prev) => ({ ...prev, section: event.target.value }))}
              data-testid="add-class-section"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)} data-testid="add-class-cancel">
              {t("cancel")}
            </Button>
            <Button variant="success" onClick={handleCreate} data-testid="add-class-submit">
              {t("create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteAllDialogOpen} onOpenChange={setDeleteAllDialogOpen}>
        <DialogContent data-testid="delete-all-classes-dialog">
          <DialogHeader>
            <DialogTitle>{t("delete_all_classes")}</DialogTitle>
            <DialogDescription>{t("delete_all_classes_confirm")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteAllDialogOpen(false)} data-testid="delete-all-classes-cancel">
              {t("cancel")}
            </Button>
            <Button variant="destructive" onClick={handleDeleteAllClasses} data-testid="delete-all-classes-confirm">
              {t("delete_all_classes")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent data-testid="delete-class-dialog">
          <DialogHeader>
            <DialogTitle>{t("delete_class")}</DialogTitle>
            <DialogDescription>
              {selectedClass ? selectedClass.class_name : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} data-testid="delete-class-cancel">
              {t("cancel")}
            </Button>
            <Button variant="destructive" onClick={handleDeleteClass} data-testid="delete-class-confirm">
              {t("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={clearScoresDialogOpen} onOpenChange={setClearScoresDialogOpen}>
        <DialogContent data-testid="clear-quarter-scores-dialog">
          <DialogHeader>
            <DialogTitle>{t("clear_quarter_scores")}</DialogTitle>
            <DialogDescription>
              {classToClear ? classToClear.class_name : ""} — {t("clear_quarter_scores_confirm")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClearScoresDialogOpen(false)} data-testid="clear-scores-cancel">
              {t("cancel")}
            </Button>
            <Button variant="destructive" onClick={handleClearQuarterScores} data-testid="clear-scores-confirm">
              {t("clear_quarter_scores")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
