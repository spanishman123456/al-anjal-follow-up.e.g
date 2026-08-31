import { useCallback, useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { AlertTriangle, Download, FileSearch, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { api, getLocalizedApiErrorMessage } from "@/lib/api";
import { useTranslations } from "@/lib/i18n";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const sourceKey = (source) => `${source.source_type}::${source.source_id || ""}`;

function parseSourceKey(value) {
  const [sourceType, sourceId = ""] = String(value || "").split("::");
  return { sourceType, sourceId: sourceId || null };
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function RemedialPlans() {
  const { language, semester, quarter, schoolSection, academicYear, profile } = useOutletContext();
  const t = useTranslations(language);
  const semesterNumber = semester === "semester2" ? 2 : 1;
  const quarterNumber = Number(quarter) || 1;
  const isArabic = language === "ar";
  const [sources, setSources] = useState([]);
  const [classes, setClasses] = useState([]);
  const [selectedSourceKey, setSelectedSourceKey] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("all");
  const [snapshot, setSnapshot] = useState(null);
  const [loadingSources, setLoadingSources] = useState(true);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [form, setForm] = useState({
    subject: "",
    skillWeakness: "",
    remedialPlanDate: "",
    department: "",
    teacherName: "",
    supervisorName: "",
  });

  useEffect(() => {
    setForm((current) => ({
      ...current,
      department: current.department || (schoolSection === "arabic" ? t("remedial_default_department_ar") : t("remedial_default_department_en")),
      teacherName: current.teacherName || profile?.name || profile?.full_name || profile?.username || "",
    }));
  }, [profile, schoolSection, t]);

  const selectedSource = useMemo(
    () => sources.find((item) => sourceKey(item) === selectedSourceKey) || null,
    [selectedSourceKey, sources]
  );
  const availableClasses = useMemo(() => {
    const allowed = new Set(selectedSource?.class_ids || []);
    return allowed.size ? classes.filter((item) => allowed.has(item.id)) : classes;
  }, [classes, selectedSource]);

  useEffect(() => {
    if (selectedClassId !== "all" && !availableClasses.some((item) => item.id === selectedClassId)) {
      setSelectedClassId("all");
    }
  }, [availableClasses, selectedClassId]);

  const loadSources = useCallback(async () => {
    setLoadingSources(true);
    setSnapshot(null);
    try {
      const response = await api.get("/remedial-reports/sources", {
        params: { school_section: schoolSection, academic_year: academicYear, semester: semesterNumber, quarter: quarterNumber },
      });
      const nextSources = response.data?.sources || [];
      setSources(nextSources);
      setClasses(response.data?.classes || []);
      setSelectedClassId("all");
      setSelectedSourceKey((current) => nextSources.some((item) => sourceKey(item) === current) ? current : (nextSources[0] ? sourceKey(nextSources[0]) : ""));
    } catch (error) {
      toast.error(getLocalizedApiErrorMessage(error, t, "remedial_load_failed"));
      setSources([]);
      setClasses([]);
      setSelectedSourceKey("");
    } finally {
      setLoadingSources(false);
    }
  }, [academicYear, quarterNumber, schoolSection, semesterNumber, t]);

  useEffect(() => { loadSources(); }, [loadSources]);

  const loadPreview = useCallback(async () => {
    if (!selectedSourceKey) {
      setSnapshot(null);
      return;
    }
    const { sourceType, sourceId } = parseSourceKey(selectedSourceKey);
    setLoadingPreview(true);
    try {
      const response = await api.get("/remedial-reports/preview", {
        params: {
          source_type: sourceType,
          source_id: sourceId || undefined,
          school_section: schoolSection,
          academic_year: academicYear,
          semester: semesterNumber,
          quarter: quarterNumber,
          class_id: selectedClassId === "all" ? undefined : selectedClassId,
          lang: language,
        },
      });
      setSnapshot(response.data);
    } catch (error) {
      setSnapshot(null);
      toast.error(getLocalizedApiErrorMessage(error, t, "remedial_preview_failed"));
    } finally {
      setLoadingPreview(false);
    }
  }, [academicYear, language, quarterNumber, schoolSection, selectedClassId, selectedSourceKey, semesterNumber, t]);

  useEffect(() => { loadPreview(); }, [loadPreview]);

  useEffect(() => {
    const refresh = () => loadSources();
    const onVisibility = () => document.visibilityState === "visible" && loadPreview();
    window.addEventListener("app-refresh-data", refresh);
    window.addEventListener("students-updated", refresh);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("app-refresh-data", refresh);
      window.removeEventListener("students-updated", refresh);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [loadPreview, loadSources]);

  const handleExport = async () => {
    if (!snapshot?.students?.length) {
      toast.error(t("remedial_no_weak_students"));
      return;
    }
    if (!form.subject.trim() || !form.skillWeakness.trim() || !form.remedialPlanDate.trim()) {
      toast.error(t("remedial_required_fields"));
      return;
    }
    const { sourceType, sourceId } = parseSourceKey(selectedSourceKey);
    setExporting(true);
    try {
      const response = await api.post("/remedial-reports/export.pdf", {
        source_type: sourceType,
        source_id: sourceId,
        school_section: schoolSection,
        academic_year: academicYear,
        semester: semesterNumber,
        quarter: quarterNumber,
        class_id: selectedClassId === "all" ? null : selectedClassId,
        lang: language,
        snapshot_id: snapshot.snapshot_id,
        subject: form.subject.trim(),
        skill_weakness: form.skillWeakness.trim(),
        remedial_plan_date: form.remedialPlanDate.trim(),
        department: form.department.trim() || null,
        teacher_name: form.teacherName.trim() || null,
        supervisor_name: form.supervisorName.trim() || null,
      }, { responseType: "blob" });
      downloadBlob(response.data, `${schoolSection}-remedial-${academicYear}.pdf`);
      toast.success(t("remedial_export_success"));
    } catch (error) {
      if (error?.response?.data instanceof Blob) {
        try {
          const parsed = JSON.parse(await error.response.data.text());
          const translated = t(parsed.detail);
          toast.error(translated === parsed.detail ? parsed.detail : translated);
        } catch {
          toast.error(t("remedial_export_failed"));
        }
      } else {
        toast.error(getLocalizedApiErrorMessage(error, t, "remedial_export_failed"));
      }
    } finally {
      setExporting(false);
    }
  };

  const maxLabel = snapshot?.source?.maximum ?? selectedSource?.maximum ?? "—";
  const thresholdLabel = snapshot?.source?.threshold ?? (selectedSource?.maximum ? selectedSource.maximum / 2 : "—");

  return (
    <div className="space-y-8" data-testid="remedial-page">
      <PageHeader
        pageKey="remedial_plans"
        testIdPrefix="remedial"
        badges={[t("remedial_strict_below_50"), schoolSection === "arabic" ? t("arabic_section") : t("international_section")]}
        action={
          <Button onClick={handleExport} disabled={exporting || loadingPreview || !snapshot?.students?.length} data-testid="remedial-export-pdf">
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {t("remedial_export_pdf")}
          </Button>
        }
      />

      <Card data-testid="remedial-source-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileSearch className="h-5 w-5 text-cyan-500" />{t("remedial_choose_assessment")}</CardTitle>
          <CardDescription>{t("remedial_source_help")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="remedial-source-select">{t("remedial_assessment_source")}</label>
            <Select value={selectedSourceKey} onValueChange={setSelectedSourceKey} disabled={loadingSources || !sources.length}>
              <SelectTrigger id="remedial-source-select" data-testid="remedial-source-select"><SelectValue placeholder={loadingSources ? t("loading") : t("remedial_select_source")} /></SelectTrigger>
              <SelectContent>
                {sources.map((source) => <SelectItem key={sourceKey(source)} value={sourceKey(source)}>{isArabic ? source.label_ar : source.label_en} ({source.maximum})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="remedial-class-select">{t("class_name")}</label>
            <Select value={selectedClassId} onValueChange={setSelectedClassId} disabled={loadingSources}>
              <SelectTrigger id="remedial-class-select" data-testid="remedial-class-select"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("all_classes")}</SelectItem>
                {availableClasses.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-4" data-testid="remedial-metrics">
        {[
          [t("remedial_scored_students"), snapshot?.stats?.scored ?? "—"],
          [t("remedial_below_50_students"), snapshot?.stats?.below_50 ?? "—"],
          [t("remedial_threshold"), `${thresholdLabel} / ${maxLabel}`],
          [t("remedial_assessment_max"), maxLabel],
        ].map(([label, value]) => (
          <Card key={label}><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{label}</CardTitle></CardHeader><CardContent><div className="text-2xl font-semibold">{loadingPreview ? "…" : value}</div></CardContent></Card>
        ))}
      </section>

      <Card data-testid="remedial-report-details-card">
        <CardHeader><CardTitle>{t("remedial_report_details")}</CardTitle><CardDescription>{t("remedial_manual_fields_help")}</CardDescription></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2"><label className="text-sm font-medium" htmlFor="remedial-subject">{t("remedial_subject")}</label><Input id="remedial-subject" value={form.subject} onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))} data-testid="remedial-subject" /></div>
          <div className="space-y-2"><label className="text-sm font-medium" htmlFor="remedial-date">{t("remedial_plan_date")}</label><Input id="remedial-date" type="date" value={form.remedialPlanDate} onChange={(event) => setForm((current) => ({ ...current, remedialPlanDate: event.target.value }))} data-testid="remedial-plan-date" /></div>
          <div className="space-y-2 md:col-span-2"><label className="text-sm font-medium" htmlFor="remedial-weakness">{t("remedial_skill_weakness")}</label><Textarea id="remedial-weakness" value={form.skillWeakness} onChange={(event) => setForm((current) => ({ ...current, skillWeakness: event.target.value }))} rows={3} data-testid="remedial-skill-weakness" /></div>
          <div className="space-y-2"><label className="text-sm font-medium" htmlFor="remedial-department">{t("remedial_department")}</label><Input id="remedial-department" value={form.department} onChange={(event) => setForm((current) => ({ ...current, department: event.target.value }))} /></div>
          <div className="space-y-2"><label className="text-sm font-medium" htmlFor="remedial-teacher">{t("teacher")}</label><Input id="remedial-teacher" value={form.teacherName} onChange={(event) => setForm((current) => ({ ...current, teacherName: event.target.value }))} /></div>
          <div className="space-y-2 md:col-span-2"><label className="text-sm font-medium" htmlFor="remedial-supervisor">{t("remedial_supervisor")}</label><Input id="remedial-supervisor" value={form.supervisorName} onChange={(event) => setForm((current) => ({ ...current, supervisorName: event.target.value }))} /></div>
        </CardContent>
      </Card>

      <Card data-testid="remedial-candidates-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">{snapshot?.students?.length ? <AlertTriangle className="h-5 w-5 text-amber-500" /> : <ShieldCheck className="h-5 w-5 text-emerald-500" />}{t("remedial_candidates")}</CardTitle>
          <CardDescription>{t("remedial_candidates_help")}</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table data-testid="remedial-candidates-table">
            <TableHeader><TableRow><TableHead>{t("student_name")}</TableHead><TableHead>{t("class_name")}</TableHead><TableHead>{t("score")}</TableHead><TableHead>{t("percentage")}</TableHead><TableHead>{t("status")}</TableHead></TableRow></TableHeader>
            <TableBody>
              {loadingPreview ? (
                <TableRow><TableCell colSpan={5}>{t("loading")}</TableCell></TableRow>
              ) : snapshot?.students?.length ? (
                snapshot.students.map((student) => (
                  <TableRow key={student.id} data-testid={`remedial-candidate-${student.id}`}><TableCell className="font-medium">{student.full_name}</TableCell><TableCell>{student.class_name || "—"}</TableCell><TableCell>{student.score_label}</TableCell><TableCell>{student.percentage}%</TableCell><TableCell><Badge variant="destructive">{t("remedial_below_50")}</Badge></TableCell></TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">{selectedSourceKey ? t("remedial_no_weak_students") : t("remedial_select_source")}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
