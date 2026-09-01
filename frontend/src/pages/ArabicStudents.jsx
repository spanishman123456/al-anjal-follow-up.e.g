import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useOutletContext } from "react-router-dom";
import {
  AlertTriangle, Award, Download, FileText, MessageCircle, MoreHorizontal, PartyPopper,
  Save, Sparkles, Trash2, Upload, UserRoundCog,
} from "lucide-react";
import { toast } from "sonner";
import { api, BACKEND_ROOT_URL, getApiErrorMessage, getLocalizedApiErrorMessage } from "@/lib/api";
import { useTranslations } from "@/lib/i18n";
import { displayQuarterNumber } from "@/lib/academicScope";
import { sortByClassOrder } from "@/lib/utils";
import { getRewardSetsFromStorage, setStudentReward } from "@/lib/studentRewardsStorage";
import { PageHeader } from "@/components/layout/PageHeader";
import { PerformanceLevelBadge } from "@/components/PerformanceLevelBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { LoadErrorCard } from "@/components/LoadErrorCard";
import { importStudentsWithPreview } from "@/lib/studentEnrollmentImport";
import { StudentScoreClearButton } from "@/components/StudentScoreClearButton";
import { RewardCelebration } from "@/components/RewardCelebration";

const CONTINUOUS_FIELDS = [
  { key: "performance_tasks", max: 10 },
  { key: "participation", max: 10 },
  { key: "interaction", max: 10 },
  { key: "attendance", max: 10 },
];

const semesterNumber = (semester) => (semester === "semester2" ? 2 : 1);
const weeksForQuarter = (quarter) => (Number(quarter) === 2
  ? Array.from({ length: 9 }, (_, index) => index + 10)
  : Array.from({ length: 9 }, (_, index) => index + 1));
const hasScore = (value) => value !== null && value !== undefined && value !== "";
const weeklyTotal = (values) => {
  if (!CONTINUOUS_FIELDS.some(({ key }) => hasScore(values?.[key]))) return null;
  return CONTINUOUS_FIELDS.reduce((sum, { key }) => sum + Number(values?.[key] || 0), 0);
};
const weeklyLevel = (values) => {
  const total = weeklyTotal(values);
  if (total === null) return "no_data";
  if (total >= (13 / 15) * 40) return "on_level";
  if (total >= (10 / 15) * 40) return "approach";
  return "below";
};

export default function ArabicStudents() {
  const {
    language, academicYear, semester = "semester1", quarter = 1,
    classes = [], loadClasses, profile,
  } = useOutletContext();
  const t = useTranslations(language);
  const certificateT = useTranslations("ar");
  const sem = semesterNumber(semester);
  const displayQuarter = displayQuarterNumber(semester, quarter);
  const weekNumbers = useMemo(() => weeksForQuarter(quarter), [quarter]);
  const [weekNumber, setWeekNumber] = useState(weekNumbers[0]);
  const [students, setStudents] = useState([]);
  const [values, setValues] = useState({});
  const [classId, setClassId] = useState(() => sessionStorage.getItem("arabic_students_class_id") || "all");
  const [search, setSearch] = useState("");
  const [performanceFilter, setPerformanceFilter] = useState("all");
  const [fillField, setFillField] = useState(CONTINUOUS_FIELDS[0].key);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [newClassId, setNewClassId] = useState("");
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState(null);
  const [deleteClassOpen, setDeleteClassOpen] = useState(false);
  const [deletingClass, setDeletingClass] = useState(false);
  const [loadedClassId, setLoadedClassId] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [promotionEnabled, setPromotionEnabled] = useState(false);
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [promoteFrom, setPromoteFrom] = useState("");
  const [promoteTo, setPromoteTo] = useState("");
  const [transferStudent, setTransferStudent] = useState(null);
  const [transferClassId, setTransferClassId] = useState("");
  const [certificateFor, setCertificateFor] = useState(null);
  const [rewardBusy, setRewardBusy] = useState(false);
  const [rewardSets, setRewardSets] = useState(() => getRewardSetsFromStorage());
  const [badgeGlowStudentIds, setBadgeGlowStudentIds] = useState(new Set());
  const [celebration, setCelebration] = useState(null);
  const [, startTransition] = useTransition();
  const importInputRef = useRef(null);
  const latestLoadRequestRef = useRef(0);
  const loadAbortRef = useRef(null);
  const responseCacheRef = useRef(new Map());

  useEffect(() => { setWeekNumber(weekNumbers[0]); }, [weekNumbers]);

  const load = useCallback(async () => {
    const requestId = ++latestLoadRequestRef.current;
    loadAbortRef.current?.abort();
    const controller = new AbortController();
    loadAbortRef.current = controller;
    const cacheKey = `${academicYear}|${sem}|${quarter}|${weekNumber}|${classId}`;
    const cachedRows = responseCacheRef.current.get(cacheKey);
    if (cachedRows) {
      startTransition(() => {
        setStudents(cachedRows);
        setValues(Object.fromEntries(cachedRows.map((student) => [
          student.id,
          Object.fromEntries(CONTINUOUS_FIELDS.map(({ key }) => [key, student[key] ?? null])),
        ])));
        setLoadedClassId(classId);
      });
    }
    setLoading(true);
    setLoadError("");
    try {
      const response = await api.get("/arabic/weekly-scores", {
        params: {
          academic_year: academicYear,
          semester: sem,
          quarter,
          week_number: weekNumber,
          class_id: classId === "all" ? undefined : classId,
        },
        signal: controller.signal,
      });
      if (latestLoadRequestRef.current !== requestId) return;
      const rows = response.data?.students || [];
      if (responseCacheRef.current.size > 12) responseCacheRef.current.clear();
      responseCacheRef.current.set(cacheKey, rows);
      startTransition(() => {
        setStudents(rows);
        setValues(Object.fromEntries(rows.map((student) => [
          student.id,
          Object.fromEntries(CONTINUOUS_FIELDS.map(({ key }) => [key, student[key] ?? null])),
        ])));
        setLoadedClassId(classId);
      });
    } catch (error) {
      if (controller.signal.aborted || latestLoadRequestRef.current !== requestId) return;
      const message = getLocalizedApiErrorMessage(error, t);
      setStudents([]);
      setValues({});
      setLoadedClassId(classId);
      setLoadError(message);
      toast.error(message);
    } finally {
      if (latestLoadRequestRef.current === requestId) setLoading(false);
    }
  }, [academicYear, classId, quarter, sem, startTransition, t, weekNumber]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => () => loadAbortRef.current?.abort(), []);
  useEffect(() => {
    if (classId === "all" || classes.some((item) => item.id === classId)) return;
    setClassId("all");
    sessionStorage.setItem("arabic_students_class_id", "all");
  }, [classId, classes]);
  useEffect(() => {
    api.get("/settings/promotion")
      .then((response) => setPromotionEnabled(Boolean(response.data?.enabled)))
      .catch(() => setPromotionEnabled(false));
  }, []);

  const classMap = useMemo(() => Object.fromEntries(classes.map((item) => [item.id, item.name])), [classes]);
  const sortedClasses = useMemo(() => sortByClassOrder(classes), [classes]);
  const isAdmin = String(profile?.role_name || "").toLowerCase() === "admin";
  const filteredStudents = useMemo(() => students.filter((student) => {
    const matchesSearch = !search.trim() || String(student.full_name || "").toLowerCase().includes(search.trim().toLowerCase());
    const level = weeklyLevel(values[student.id]);
    return matchesSearch && (performanceFilter === "all" || level === performanceFilter);
  }), [performanceFilter, search, students, values]);

  const updateScore = (studentId, key, raw, max) => {
    const parsed = raw === "" ? null : Number(raw);
    const next = Number.isFinite(parsed) ? Math.min(max, Math.max(0, parsed)) : null;
    setValues((previous) => ({ ...previous, [studentId]: { ...previous[studentId], [key]: next } }));
  };

  const saveScores = async () => {
    setSaving(true);
    try {
      await api.post("/arabic/weekly-scores/bulk", {
        academic_year: academicYear,
        semester: sem,
        quarter,
        week_number: weekNumber,
        updates: students.map((student) => ({ student_id: student.id, ...values[student.id] })),
      });
      toast.success(t("grades_saved"));
      window.dispatchEvent(new CustomEvent("students-updated"));
      await load();
    } catch (error) {
      toast.error(getLocalizedApiErrorMessage(error, t, "grades_save_failed"));
    } finally {
      setSaving(false);
    }
  };

  const fillSelectedClassMaximum = () => {
    if (classId === "all") {
      toast.error(t("select_class_to_clear_scores"));
      return;
    }
    if (!students.length) {
      toast.error(t("no_data"));
      return;
    }
    setValues((previous) => {
      const next = { ...previous };
      students.forEach((student) => {
        next[student.id] = { ...next[student.id], [fillField]: 10 };
      });
      return next;
    });
    toast.success(t("fill_max_completed"));
  };

  const clearSelectedClassScores = async () => {
    if (classId === "all") {
      toast.error(t("select_class_to_clear_scores"));
      return;
    }
    if (!students.length || !window.confirm(t("clear_selected_class_scores_confirm"))) return;
    try {
      await api.post("/arabic/weekly-scores/bulk", {
        academic_year: academicYear,
        semester: sem,
        quarter,
        week_number: weekNumber,
        updates: students.map((student) => ({
          student_id: student.id,
          performance_tasks: null,
          participation: null,
          interaction: null,
          attendance: null,
        })),
      });
      toast.success(t("scores_cleared"));
      await load();
      window.dispatchEvent(new CustomEvent("students-updated"));
    } catch (error) {
      toast.error(getLocalizedApiErrorMessage(error, t, "grades_save_failed"));
    }
  };

  const clearStudentScores = async (student) => {
    if (!window.confirm(t("clear_student_scores_confirm").replace("{student}", student.full_name || ""))) return;
    try {
      await api.post("/arabic/weekly-scores/bulk", {
        academic_year: academicYear,
        semester: sem,
        quarter,
        week_number: weekNumber,
        updates: [{
          student_id: student.id,
          performance_tasks: null,
          participation: null,
          interaction: null,
          attendance: null,
        }],
      });
      toast.success(t("student_scores_cleared"));
      await load();
      window.dispatchEvent(new CustomEvent("students-updated"));
    } catch (error) {
      toast.error(getLocalizedApiErrorMessage(error, t, "grades_save_failed"));
    }
  };

  const create = async () => {
    if (!fullName.trim() || !newClassId) return;
    try {
      await api.post("/students", {
        full_name: fullName.trim(), class_id: newClassId,
        school_section: "arabic", academic_year: academicYear,
      });
      toast.success(t("student_added"));
      setOpen(false); setFullName(""); setNewClassId("");
      await load();
      window.dispatchEvent(new CustomEvent("students-updated"));
    } catch (error) { toast.error(error?.response?.data?.detail || t("student_add_failed")); }
  };

  const remove = async (student) => {
    if (!window.confirm(t("confirm_delete"))) return;
    try {
      await api.delete(`/students/${student.id}`);
      await load();
      window.dispatchEvent(new CustomEvent("students-updated"));
    } catch { toast.error(t("delete_failed")); }
  };

  const transfer = async () => {
    if (!transferStudent || !transferClassId) return;
    try {
      await api.post(`/students/${transferStudent.id}/transfer`, { class_id: transferClassId });
      toast.success(t("student_transferred"));
      setTransferStudent(null); setTransferClassId("");
      await load();
      window.dispatchEvent(new CustomEvent("students-updated"));
    } catch (error) { toast.error(getLocalizedApiErrorMessage(error, t, "transfer_failed")); }
  };

  const promote = async () => {
    if (!promoteFrom || !promoteTo || promoteFrom === promoteTo) return;
    try {
      await api.post("/students/promote", { from_class_id: promoteFrom, to_class_id: promoteTo });
      toast.success(t("promotion_success"));
      setPromoteOpen(false); setPromoteFrom(""); setPromoteTo("");
      await load();
      window.dispatchEvent(new CustomEvent("students-updated"));
    } catch (error) { toast.error(getLocalizedApiErrorMessage(error, t, "promotion_fail")); }
  };

  const toggleReward = async (student, type) => {
    const key = String(student.id);
    const current = rewardSets[type].has(key);
    if (type === "badge") {
      const level = weeklyLevel(values[student.id]);
      if (!current && level !== "on_level") {
        toast.error(t("badge_requires_on_level"));
        return;
      }
      setRewardBusy(true);
      try {
        const response = await api.post(current ? "/rewards/remove-badge" : "/rewards/award-badge", current
          ? { student_id: student.id }
          : {
            student_id: student.id,
            student_name: student.full_name,
            performance: "on_level",
            school_section: "arabic",
            lang: "ar",
          });
        setStudentReward(student.id, type, !current);
        setRewardSets((previous) => {
          const next = { ...previous, [type]: new Set(previous[type]) };
          if (current) next[type].delete(key);
          else next[type].add(key);
          return next;
        });
        if (!current) {
          setBadgeGlowStudentIds((previous) => new Set([...previous, key]));
          setCelebration({
            id: `${Date.now()}-${key}`,
            studentName: student.full_name,
            origin: { x: 0.5, y: 0.42 },
            dir: "rtl",
          });
          window.setTimeout(() => setCelebration(null), 3400);
          window.setTimeout(() => setBadgeGlowStudentIds((previous) => {
            const next = new Set(previous);
            next.delete(key);
            return next;
          }), 2600);
          const audioEl = document.getElementById("reward-sound");
          if (audioEl?.play) {
            audioEl.currentTime = 0;
            audioEl.play().catch(() => null);
          }
          if (navigator?.vibrate) navigator.vibrate([80, 40, 120]);
        }
        const certificateUrl = response?.data?.certificate_url;
        if (!current && certificateUrl) {
          window.open(certificateUrl.startsWith("http") ? certificateUrl : `${BACKEND_ROOT_URL}${certificateUrl}`, "_blank", "noopener,noreferrer");
        }
      } catch (error) {
        toast.error(getApiErrorMessage(error) || t("student_action_failed"));
        return;
      } finally { setRewardBusy(false); }
    } else {
      setStudentReward(student.id, type, !current);
      setRewardSets((previous) => {
        const next = { ...previous, [type]: new Set(previous[type]) };
        if (current) next[type].delete(key);
        else next[type].add(key);
        return next;
      });
      if (type === "certificate" && !current) {
        setCertificateFor({ student_name: student.full_name, class_name: classMap[student.class_id] || student.class_name || "" });
      }
    }
    toast.success(t(current ? "student_action_removed" : "student_action_added"));
  };

  const deleteSelectedClassStudents = async () => {
    if (classId === "all" || !isAdmin) return;
    setDeletingClass(true);
    try {
      const response = await api.delete("/students", {
        params: { school_section: "arabic", academic_year: academicYear, class_id: classId },
      });
      toast.success(t("class_students_deleted")
        .replace("{count}", String(response.data?.students_deleted || 0))
        .replace("{class}", response.data?.target_class_name || classMap[classId] || ""));
      setDeleteClassOpen(false); setImportSummary(null);
      await load();
      window.dispatchEvent(new CustomEvent("students-updated"));
    } catch (error) { toast.error(getLocalizedApiErrorMessage(error, t, "delete_failed")); }
    finally { setDeletingClass(false); }
  };

  const downloadTemplate = async () => {
    try {
      const response = await api.get("/students/import-template", {
        params: { school_section: "arabic", academic_year: academicYear, class_id: classId === "all" ? undefined : classId },
        responseType: "blob",
      });
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = "arabic_students_import_template.xlsx"; anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) { toast.error(error?.response?.data?.detail || t("template_download_failed")); }
  };

  const importStudents = async (event) => {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file) return;
    if (classId === "all") { toast.error(t("student_import_class_required")); return; }
    setImporting(true); setImportSummary(null);
    const params = { school_section: "arabic", academic_year: academicYear, class_id: classId };
    try {
      const result = await importStudentsWithPreview({
        api, file, params,
        confirmImport: (preview) => window.confirm(t("student_import_confirm")
          .replace("{count}", String(preview.processed_rows || 0))
          .replace("{class}", preview.target_class_name || classMap[classId] || "")),
      });
      if (result.cancelled) return;
      setImportSummary(result.data);
      toast.success(t("student_import_summary")
        .replace("{created}", String(result.data.created_students || 0))
        .replace("{updated}", String(result.data.updated_students || 0))
        .replace("{classes}", String(result.data.created_classes || 0))
        .replace("{skipped}", String(result.data.skipped_rows || 0)));
      await Promise.all([load(), loadClasses?.()]);
      window.dispatchEvent(new CustomEvent("students-updated"));
    } catch (error) { toast.error(getLocalizedApiErrorMessage(error, t) || t("student_import_failed")); }
    finally { setImporting(false); }
  };

  return (
    <div className="space-y-6" data-testid="arabic-students-page">
      <PageHeader
        title={t("student_management")}
        eyebrow={`${t("arabic_section")} · ${academicYear} · Q${displayQuarter}`}
        description={t("arabic_weekly_management_description")}
        badges={[t("arabic_weekly_40"), t("arabic_quarter_week_range").replace("{range}", `${weekNumbers[0]}-${weekNumbers[8]}`)]}
        testIdPrefix="arabic-students"
        action={<div className="flex flex-wrap gap-2">
          <input ref={importInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={importStudents} data-testid="arabic-students-import-input" />
          <Button variant="secondary" onClick={downloadTemplate} data-testid="arabic-students-template"><Download className="me-2 h-4 w-4" />{t("download_template")}</Button>
          <Button onClick={() => classId === "all" ? toast.error(t("student_import_class_required")) : importInputRef.current?.click()} disabled={importing} data-testid="arabic-students-import"><Upload className="me-2 h-4 w-4" />{importing ? `${t("loading")}…` : t("import_students_excel")}</Button>
          <Button onClick={() => setOpen(true)}>{t("add_student")}</Button>
          {isAdmin && <Button variant="destructive" onClick={() => classId === "all" ? toast.error(t("student_management_class_required")) : setDeleteClassOpen(true)} disabled={deletingClass || (classId !== "all" && loadedClassId !== classId)} data-testid="delete-class-students-button"><Trash2 className="me-2 h-4 w-4" />{t("delete_class_students")}</Button>}
        </div>}
      />

      {loadError ? <LoadErrorCard message={loadError} onRetry={load} t={t} testId="arabic-students-load-error" /> : <>
        {importSummary && <div className="rounded-2xl border border-emerald-300/60 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-700/60 dark:bg-emerald-950/20 dark:text-emerald-100" data-testid="arabic-import-summary">{t("student_import_summary").replace("{created}", String(importSummary.created_students || 0)).replace("{updated}", String(importSummary.updated_students || 0)).replace("{classes}", String(importSummary.created_classes || 0)).replace("{skipped}", String(importSummary.skipped_rows || 0))}</div>}

        <Card className="premium-active-card"><CardContent className="grid gap-4 pt-6 md:grid-cols-2 xl:grid-cols-6">
          <Select value={String(weekNumber)} onValueChange={(value) => setWeekNumber(Number(value))}><SelectTrigger data-testid="arabic-week-filter"><SelectValue /></SelectTrigger><SelectContent>{weekNumbers.map((week) => <SelectItem key={week} value={String(week)}>{t("week")} {week}</SelectItem>)}</SelectContent></Select>
          <Select value={classId} onValueChange={(value) => { sessionStorage.setItem("arabic_students_class_id", value); setClassId(value); }}><SelectTrigger data-testid="arabic-class-filter"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{t("all_classes")}</SelectItem>{sortedClasses.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select>
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("search_students")} />
          <Select value={performanceFilter} onValueChange={setPerformanceFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{t("performance_filter")}</SelectItem><SelectItem value="on_level">{t("on_level")}</SelectItem><SelectItem value="approach">{t("approach")}</SelectItem><SelectItem value="below">{t("below")}</SelectItem><SelectItem value="no_data">{t("no_data")}</SelectItem></SelectContent></Select>
          {isAdmin && <Button variant="secondary" onClick={() => setPromoteOpen(true)} disabled={!promotionEnabled} data-testid="arabic-promote-button"><UserRoundCog className="me-2 h-4 w-4" />{t("promote_students")}</Button>}
          <Button onClick={saveScores} disabled={saving || loading || !students.length} className="active-glow" data-testid="arabic-weekly-save"><Save className="me-2 h-4 w-4" />{saving ? `${t("loading")}…` : loading ? `${t("loading")}…` : t("save_all_scores")}</Button>
        </CardContent></Card>

        <Card data-testid="arabic-weekly-smart-tools"><CardContent className="flex flex-wrap items-center gap-3 pt-6">
          <Select value={fillField} onValueChange={setFillField}><SelectTrigger className="w-full sm:w-[260px]" data-testid="arabic-weekly-fill-field"><SelectValue /></SelectTrigger><SelectContent>{CONTINUOUS_FIELDS.map(({ key }) => <SelectItem key={key} value={key}>{t(key)} /10</SelectItem>)}</SelectContent></Select>
          <Button type="button" variant="secondary" onClick={fillSelectedClassMaximum} disabled={classId === "all" || loading || !students.length} data-testid="arabic-weekly-fill-max"><Sparkles className="me-2 h-4 w-4" />{t("fill_max_selected_class")}</Button>
          <Button type="button" variant="destructive" onClick={clearSelectedClassScores} disabled={classId === "all" || loading || !students.length} data-testid="arabic-weekly-clear-class"><Trash2 className="me-2 h-4 w-4" />{t("clear_selected_class_scores")}</Button>
          <p className="basis-full text-xs text-muted-foreground">{t("fill_max_selected_class_hint")}</p>
        </CardContent></Card>

        <Card><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full min-w-[1220px] text-sm"><thead className="bg-[#10162A] text-white"><tr><th className="sticky start-0 z-10 bg-[#10162A] p-3 text-start">{t("student")}</th><th className="p-3 text-start">{t("class")}</th>{CONTINUOUS_FIELDS.map(({ key }) => <th key={key} className="p-3 text-center">{t(key)} /10</th>)}<th className="p-3 text-center">{t("weekly_total")} /40</th><th className="p-3 text-center">{t("quarter_average")} /40</th><th className="p-3 text-center">{t("performance_level")}</th><th className="p-3 text-center">{t("actions")}</th></tr></thead><tbody>{filteredStudents.map((student) => {
          const current = values[student.id] || {};
          const total = weeklyTotal(current);
          const level = weeklyLevel(current);
          const studentKey = String(student.id);
          const rewards = {
            badge: rewardSets.badge.has(studentKey),
            certificate: rewardSets.certificate.has(studentKey),
            comment: rewardSets.comment.has(studentKey),
          };
          return <tr key={student.id} className="border-b hover:bg-cyan-50/50 dark:hover:bg-cyan-950/10" data-testid={`arabic-student-row-${student.id}`}><td className="sticky start-0 bg-background p-3 font-semibold"><span className="inline-flex flex-wrap items-center gap-2">{student.full_name}{rewards.badge && <span className={`badge-party-popper reward-badge-btn group inline-flex items-center gap-1.5 rounded-full border-2 border-amber-400/60 bg-gradient-to-r from-amber-200 via-amber-100 to-rose-200 px-2.5 py-1 text-xs font-semibold text-amber-900 shadow-sm transition-all duration-200 hover:scale-105 dark:border-amber-500/50 dark:from-amber-700/40 dark:via-amber-600/30 dark:to-rose-700/40 dark:text-amber-100 ${badgeGlowStudentIds.has(studentKey) ? "reward-glow" : ""}`} data-testid={`arabic-student-badge-${student.id}`}><PartyPopper className="h-4 w-4 shrink-0" /><span>{certificateT("badge")}</span></span>}{rewards.certificate && <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-1 text-xs font-medium text-sky-700 dark:bg-sky-900/50 dark:text-sky-300"><FileText className="h-3.5 w-3.5" />{certificateT("certificate")}</span>}{rewards.comment && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"><MessageCircle className="h-3.5 w-3.5" />{certificateT("comment")}</span>}</span></td><td className="p-3">{classMap[student.class_id] || student.class_name}</td>{CONTINUOUS_FIELDS.map(({ key, max }) => <td key={key} className="p-2"><Input type="number" min="0" max={max} step="0.5" value={current[key] ?? ""} disabled={loading} onChange={(event) => updateScore(student.id, key, event.target.value, max)} placeholder="0-10" aria-label={`${student.full_name} ${t(key)}`} /></td>)}<td className="p-3 text-center font-bold">{total === null ? "—" : `${Number(total.toFixed(1))}/40`}</td><td className="p-3 text-center"><p className="font-bold text-violet-700 dark:text-violet-300">{student.quarter_continuous_average == null ? "—" : `${student.quarter_continuous_average}/40`}</p><p className="text-xs text-muted-foreground">{t("weeks_recorded").replace("{count}", String(student.weeks_with_scores || 0))}</p></td><td className="p-3 text-center"><PerformanceLevelBadge level={level} label={t(level)} /></td><td className="p-3 text-center"><div className="flex items-center justify-center gap-2"><StudentScoreClearButton t={t} studentName={student.full_name} onClear={() => clearStudentScores(student)} testId={`arabic-weekly-clear-student-${student.id}`} /><DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="icon" data-testid={`arabic-student-actions-${student.id}`}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem disabled={rewardBusy} onClick={() => toggleReward(student, "badge")}><Award className="me-2 h-4 w-4" />{rewards.badge ? t("remove_badge") : t("badge")}</DropdownMenuItem><DropdownMenuItem onClick={() => toggleReward(student, "certificate")}><FileText className="me-2 h-4 w-4" />{t("certificate")}</DropdownMenuItem><DropdownMenuItem onClick={() => toggleReward(student, "comment")}><MessageCircle className="me-2 h-4 w-4" />{t("comment")}</DropdownMenuItem>{isAdmin && <><DropdownMenuSeparator /><DropdownMenuItem onClick={() => { setTransferStudent(student); setTransferClassId(""); }}><UserRoundCog className="me-2 h-4 w-4" />{t("transfer_student")}</DropdownMenuItem><DropdownMenuItem className="text-destructive" onClick={() => remove(student)}><Trash2 className="me-2 h-4 w-4" />{t("delete_student")}</DropdownMenuItem></>}</DropdownMenuContent></DropdownMenu></div></td></tr>;
        })}</tbody></table></div>{!loading && !filteredStudents.length && <p className="p-8 text-center text-muted-foreground">{t("no_data")}</p>}</CardContent></Card>

        <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>{t("add_student")}</DialogTitle></DialogHeader><div className="grid gap-4"><Input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder={t("full_name")} autoFocus /><Select value={newClassId} onValueChange={setNewClassId}><SelectTrigger><SelectValue placeholder={t("select_class")} /></SelectTrigger><SelectContent>{sortedClasses.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button><Button onClick={create}>{t("create")}</Button></DialogFooter></DialogContent></Dialog>

        <Dialog open={promoteOpen} onOpenChange={setPromoteOpen}><DialogContent data-testid="arabic-promote-dialog"><DialogHeader><DialogTitle>{t("promote_students")}</DialogTitle><DialogDescription>{t("arabic_promotion_hint")}</DialogDescription></DialogHeader><div className="grid gap-4"><Select value={promoteFrom} onValueChange={setPromoteFrom}><SelectTrigger><SelectValue placeholder={t("promotion_from_class")} /></SelectTrigger><SelectContent>{sortedClasses.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select><Select value={promoteTo} onValueChange={setPromoteTo}><SelectTrigger><SelectValue placeholder={t("promotion_to_class")} /></SelectTrigger><SelectContent>{sortedClasses.filter((item) => item.id !== promoteFrom).map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div><DialogFooter><Button variant="outline" onClick={() => setPromoteOpen(false)}>{t("cancel")}</Button><Button onClick={promote} disabled={!promoteFrom || !promoteTo}>{t("confirm")}</Button></DialogFooter></DialogContent></Dialog>

        <Dialog open={Boolean(transferStudent)} onOpenChange={() => setTransferStudent(null)}><DialogContent><DialogHeader><DialogTitle>{t("transfer_student")}</DialogTitle><DialogDescription>{transferStudent?.full_name}</DialogDescription></DialogHeader><Select value={transferClassId} onValueChange={setTransferClassId}><SelectTrigger><SelectValue placeholder={t("select_class")} /></SelectTrigger><SelectContent>{sortedClasses.filter((item) => item.id !== transferStudent?.class_id).map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select><DialogFooter><Button variant="outline" onClick={() => setTransferStudent(null)}>{t("cancel")}</Button><Button onClick={transfer} disabled={!transferClassId}>{t("confirm")}</Button></DialogFooter></DialogContent></Dialog>

        <Dialog open={Boolean(certificateFor)} onOpenChange={(nextOpen) => !nextOpen && setCertificateFor(null)}><DialogContent className="max-w-lg overflow-hidden p-0" data-testid="arabic-certificate-dialog"><div dir="rtl" lang="ar" className="rounded-lg border-2 border-amber-400/60 bg-gradient-to-b from-amber-50 to-amber-100/50 p-8 text-center dark:from-amber-950/30 dark:to-amber-900/20"><Award className="mx-auto mb-4 h-12 w-12 text-amber-600" /><p className="text-xs tracking-[0.18em] text-amber-700 dark:text-amber-300">{certificateT("certificate_of_achievement")}</p><h2 className="mt-3 text-xl font-bold">{certificateT("this_is_to_certify")}</h2><p className="mx-auto mt-4 inline-block border-b-2 border-amber-500/50 pb-2 text-2xl font-bold">{certificateFor?.student_name}</p><p className="mt-2 text-sm text-muted-foreground">{certificateFor?.class_name}</p><p className="mt-5 font-medium text-amber-800 dark:text-amber-200">{certificateT("outstanding_effort")}</p><p className="mt-6 text-xs text-muted-foreground">{certificateT("presented_with_appreciation")}</p></div></DialogContent></Dialog>

        <Dialog open={deleteClassOpen} onOpenChange={setDeleteClassOpen}><DialogContent data-testid="delete-class-students-dialog"><DialogHeader><DialogTitle className="flex items-center gap-2 text-destructive"><AlertTriangle className="h-5 w-5" />{t("delete_class_students")}</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">{t("delete_class_students_confirm").replace("{count}", String(students.length)).replace("{class}", classMap[classId] || "")}</p><DialogFooter><Button variant="outline" onClick={() => setDeleteClassOpen(false)} disabled={deletingClass}>{t("cancel")}</Button><Button variant="destructive" onClick={deleteSelectedClassStudents} disabled={deletingClass} data-testid="delete-class-students-confirm">{deletingClass ? `${t("loading")}…` : t("delete_class_students")}</Button></DialogFooter></DialogContent></Dialog>
      </>}
      <RewardCelebration
        celebration={celebration}
        title={certificateT("reward_celebration_title")}
        subtitle={certificateT("reward_celebration_subtitle")}
      />
    </div>
  );
}
