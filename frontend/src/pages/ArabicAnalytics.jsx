import { useCallback, useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  AlertTriangle, BookOpenCheck, CheckCircle2, Download, Sigma,
  Sparkles, Target, TrendingUp, UsersRound,
} from "lucide-react";
import { toast } from "sonner";
import { api, getLocalizedApiErrorMessage } from "@/lib/api";
import { displayQuarterNumber } from "@/lib/academicScope";
import { formatArabicScore } from "@/lib/arabicGrading";
import { useTranslations } from "@/lib/i18n";
import { PERFORMANCE_CHART_COLORS } from "@/lib/performanceBadges";
import { sortByClassOrder } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PerformanceLevelBadge } from "@/components/PerformanceLevelBadge";
import { LoadErrorCard } from "@/components/LoadErrorCard";
import {
  AnalyticsToolbar, ChartCard, DashboardEmpty, DashboardLoading,
  DashboardPageHeader, FilterField, InsightPanel, InsightRow, MetricCard,
} from "@/components/analytics";

const semNumber = (semester) => (semester === "semester2" ? 2 : 1);
const SCORE_FIELDS = ["theory_test_1", "theory_test_2", "practical_test"];
const COMPONENT_COLORS = ["#8b5cf6", "#06b6d4", "#22c55e"];

const numericAverage = (values) => {
  const valid = values.map(Number).filter(Number.isFinite);
  return valid.length ? Math.round((valid.reduce((sum, value) => sum + value, 0) / valid.length) * 100) / 100 : null;
};

const formatPercent = (value) => `${Number(value || 0).toFixed(1).replace(".0", "")}%`;

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

  const copy = language === "ar" ? {
    completionTitle: "اكتمال الرصد والاختبارات",
    completionHint: "يوضح اكتمال كل اختبار وعدد أسابيع أعمال السنة المرصودة في نطاق الفصل أو الطالب المختار.",
    componentsTitle: "توزيع الدرجة الموزونة",
    componentsHint: "أعمال السنة من 40، وأفضل اختبار نظري من 30، والاختبار العملي من 30.",
    rawTestsTitle: "أداء كل اختبار على حدة",
    rawTestsHint: "تعرض المقارنة كنسبة من الحد الخام المناسب للمرحلة حتى تظل المقارنة عادلة.",
    contributionTitle: "مساهمة مكونات الدرجة النهائية",
    totalsTitle: "إجمالي الطلاب من 100",
    totalsHint: "مقارنة مباشرة لدرجات الطلاب المسجلة في النطاق المختار.",
    classCompletionTitle: "اكتمال الاختبارات حسب الفصل",
    classCompletionHint: "نسبة الاختبارات الثلاثة التي تم رصدها لكل فصل.",
    topTitle: "أفضل الطلاب",
    supportTitle: "طلاب يحتاجون متابعة",
    insightTitle: "قراءة تحليلية للنطاق المختار",
    insightAverage: "متوسط الدرجة المسجلة في النطاق هو {value} من 100.",
    insightCompletion: "بلغ اكتمال رصد الاختبارات {value}.",
    insightSupport: "يوجد {count} طالبًا في نطاق المتابعة أو دون المستوى.",
    insightStudent: "حقق {student} مجموع {value} من 100 بعد احتساب أعمال السنة وأفضل النظري والعملي.",
    noRecorded: "لم تُسجل درجة بعد",
    weeksCoverage: "تغطية أسابيع أعمال السنة",
    recorded: "مرصود",
    missing: "غير مرصود",
    rawPercent: "نسبة الدرجة الخام",
  } : {
    completionTitle: "Score and test completion",
    completionHint: "Shows completion for every test and the recorded continuous-assessment weeks in the selected scope.",
    componentsTitle: "Weighted score distribution",
    componentsHint: "Continuous assessment /40, best theory /30, and practical /30.",
    rawTestsTitle: "Each test performance",
    rawTestsHint: "Raw tests are normalized to percentages so stages with different raw maxima remain comparable.",
    contributionTitle: "Final-score component contribution",
    totalsTitle: "Student totals out of 100",
    totalsHint: "Direct comparison of recorded student totals in the selected scope.",
    classCompletionTitle: "Test completion by class",
    classCompletionHint: "Percentage of the three exam scores recorded for each class.",
    topTitle: "Top performers",
    supportTitle: "Students needing follow-up",
    insightTitle: "Selected-scope analysis",
    insightAverage: "The recorded average in this scope is {value}/100.",
    insightCompletion: "Test-entry completion is {value}.",
    insightSupport: "{count} students are approaching or below level.",
    insightStudent: "{student} achieved {value}/100 after continuous assessment, best theory, and practical weighting.",
    noRecorded: "No recorded score yet",
    weeksCoverage: "Continuous-assessment week coverage",
    recorded: "Recorded",
    missing: "Missing",
    rawPercent: "Raw-score percentage",
  };

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
    } finally {
      setLoading(false);
    }
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
  const selectedStudent = students.find((student) => student.id === selectedStudentId) || null;
  const scopedStudents = selectedStudent ? [selectedStudent] : students;
  const scoredStudents = scopedStudents.filter((student) => student.quarter_total != null);
  const scopeAverage = numericAverage(scoredStudents.map((student) => student.quarter_total));
  const onLevelCount = scoredStudents.filter((student) => student.performance_level === "on_level").length;
  const supportStudents = scopedStudents.filter((student) => ["approach", "below"].includes(student.performance_level));
  const onLevelRate = scoredStudents.length ? Math.round((onLevelCount * 1000) / scoredStudents.length) / 10 : 0;

  const distribution = useMemo(() => ["on_level", "approach", "below", "no_data"].map((level) => ({
    level,
    name: t(level),
    value: scopedStudents.filter((student) => student.performance_level === level).length,
  })), [scopedStudents, t]);

  const classAverages = useMemo(() => sortByClassOrder(data?.class_breakdown || []).map((item) => ({
    name: item.class_name,
    average: item.average_total ?? 0,
  })), [data]);

  const classCompletion = useMemo(() => sortByClassOrder(data?.class_breakdown || []).map((item) => ({
    name: item.class_name,
    completion: item.completion_percentage ?? 0,
  })), [data]);

  const componentData = useMemo(() => [
    { name: t("continuous_assessment"), score: numericAverage(scopedStudents.map((item) => item.continuous_total).filter((value) => value != null)) ?? 0, max: 40 },
    { name: t("best_theory"), score: numericAverage(scopedStudents.map((item) => item.best_theory_weighted).filter((value) => value != null)) ?? 0, max: 30 },
    { name: t("practical_weighted"), score: numericAverage(scopedStudents.map((item) => item.practical_weighted).filter((value) => value != null)) ?? 0, max: 30 },
  ], [scopedStudents, t]);

  const rawTestData = useMemo(() => SCORE_FIELDS.map((field) => {
    const percentages = scopedStudents.flatMap((student) => {
      const score = student[field];
      const maximum = Number(student.exam_raw_max);
      return score == null || !maximum ? [] : [(Number(score) / maximum) * 100];
    });
    return { name: t(field), score: numericAverage(percentages) ?? 0, maximum: 100 };
  }), [scopedStudents, t]);

  const contributionData = useMemo(() => componentData.map((item, index) => ({
    name: item.name,
    value: item.score,
    fill: COMPONENT_COLORS[index],
  })), [componentData]);

  const studentTotals = useMemo(() => [...scopedStudents]
    .filter((student) => student.quarter_total != null)
    .sort((a, b) => Number(b.quarter_total) - Number(a.quarter_total))
    .slice(0, 20)
    .map((student) => ({ name: student.full_name, total: Number(student.quarter_total) })), [scopedStudents]);

  const completionItems = useMemo(() => {
    if (selectedStudent) {
      const exams = SCORE_FIELDS.map((field) => ({
        key: field,
        label: t(field),
        percentage: selectedStudent[field] == null ? 0 : 100,
        completed: selectedStudent[field] == null ? 0 : 1,
        possible: 1,
      }));
      return [...exams, {
        key: "weeks",
        label: copy.weeksCoverage,
        percentage: Math.min(100, ((Number(selectedStudent.weeks_with_scores) || 0) / 9) * 100),
        completed: Number(selectedStudent.weeks_with_scores) || 0,
        possible: 9,
      }];
    }
    return SCORE_FIELDS.map((field) => {
      const item = data?.test_completion?.[field] || {};
      return {
        key: field,
        label: t(field),
        percentage: item.percentage || 0,
        completed: item.completed || 0,
        possible: (item.completed || 0) + (item.missing || 0),
      };
    });
  }, [copy.weeksCoverage, data, selectedStudent, t]);

  const topPerformers = useMemo(() => [...scoredStudents]
    .sort((a, b) => Number(b.quarter_total) - Number(a.quarter_total)).slice(0, 5), [scoredStudents]);

  const download = async (format) => {
    try {
      const response = await api.get("/arabic/reports/export", {
        params: {
          academic_year: academicYear,
          semester: sem,
          quarter,
          class_id: selectedClassId === "all" ? undefined : selectedClassId,
          format,
          lang: language,
        },
        responseType: "blob",
      });
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `arabic-analytics-${academicYear}-q${displayQuarter}.${format === "excel" ? "xlsx" : "pdf"}`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(t("export_failed"));
    }
  };

  const tooltipStyle = { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 };

  return <div className="analytics-dashboard space-y-6" data-testid="arabic-analytics">
    <DashboardPageHeader
      title={t("analytics")}
      subtitle={`${t("arabic_section")} · ${academicYear} · Q${displayQuarter}`}
      description={t("arabic_analytics_description")}
      metaItems={[t("arabic_weekly_40"), `${t("tests_total")} /60`, t("quarter_total_100")]}
      actions={<Button variant="secondary" onClick={() => download("pdf")} data-testid="arabic-analytics-hero-pdf"><Download className="me-2 h-4 w-4" />PDF</Button>}
      testId="arabic-analytics-header"
    />

    <AnalyticsToolbar
      testId="arabic-analytics-toolbar"
      filters={<>
        <FilterField label={t("class")}><Select value={selectedClassId} onValueChange={setSelectedClassId}><SelectTrigger data-testid="arabic-analytics-class"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{t("all_classes")}</SelectItem>{sortByClassOrder(classes).map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></FilterField>
        <FilterField label={t("student")}><Select value={selectedStudentId} onValueChange={setSelectedStudentId} disabled={selectedClassId === "all"}><SelectTrigger data-testid="arabic-analytics-student"><SelectValue placeholder={t("all_students")} /></SelectTrigger><SelectContent><SelectItem value="all">{t("all_students")}</SelectItem>{students.map((student) => <SelectItem key={student.id} value={student.id}>{student.full_name}</SelectItem>)}</SelectContent></Select></FilterField>
      </>}
      actions={<><Button variant="secondary" onClick={() => download("pdf")}><Download className="me-2 h-4 w-4" />PDF</Button><Button variant="secondary" onClick={() => download("excel")}><Download className="me-2 h-4 w-4" />Excel</Button><Button variant="outline" onClick={load}>{t("refresh_data")}</Button></>}
    />

    {loadError ? <LoadErrorCard message={loadError} onRetry={load} t={t} testId="arabic-analytics-load-error" /> : loading ? <DashboardLoading /> : !data ? <DashboardEmpty title={t("no_data")} /> : <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={UsersRound} label={selectedStudent ? t("student") : t("total_students")} value={selectedStudent ? selectedStudent.full_name : scopedStudents.length} accent="primary" />
        <MetricCard icon={Sigma} label={t("average_total")} value={scopeAverage == null ? "—" : `${scopeAverage}/100`} />
        <MetricCard icon={TrendingUp} label={t("on_level_rate")} value={`${onLevelRate}%`} accent="success" />
        <MetricCard icon={AlertTriangle} label={t("students_needing_support")} value={supportStudents.length} accent="warning" />
      </div>

      <ChartCard title={copy.completionTitle} subtitle={copy.completionHint} span="full" testId="arabic-analytics-completion">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {completionItems.map((item) => <div key={item.key} className="rounded-2xl border bg-muted/20 p-4">
            <div className="flex items-start justify-between gap-3"><p className="font-semibold">{item.label}</p><span className="text-lg font-bold text-primary">{formatPercent(item.percentage)}</span></div>
            <Progress value={item.percentage} className="mt-4 h-2.5" />
            <p className="mt-3 text-xs text-muted-foreground">{copy.recorded}: {item.completed}/{item.possible}</p>
          </div>)}
        </div>
      </ChartCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title={t("performance_distribution")} subtitle={t("arabic_performance_threshold_hint")} testId="arabic-performance-donut">
          <div className="h-80"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={distribution} dataKey="value" nameKey="name" innerRadius={72} outerRadius={112} paddingAngle={3}>{distribution.map((item) => <Cell key={item.level} fill={PERFORMANCE_CHART_COLORS[item.level] || "#64748b"} />)}</Pie><Tooltip contentStyle={tooltipStyle} /><Legend /></PieChart></ResponsiveContainer></div>
        </ChartCard>

        <ChartCard title={selectedStudent ? `${t("average_total")} · ${selectedStudent.full_name}` : t("average_by_class")} summary={scopeAverage == null ? "—" : formatArabicScore(scopeAverage)} summaryLabel="/100" testId="arabic-class-average-chart">
          {selectedStudent ? <div className="grid min-h-80 place-items-center"><div className="text-center"><p className="text-6xl font-black text-primary">{formatArabicScore(selectedStudent.quarter_total)}</p><p className="mt-2 text-muted-foreground">/100</p><div className="mt-5"><PerformanceLevelBadge level={selectedStudent.performance_level} label={t(selectedStudent.performance_level)} /></div></div></div> : <div className="h-80"><ResponsiveContainer width="100%" height="100%"><BarChart data={classAverages}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" /><YAxis domain={[0, 100]} /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="average" name={t("average_total")} fill="#06b6d4" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer></div>}
        </ChartCard>

        <ChartCard title={copy.componentsTitle} subtitle={copy.componentsHint} testId="arabic-components-chart">
          <div className="h-80"><ResponsiveContainer width="100%" height="100%"><BarChart data={componentData}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" /><YAxis domain={[0, 40]} /><Tooltip contentStyle={tooltipStyle} /><Legend /><Bar dataKey="score" name={t("total_score")} fill="#8b5cf6" radius={[8, 8, 0, 0]} /><Bar dataKey="max" name={t("max_score")} fill="#22d3ee" radius={[8, 8, 0, 0]} opacity={0.32} /></BarChart></ResponsiveContainer></div>
        </ChartCard>

        <ChartCard title={copy.rawTestsTitle} subtitle={copy.rawTestsHint} testId="arabic-raw-tests-chart">
          <div className="h-80"><ResponsiveContainer width="100%" height="100%"><BarChart data={rawTestData}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" /><YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} /><Tooltip contentStyle={tooltipStyle} formatter={(value) => [formatPercent(value), copy.rawPercent]} /><Bar dataKey="score" name={copy.rawPercent} fill="#f59e0b" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer></div>
        </ChartCard>

        <ChartCard title={copy.contributionTitle} subtitle={copy.componentsHint} testId="arabic-contribution-donut">
          <div className="h-80"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={contributionData} dataKey="value" nameKey="name" innerRadius={68} outerRadius={110} paddingAngle={4}>{contributionData.map((item) => <Cell key={item.name} fill={item.fill} />)}</Pie><Tooltip contentStyle={tooltipStyle} /><Legend /></PieChart></ResponsiveContainer></div>
        </ChartCard>

        <ChartCard title={copy.classCompletionTitle} subtitle={copy.classCompletionHint} testId="arabic-class-completion-chart">
          <div className="h-80"><ResponsiveContainer width="100%" height="100%"><BarChart data={classCompletion}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" /><YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} /><Tooltip contentStyle={tooltipStyle} formatter={(value) => formatPercent(value)} /><Bar dataKey="completion" name={t("completion_percentage")} fill="#22c55e" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer></div>
        </ChartCard>
      </div>

      <ChartCard title={copy.totalsTitle} subtitle={copy.totalsHint} span="full" testId="arabic-student-totals-chart">
        {studentTotals.length ? <div className="h-[420px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={studentTotals} layout="vertical" margin={{ left: 20, right: 20 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" domain={[0, 100]} /><YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 11 }} /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="total" name={t("quarter_total_100")} fill="#0ea5e9" radius={[0, 8, 8, 0]} /></BarChart></ResponsiveContainer></div> : <DashboardEmpty title={copy.noRecorded} />}
      </ChartCard>

      <div className="grid gap-6 xl:grid-cols-3">
        <InsightPanel title={copy.insightTitle} badge={selectedStudent ? selectedStudent.full_name : `${t("arabic_section")} Q${displayQuarter}`} className="xl:col-span-1">
          <InsightRow icon={selectedStudent ? Target : TrendingUp} tone="text-emerald-500" text={(selectedStudent ? copy.insightStudent : copy.insightAverage).replace("{student}", selectedStudent?.full_name || "").replace("{value}", formatArabicScore(selectedStudent?.quarter_total ?? scopeAverage))} />
          <InsightRow icon={CheckCircle2} tone="text-cyan-500" text={copy.insightCompletion.replace("{value}", formatPercent(selectedStudent ? numericAverage(completionItems.map((item) => item.percentage)) : data.completion_percentage))} />
          <InsightRow icon={AlertTriangle} tone="text-amber-500" text={copy.insightSupport.replace("{count}", String(supportStudents.length))} />
        </InsightPanel>

        <ChartCard title={copy.topTitle} className="xl:col-span-1" testId="arabic-top-performers">
          <div className="space-y-3">{topPerformers.length ? topPerformers.map((student, index) => <div key={student.id} className="flex items-center justify-between gap-3 rounded-xl border bg-muted/20 p-3"><div className="min-w-0"><p className="truncate font-semibold">{index + 1}. {student.full_name}</p><p className="text-xs text-muted-foreground">{student.class_name}</p></div><span className="font-bold text-emerald-500">{formatArabicScore(student.quarter_total)}/100</span></div>) : <p className="py-8 text-center text-muted-foreground">{copy.noRecorded}</p>}</div>
        </ChartCard>

        <ChartCard title={copy.supportTitle} className="xl:col-span-1" testId="arabic-support-list">
          <div className="max-h-96 space-y-3 overflow-y-auto pe-1">{supportStudents.length ? supportStudents.map((student) => <div key={student.id} className="flex items-center justify-between gap-3 rounded-xl border bg-muted/20 p-3"><div className="min-w-0"><p className="truncate font-semibold">{student.full_name}</p><p className="text-xs text-muted-foreground">{student.class_name}</p></div><PerformanceLevelBadge level={student.performance_level} label={t(student.performance_level)} /></div>) : <div className="py-8 text-center"><Sparkles className="mx-auto mb-2 h-6 w-6 text-emerald-500" /><p className="text-muted-foreground">{t("no_data")}</p></div>}</div>
        </ChartCard>
      </div>

      <ChartCard title={t("detailed_analysis")} subtitle={copy.rawTestsHint} span="full" testId="arabic-detailed-analysis">
        <div className="overflow-x-auto"><table className="w-full min-w-[1320px] text-sm"><thead className="bg-[#10162A] text-white"><tr><th className="p-3 text-start">{t("student")}</th><th className="p-3 text-start">{t("class")}</th><th className="p-3 text-center">{t("continuous_assessment")} /40</th>{SCORE_FIELDS.map((field) => <th key={field} className="p-3 text-center">{t(field)}</th>)}<th className="p-3 text-center">{t("best_theory")} /30</th><th className="p-3 text-center">{t("practical_weighted")} /30</th><th className="p-3 text-center">/100</th><th className="p-3 text-center">{t("performance_level")}</th></tr></thead><tbody>{scopedStudents.map((student) => <tr key={student.id} className="border-b"><td className="p-3 font-semibold">{student.full_name}</td><td className="p-3">{student.class_name}</td><td className="p-3 text-center">{formatArabicScore(student.continuous_total)}</td>{SCORE_FIELDS.map((field) => <td key={field} className="p-3 text-center">{student[field] == null ? "—" : `${formatArabicScore(student[field])}/${student.exam_raw_max}`}</td>)}<td className="p-3 text-center">{formatArabicScore(student.best_theory_weighted)}</td><td className="p-3 text-center">{formatArabicScore(student.practical_weighted)}</td><td className="p-3 text-center font-bold">{formatArabicScore(student.quarter_total)}</td><td className="p-3 text-center"><PerformanceLevelBadge level={student.performance_level} label={t(student.performance_level)} /></td></tr>)}</tbody></table></div>
      </ChartCard>

      <div className="rounded-2xl border bg-card p-5 text-sm leading-7 text-muted-foreground" data-testid="arabic-analytics-formula-note">
        <div className="flex items-center gap-2 font-semibold text-foreground"><BookOpenCheck className="h-5 w-5 text-primary" />{copy.componentsTitle}</div>
        <p className="mt-2">{copy.componentsHint} {copy.rawTestsHint}</p>
      </div>
    </>}
  </div>;
}
