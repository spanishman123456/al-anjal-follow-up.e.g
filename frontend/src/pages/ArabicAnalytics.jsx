import { useCallback, useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, Download, Sigma, TrendingUp, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { api, getLocalizedApiErrorMessage } from "@/lib/api";
import { displayQuarterNumber } from "@/lib/academicScope";
import { formatArabicScore } from "@/lib/arabicGrading";
import { useTranslations } from "@/lib/i18n";
import { PERFORMANCE_CHART_COLORS } from "@/lib/performanceBadges";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PerformanceLevelBadge } from "@/components/PerformanceLevelBadge";
import { LoadErrorCard } from "@/components/LoadErrorCard";
import {
  AnalyticsToolbar, ChartCard, DashboardEmpty, DashboardLoading,
  DashboardPageHeader, FilterField, MetricCard,
} from "@/components/analytics";

const semNumber = (semester) => (semester === "semester2" ? 2 : 1);
const average = (values) => values.length
  ? Math.round((values.reduce((sum, value) => sum + Number(value), 0) / values.length) * 100) / 100
  : null;

export default function ArabicAnalytics() {
  const { language, semester, quarter, academicYear, classes = [] } = useOutletContext();
  const t = useTranslations(language);
  const sem = semNumber(semester);
  const displayQuarter = displayQuarterNumber(semester, quarter);
  const [selectedClassId, setSelectedClassId] = useState("all");
  const [selectedStudentId, setSelectedStudentId] = useState("all");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const response = await api.get("/arabic/grades", {
        params: {
          academic_year: academicYear,
          semester: sem,
          quarter,
          class_id: selectedClassId === "all" ? undefined : selectedClassId,
        },
      });
      setData(response.data);
    } catch (error) {
      const message = getLocalizedApiErrorMessage(error, t);
      setData(null);
      setLoadError(message);
      toast.error(message);
    } finally { setLoading(false); }
  }, [academicYear, quarter, selectedClassId, sem, t]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setSelectedStudentId("all"); }, [selectedClassId]);
  useEffect(() => {
    const refresh = () => load();
    window.addEventListener("students-updated", refresh);
    window.addEventListener("app-refresh-data", refresh);
    return () => {
      window.removeEventListener("students-updated", refresh);
      window.removeEventListener("app-refresh-data", refresh);
    };
  }, [load]);

  const students = data?.students || [];
  const studentOptions = selectedClassId === "all" ? [] : students;
  const selectedStudent = students.find((student) => student.id === selectedStudentId) || null;
  const scopedStudents = selectedStudent ? [selectedStudent] : students;
  const scoredStudents = scopedStudents.filter((student) => student.quarter_total != null);
  const scopeAverage = average(scoredStudents.map((student) => student.quarter_total));
  const onLevelCount = scoredStudents.filter((student) => student.performance_level === "on_level").length;
  const supportCount = scoredStudents.filter((student) => ["approach", "below"].includes(student.performance_level)).length;
  const onLevelRate = scoredStudents.length ? Math.round((onLevelCount * 1000) / scoredStudents.length) / 10 : 0;

  const distribution = useMemo(() => ["on_level", "approach", "below", "no_data"].map((level) => ({
    level,
    name: t(level),
    value: scopedStudents.filter((student) => student.performance_level === level).length,
  })), [scopedStudents, t]);
  const classAverages = useMemo(() => (data?.class_breakdown || []).map((item) => ({
    name: item.class_name,
    average: item.average_total ?? 0,
  })), [data]);
  const selectedBreakdown = selectedStudent ? [
    { name: t("continuous_assessment"), score: selectedStudent.continuous_total ?? 0, max: 40 },
    { name: t("best_theory"), score: selectedStudent.best_theory_weighted ?? 0, max: 30 },
    { name: t("practical_weighted"), score: selectedStudent.practical_weighted ?? 0, max: 30 },
  ] : [];

  const download = async (format) => {
    try {
      const response = await api.get("/arabic/reports/export", {
        params: {
          academic_year: academicYear, semester: sem, quarter,
          class_id: selectedClassId === "all" ? undefined : selectedClassId,
          format, lang: language,
        },
        responseType: "blob",
      });
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `arabic-analytics-${academicYear}-q${displayQuarter}.${format === "excel" ? "xlsx" : "pdf"}`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch { toast.error(t("export_failed")); }
  };

  return <div className="analytics-dashboard space-y-6" data-testid="arabic-analytics">
    <DashboardPageHeader
      title={t("analytics")}
      subtitle={`${t("arabic_section")} · ${academicYear} · Q${displayQuarter}`}
      description={t("arabic_analytics_description")}
      metaItems={[t("arabic_weekly_40"), `${t("tests_total")} /60`, t("quarter_total_100")]}
      testId="arabic-analytics-header"
    />

    <AnalyticsToolbar
      testId="arabic-analytics-toolbar"
      filters={<>
        <FilterField label={t("class")}><Select value={selectedClassId} onValueChange={setSelectedClassId}><SelectTrigger data-testid="arabic-analytics-class"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{t("all_classes")}</SelectItem>{classes.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></FilterField>
        <FilterField label={t("student")}><Select value={selectedStudentId} onValueChange={setSelectedStudentId} disabled={selectedClassId === "all"}><SelectTrigger data-testid="arabic-analytics-student"><SelectValue placeholder={t("all_students")} /></SelectTrigger><SelectContent><SelectItem value="all">{t("all_students")}</SelectItem>{studentOptions.map((student) => <SelectItem key={student.id} value={student.id}>{student.full_name}</SelectItem>)}</SelectContent></Select></FilterField>
      </>}
      actions={<><Button variant="secondary" onClick={() => download("pdf")}><Download className="me-2 h-4 w-4" />PDF</Button><Button variant="secondary" onClick={() => download("excel")}><Download className="me-2 h-4 w-4" />Excel</Button><Button variant="outline" onClick={load}>{t("refresh_data")}</Button></>}
    />

    {loadError ? <LoadErrorCard message={loadError} onRetry={load} t={t} testId="arabic-analytics-load-error" /> : loading ? <DashboardLoading /> : !data ? <DashboardEmpty title={t("no_data")} /> : <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={UsersRound} label={selectedStudent ? t("student") : t("total_students")} value={selectedStudent ? selectedStudent.full_name : scopedStudents.length} accent="primary" />
        <MetricCard icon={Sigma} label={t("average_total")} value={scopeAverage == null ? "—" : `${scopeAverage}/100`} />
        <MetricCard icon={TrendingUp} label={t("on_level_rate")} value={`${onLevelRate}%`} accent="success" />
        <MetricCard icon={AlertTriangle} label={t("students_needing_support")} value={supportCount} accent="warning" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title={selectedStudent ? t("analytics_student_breakdown") : t("performance_distribution")} subtitle={selectedStudent ? selectedStudent.full_name : t("arabic_performance_threshold_hint")}>
          <div className="h-80">{selectedStudent ? <ResponsiveContainer width="100%" height="100%"><BarChart data={selectedBreakdown}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" /><YAxis domain={[0, 40]} /><Tooltip /><Legend /><Bar dataKey="score" name={t("total_score")} fill="#7c3aed" radius={[8, 8, 0, 0]} /><Bar dataKey="max" name={t("max_score")} fill="#22d3ee" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer> : <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={distribution} dataKey="value" nameKey="name" innerRadius={70} outerRadius={110} paddingAngle={3}>{distribution.map((item) => <Cell key={item.level} fill={PERFORMANCE_CHART_COLORS[item.level] || "#64748b"} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer>}</div>
        </ChartCard>

        <ChartCard title={selectedStudent ? t("quarter_total_100") : t("average_by_class")} summary={selectedStudent ? formatArabicScore(selectedStudent.quarter_total) : formatArabicScore(scopeAverage)} summaryLabel="/100">
          {selectedStudent ? <div className="grid flex-1 place-items-center py-10"><div className="text-center"><p className="text-6xl font-bold text-primary">{formatArabicScore(selectedStudent.quarter_total)}</p><div className="mt-4"><PerformanceLevelBadge level={selectedStudent.performance_level} label={t(selectedStudent.performance_level)} /></div><p className="mt-4 text-sm text-muted-foreground">{t("weeks_recorded").replace("{count}", String(selectedStudent.weeks_with_scores || 0))}</p></div></div> : <div className="h-80"><ResponsiveContainer width="100%" height="100%"><BarChart data={classAverages}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" /><YAxis domain={[0, 100]} /><Tooltip /><Bar dataKey="average" name={t("average_total")} fill="#0ea5e9" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer></div>}
        </ChartCard>
      </div>

      <ChartCard title={t("detailed_analysis")} span="full">
        <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-sm"><thead className="bg-[#10162A] text-white"><tr><th className="p-3 text-start">{t("student")}</th><th className="p-3 text-start">{t("class")}</th><th className="p-3 text-center">{t("continuous_assessment")} /40</th><th className="p-3 text-center">{t("best_theory")} /30</th><th className="p-3 text-center">{t("practical_weighted")} /30</th><th className="p-3 text-center">/100</th><th className="p-3 text-center">{t("performance_level")}</th></tr></thead><tbody>{scopedStudents.map((student) => <tr key={student.id} className="border-b"><td className="p-3 font-semibold">{student.full_name}</td><td className="p-3">{student.class_name}</td><td className="p-3 text-center">{formatArabicScore(student.continuous_total)}</td><td className="p-3 text-center">{formatArabicScore(student.best_theory_weighted)}</td><td className="p-3 text-center">{formatArabicScore(student.practical_weighted)}</td><td className="p-3 text-center font-bold">{formatArabicScore(student.quarter_total)}</td><td className="p-3 text-center"><PerformanceLevelBadge level={student.performance_level} label={t(student.performance_level)} /></td></tr>)}</tbody></table></div>
      </ChartCard>
    </>}
  </div>;
}
