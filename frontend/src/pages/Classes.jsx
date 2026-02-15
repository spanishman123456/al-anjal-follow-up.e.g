import { useEffect, useState } from "react";
import { useOutletContext, Link } from "react-router-dom";
import { toast } from "sonner";
import { api } from "@/lib/api";
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

export default function Classes() {
  const { language, profile } = useOutletContext();
  const isTeacher = profile?.role_name === "Teacher";
  const t = useTranslations(language);
  const [classes, setClasses] = useState([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [form, setForm] = useState({ name: "", grade: "", section: "" });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState(null);

  const loadClasses = async () => {
    try {
      const response = await api.get("/classes/summary");
      let data = response.data;
      if (!data.length) {
        const baseClasses = await api.get("/classes");
        data = baseClasses.data.map((cls) => ({
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
      }
      if (isTeacher && profile?.assigned_class_ids?.length) {
        const ids = new Set(profile.assigned_class_ids);
        data = data.filter((c) => ids.has(c.class_id));
      }
      setClasses(data);
    } catch (error) {
      toast.error("Failed to load classes");
    }
  };

  const handleDownload = async (format) => {
    try {
      const response = await api.get("/classes/summary/export", {
        params: { format },
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `class_summary.${format === "excel" ? "xlsx" : "pdf"}`,
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
  }, []);

  const handleCreate = async () => {
    try {
      await api.post("/classes", {
        name: form.name,
        grade: form.grade ? Number(form.grade) : undefined,
        section: form.section || undefined,
      });
      toast.success("Class added");
      setIsAddOpen(false);
      setForm({ name: "", grade: "", section: "" });
      loadClasses();
    } catch (error) {
      toast.error("Failed to add class");
    }
  };

  const openDeleteDialog = (cls) => {
    setSelectedClass(cls);
    setDeleteDialogOpen(true);
  };

  const handleDeleteClass = async () => {
    if (!selectedClass) return;
    try {
      await api.delete(`/classes/${selectedClass.class_id}`);
      toast.success(t("class_deleted"));
      setDeleteDialogOpen(false);
      loadClasses();
    } catch (error) {
      toast.error(t("class_delete_failed"));
    }
  };

  return (
    <div className="space-y-8" data-testid="classes-page">
      <PageHeader
        title={t("classes")}
        subtitle={t("overview")}
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
              <Button onClick={() => setIsAddOpen(true)} data-testid="add-class-button">
                {t("add_class")}
              </Button>
            )}
          </div>
        }
      />

      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10 dark:from-primary/10 dark:to-primary/5">
        <CardContent className="py-4">
          <p className="text-sm text-muted-foreground">
            {t("classes_synced_with_quarters")}
          </p>
          <div className="mt-2 flex flex-wrap gap-4">
            <Link
              to="/assessment-marks"
              className="text-sm font-medium text-primary hover:underline"
            >
              {t("first_quarter_marks")} →
            </Link>
            <Link
              to="/assessment-marks-q2"
              className="text-sm font-medium text-primary hover:underline"
            >
              {t("second_quarter_marks")} →
            </Link>
          </div>
        </CardContent>
      </Card>

      <section className="section-bg-alt-1 grid gap-6 rounded-xl border border-border/50 p-4 md:grid-cols-2 xl:grid-cols-3" data-testid="classes-grid">
        {classes.map((cls) => (
          <Card key={cls.class_id} data-testid={`class-card-${cls.class_id}`}>
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
              <div className="flex items-center justify-between" data-testid={`class-card-avg-${cls.class_id}`}>
                <span className="text-sm text-muted-foreground">{t("avg_total_score")}</span>
                <span className="text-sm font-semibold">
                  {cls.avg_total_score != null ? cls.avg_total_score : "—"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs" data-testid={`class-card-quarter-rates-${cls.class_id}`}>
                <div className="rounded-md bg-emerald-50 px-2 py-1 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                  {t("quarter_1")}: {(cls.quarter1_on_level_rate ?? 0)}% {t("on_level")}
                </div>
                <div className="rounded-md bg-emerald-50 px-2 py-1 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                  {t("quarter_2")}: {(cls.quarter2_on_level_rate ?? 0)}% {t("on_level")}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs" data-testid={`class-card-distribution-${cls.class_id}`}>
                <div className="rounded-md bg-emerald-50 px-2 py-1 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                  {t("on_level")}: {cls.distribution?.on_level ?? 0}
                </div>
                <div className="rounded-md bg-amber-50 px-2 py-1 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                  {t("approach")}: {cls.distribution?.approach ?? 0}
                </div>
                <div className="rounded-md bg-rose-50 px-2 py-1 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">
                  {t("below")}: {cls.distribution?.below ?? 0}
                </div>
                <div className="rounded-md bg-slate-100 px-2 py-1 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                  {t("need_support")}: {cls.students_needing_support_count ?? 0}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 border-t border-border/60 pt-2">
                <Link
                  to="/assessment-marks"
                  onClick={() => sessionStorage.setItem("app_selected_class_id", cls.class_id)}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  {t("first_quarter_marks")}
                </Link>
                <Link
                  to="/assessment-marks-q2"
                  onClick={() => sessionStorage.setItem("app_selected_class_id", cls.class_id)}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  {t("second_quarter_marks")}
                </Link>
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
    </div>
  );
}
