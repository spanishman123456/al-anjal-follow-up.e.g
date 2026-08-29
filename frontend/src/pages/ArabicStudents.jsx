import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { AlertTriangle, Download, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { api, getLocalizedApiErrorMessage } from "@/lib/api";
import { useTranslations } from "@/lib/i18n";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LoadErrorCard } from "@/components/LoadErrorCard";
import { importStudentsWithPreview } from "@/lib/studentEnrollmentImport";

export default function ArabicStudents() {
  const { language, academicYear, classes = [], loadClasses, profile } = useOutletContext();
  const t = useTranslations(language);
  const [students, setStudents] = useState([]);
  const [classId, setClassId] = useState("all");
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [newClassId, setNewClassId] = useState("");
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState(null);
  const [deleteClassOpen, setDeleteClassOpen] = useState(false);
  const [deletingClass, setDeletingClass] = useState(false);
  const [loadedClassId, setLoadedClassId] = useState(null);
  const [loadError, setLoadError] = useState("");
  const importInputRef = useRef(null);

  const load = useCallback(async () => {
    setLoadError("");
    try {
      const response = await api.get("/students", {
        params: { school_section: "arabic", academic_year: academicYear, class_id: classId === "all" ? undefined : classId },
      });
      setStudents(response.data || []);
      setLoadedClassId(classId);
    } catch (error) {
      const message = getLocalizedApiErrorMessage(error, t);
      setStudents([]);
      setLoadedClassId(classId);
      setLoadError(message);
      toast.error(message);
    }
  }, [academicYear, classId, t]);

  useEffect(() => { load(); }, [load]);
  const classMap = useMemo(() => Object.fromEntries(classes.map((item) => [item.id, item.name])), [classes]);
  const isAdmin = profile?.role_name === "Admin";

  const create = async () => {
    if (!fullName.trim() || !newClassId) return;
    try {
      await api.post("/students", {
        full_name: fullName.trim(),
        class_id: newClassId,
        school_section: "arabic",
        academic_year: academicYear,
      });
      toast.success(t("student_added"));
      setOpen(false);
      setFullName("");
      setNewClassId("");
      await load();
      window.dispatchEvent(new CustomEvent("students-updated"));
    } catch (error) {
      toast.error(error?.response?.data?.detail || t("student_add_failed"));
    }
  };

  const remove = async (id) => {
    if (!window.confirm(t("confirm_delete"))) return;
    try {
      await api.delete(`/students/${id}`);
      await load();
      window.dispatchEvent(new CustomEvent("students-updated"));
    } catch {
      toast.error(t("delete_failed"));
    }
  };

  const deleteSelectedClassStudents = async () => {
    if (classId === "all" || !isAdmin) return;
    const selectedClassName = classMap[classId] || "";
    setDeletingClass(true);
    try {
      const response = await api.delete("/students", {
        params: { school_section: "arabic", academic_year: academicYear, class_id: classId },
      });
      toast.success(
        t("class_students_deleted")
          .replace("{count}", String(response.data?.students_deleted || 0))
          .replace("{class}", response.data?.target_class_name || selectedClassName),
      );
      setDeleteClassOpen(false);
      setImportSummary(null);
      await load();
      window.dispatchEvent(new CustomEvent("students-updated"));
    } catch (error) {
      toast.error(getLocalizedApiErrorMessage(error, t, "delete_failed"));
    } finally {
      setDeletingClass(false);
    }
  };

  const downloadTemplate = async () => {
    try {
      const response = await api.get("/students/import-template", {
        params: {
          school_section: "arabic",
          academic_year: academicYear,
          class_id: classId === "all" ? undefined : classId,
        },
        responseType: "blob",
      });
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "arabic_students_import_template.xlsx";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error?.response?.data?.detail || t("template_download_failed"));
    }
  };

  const importStudents = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (classId === "all") {
      toast.error(t("student_import_class_required"));
      return;
    }
    setImporting(true);
    setImportSummary(null);
    const params = { school_section: "arabic", academic_year: academicYear, class_id: classId };
    try {
      const result = await importStudentsWithPreview({
        api,
        file,
        params,
        confirmImport: (preview) => window.confirm(
          t("student_import_confirm")
            .replace("{count}", String(preview.processed_rows || 0))
            .replace("{class}", preview.target_class_name || classMap[classId] || ""),
        ),
      });
      if (result.cancelled) return;
      const response = result.data;
      setImportSummary(response);
      toast.success(
        t("student_import_summary")
          .replace("{created}", String(response.created_students || 0))
          .replace("{updated}", String(response.updated_students || 0))
          .replace("{classes}", String(response.created_classes || 0))
          .replace("{skipped}", String(response.skipped_rows || 0)),
      );
      if (response.repaired_students) {
        toast.success(
          t("student_import_repaired").replace("{count}", String(response.repaired_students)),
        );
      }
      await Promise.all([load(), loadClasses?.()]);
      window.dispatchEvent(new CustomEvent("students-updated"));
    } catch (error) {
      toast.error(getLocalizedApiErrorMessage(error, t) || t("student_import_failed"));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="arabic-students-page">
      <PageHeader
        title={t("student_management")}
        eyebrow={`${t("arabic_section")} · ${academicYear}`}
        description={t("arabic_grading_description")}
        testIdPrefix="arabic-students"
        action={
          <div className="flex flex-wrap gap-2">
            <input
              ref={importInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={importStudents}
              data-testid="arabic-students-import-input"
            />
            <Button variant="secondary" onClick={downloadTemplate} data-testid="arabic-students-template">
              <Download className="me-2 h-4 w-4" />{t("download_template")}
            </Button>
            <Button
              onClick={() => {
                if (classId === "all") {
                  toast.error(t("student_import_class_required"));
                  return;
                }
                importInputRef.current?.click();
              }}
              disabled={importing}
              className="active-glow"
              data-testid="arabic-students-import"
            >
              <Upload className="me-2 h-4 w-4" />
              {importing ? `${t("loading")}…` : t("import_students_excel")}
            </Button>
            <Button onClick={() => setOpen(true)} className="active-glow">{t("add_student")}</Button>
            {isAdmin && (
              <Button
                variant="destructive"
                onClick={() => {
                  if (classId === "all") {
                    toast.error(t("student_management_class_required"));
                    return;
                  }
                  setDeleteClassOpen(true);
                }}
                disabled={deletingClass || (classId !== "all" && loadedClassId !== classId)}
                data-testid="delete-class-students-button"
              >
                <Trash2 className="me-2 h-4 w-4" />{t("delete_class_students")}
              </Button>
            )}
          </div>
        }
      />
      {loadError ? <LoadErrorCard message={loadError} onRetry={load} t={t} testId="arabic-students-load-error" /> : <>
      {importSummary && (
        <div className="rounded-2xl border border-emerald-300/60 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-700/60 dark:bg-emerald-950/20 dark:text-emerald-100" data-testid="arabic-import-summary">
          {t("student_import_summary")
            .replace("{created}", String(importSummary.created_students || 0))
            .replace("{updated}", String(importSummary.updated_students || 0))
            .replace("{classes}", String(importSummary.created_classes || 0))
            .replace("{skipped}", String(importSummary.skipped_rows || 0))}
        </div>
      )}
      <Card className="premium-active-card"><CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6"><div><p className="text-sm text-muted-foreground">{t("total_students")}</p><p className="text-3xl font-bold">{students.length}</p></div><Select value={classId} onValueChange={setClassId}><SelectTrigger className="w-64"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{t("all_classes")}</SelectItem>{classes.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></CardContent></Card>
      {classId === "all" && <p className="text-sm text-amber-700 dark:text-amber-300" data-testid="arabic-import-class-required">{t("student_management_class_required")}</p>}
      <Card><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-[#10162A] text-white"><tr><th className="p-3 text-start">{t("student")}</th><th className="p-3 text-start">{t("class")}</th><th className="p-3 text-end">{t("actions")}</th></tr></thead><tbody>{students.map((student) => <tr key={student.id} className="border-b hover:bg-cyan-50/50 dark:hover:bg-cyan-950/10"><td className="p-3 font-medium">{student.full_name}</td><td className="p-3">{classMap[student.class_id] || student.class_name}</td><td className="p-3 text-end"><Button size="sm" variant="ghost" onClick={() => remove(student.id)}>{t("delete")}</Button></td></tr>)}</tbody></table></div>{!students.length && <p className="p-8 text-center text-muted-foreground">{t("no_data")}</p>}</CardContent></Card>
      <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>{t("add_student")}</DialogTitle></DialogHeader><div className="grid gap-4"><Input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder={t("full_name")} autoFocus /><Select value={newClassId} onValueChange={setNewClassId}><SelectTrigger><SelectValue placeholder={t("select_class")} /></SelectTrigger><SelectContent>{classes.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button><Button onClick={create}>{t("create")}</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={deleteClassOpen} onOpenChange={setDeleteClassOpen}>
        <DialogContent data-testid="delete-class-students-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive"><AlertTriangle className="h-5 w-5" />{t("delete_class_students")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t("delete_class_students_confirm")
              .replace("{count}", String(students.length))
              .replace("{class}", classMap[classId] || "")}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteClassOpen(false)} disabled={deletingClass}>{t("cancel")}</Button>
            <Button variant="destructive" onClick={deleteSelectedClassStudents} disabled={deletingClass} data-testid="delete-class-students-confirm">
              {deletingClass ? `${t("loading")}…` : t("delete_class_students")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </>}
    </div>
  );
}
