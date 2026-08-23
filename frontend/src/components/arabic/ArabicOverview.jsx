import { useCallback, useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { BarChart3, Download, Medal, ShieldAlert, Sigma, UsersRound } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { displayQuarterNumber } from "@/lib/academicScope";
import { ARABIC_EXAM_FIELDS, formatArabicScore } from "@/lib/arabicGrading";
import { useTranslations } from "@/lib/i18n";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { buildArabicPerformanceSummary } from "./arabicPerformanceSummary";
import { DashboardTimetable } from "@/components/dashboard/DashboardTimetable";

const semNumber = (semester) => (semester === "semester2" ? 2 : 1);
const TESTS = ARABIC_EXAM_FIELDS;
const formatTotal = (value) => (value === null || value === undefined ? "—" : `${value} /100`);

function ArabicPerformanceCards({ data, t }) {
  const summary = useMemo(() => buildArabicPerformanceSummary(data), [data]);
  const totalFromClasses = summary.studentsPerClass.reduce((total, item) => total + item.count, 0);

  return (
    <section className="space-y-6" data-testid="arabic-performance-summary">
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="premium-active-card card-hover overflow-hidden xl:col-span-2" data-testid="arabic-performance-distribution">
          <CardHeader className="border-b border-cyan-100/70 bg-gradient-to-r from-[#10162A] via-[#172554] to-[#312e81] text-white">
            <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-cyan-300" />{t("performance_distribution")}</CardTitle>
            <p className="text-sm text-cyan-50/80">{t("arabic_score_ranges")}</p>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-72" data-testid="arabic-performance-distribution-chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summary.distribution} barSize={28}>
                  <defs>
                    <linearGradient id="arabicDistributionGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22d3ee" />
                      <stop offset="100%" stopColor="#7c3aed" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.25} />
                  <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} width={32} />
                  <Tooltip />
                  <Bar dataKey="count" fill="url(#arabicDistributionGradient)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">{t("students_with_actual_grades")}: <span className="font-semibold text-foreground">{summary.studentsWithData.length}</span></p>
          </CardContent>
        </Card>

        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-1">
          <Card className="premium-active-card card-hover relative overflow-hidden" data-testid="arabic-average-total">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-400 via-sky-500 to-violet-500" />
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Sigma className="h-5 w-5 text-cyan-600" />{t("average_total")}</CardTitle></CardHeader>
            <CardContent>
              <p className="text-4xl font-bold tracking-tight text-[#172554] dark:text-cyan-200" data-testid="arabic-average-total-value">{formatTotal(summary.averageTotal)}</p>
              <p className="mt-3 text-xs text-muted-foreground">{t("students_with_actual_grades")}: {summary.studentsWithData.length}</p>
            </CardContent>
          </Card>

          <Card className="card-hover border-violet-200/80 bg-gradient-to-br from-white to-violet-50/70 dark:from-slate-950 dark:to-violet-950/20" data-testid="arabic-support-list">
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ShieldAlert className="h-5 w-5 text-violet-600" />{t("students_needing_support")}</CardTitle></CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-violet-700 dark:text-violet-300">—</p>
              <p className="mt-3 text-sm font-medium text-foreground">{t("no_performance_thresholds")}</p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">{t("support_threshold_not_configured")}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="card-hover" data-testid="arabic-students-per-class">
          <CardHeader><CardTitle className="flex items-center gap-2"><UsersRound className="h-5 w-5 text-cyan-600" />{t("students_per_class")}</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64" data-testid="arabic-students-per-class-chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summary.studentsPerClass} barSize={30}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.25} />
                  <XAxis dataKey="class_name" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} width={32} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#1e3a8a" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">{t("total_from_classes")}: <span className="font-semibold text-foreground">{totalFromClasses}</span></p>
          </CardContent>
        </Card>

        <Card className="card-hover" data-testid="arabic-top-performers">
          <CardHeader className="border-b border-border/60"><CardTitle className="flex items-center gap-2"><Medal className="h-5 w-5 text-violet-600" />{t("top_performers")}</CardTitle></CardHeader>
          <CardContent className="max-h-[22rem] space-y-3 overflow-y-auto pt-5">
            {summary.topStudents.length ? summary.topStudents.map((student, index) => (
              <div key={student.id} className="list-row-interactive flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/80 px-4 py-3" data-testid={`arabic-top-student-${student.id}`}>
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-cyan-100 to-violet-100 text-sm font-bold text-[#172554]">{index + 1}</span>
                  <div className="min-w-0"><p className="truncate text-sm font-semibold">{student.full_name}</p><p className="text-xs text-muted-foreground">{student.class_name}</p></div>
                </div>
                <span className="shrink-0 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-sm font-bold tabular-nums text-cyan-800 dark:border-cyan-800 dark:bg-cyan-950/50 dark:text-cyan-200">{formatTotal(student.quarter_total)}</span>
              </div>
            )) : <p className="text-sm text-muted-foreground">{t("no_data")}</p>}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

export function ArabicOverview({ variant = "dashboard" }) {
  const { language, semester, quarter, academicYear, classes = [], profile } = useOutletContext();
  const t = useTranslations(language);
  const [classId, setClassId] = useState("all");
  const [data, setData] = useState(null);
  const displayQ = displayQuarterNumber(semester, quarter);

  const load = useCallback(async () => {
    try {
      const response = await api.get("/arabic/grades", { params: { academic_year: academicYear, semester: semNumber(semester), quarter, class_id: classId === "all" ? undefined : classId } });
      setData(response.data);
    } catch { toast.error(t("load_failed")); }
  }, [academicYear, classId, quarter, semester, t]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const refresh = () => load();
    window.addEventListener("students-updated", refresh);
    window.addEventListener("app-refresh-data", refresh);
    return () => {
      window.removeEventListener("students-updated", refresh);
      window.removeEventListener("app-refresh-data", refresh);
    };
  }, [load]);

  const download = async (format) => {
    try {
      const response = await api.get("/arabic/reports/export", { params: { academic_year: academicYear, semester: semNumber(semester), quarter, class_id: classId === "all" ? undefined : classId, format, lang: language }, responseType: "blob" });
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `arabic-section-${academicYear}-q${displayQ}.${format === "excel" ? "xlsx" : "pdf"}`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch { toast.error(t("export_failed")); }
  };

  const title = variant === "reports" ? t("reports") : variant === "analytics" ? t("analytics") : t("dashboard");
  const metrics = [[t("total_students"), data?.total_students || 0], [t("students_with_grades"), data?.students_with_grades || 0], [t("students_without_grades"), data?.students_without_grades || 0], [t("completion_percentage"), `${data?.completion_percentage || 0}%`]];
  const showPerformanceSummary = variant === "dashboard" || variant === "analytics";

  return <div className="space-y-6" data-testid={`arabic-${variant}`}>
    <PageHeader title={title} eyebrow={`${t("arabic_section")} · ${academicYear} · Q${displayQ}`} description={t("arabic_grading_description")} badges={["S1 = Q1 + Q2", "S2 = Q3 + Q4", "Each quarter /100"]} testIdPrefix={`arabic-${variant}`} action={<div className="flex flex-wrap gap-2"><Select value={classId} onValueChange={setClassId}><SelectTrigger className="w-52 border-white/30 bg-white/10 text-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{t("all_classes")}</SelectItem>{classes.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select>{variant === "reports" && <><Button variant="secondary" onClick={() => download("pdf")}><Download className="me-2 h-4 w-4" />PDF</Button><Button variant="secondary" onClick={() => download("excel")}><Download className="me-2 h-4 w-4" />Excel</Button></>}</div>} />

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 animate-stagger">{metrics.map(([label, value]) => <Card key={label} className="premium-active-card card-hover"><CardContent className="pt-6"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-bold">{value}</p></CardContent></Card>)}</div>

    {showPerformanceSummary && <ArabicPerformanceCards data={data} t={t} />}

    <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
      <Card><CardHeader><CardTitle>{t("test_completion")}</CardTitle></CardHeader><CardContent><Progress value={data?.completion_percentage || 0} className="mb-5 h-3" /><div className="space-y-3">{TESTS.map((key) => { const item = data?.test_completion?.[key] || {}; return <div key={key} className="rounded-xl border bg-muted/20 p-3"><div className="flex justify-between gap-4"><span className="font-medium">{t(key)}</span><span className="font-bold text-cyan-700 dark:text-cyan-300">{item.percentage || 0}%</span></div><div className="mt-2 flex gap-4 text-xs"><span className="text-emerald-600">{t("tested")}: {item.completed || 0}</span><span className="text-rose-600">{t("not_tested")}: {item.missing || 0}</span></div></div>; })}</div></CardContent></Card>
      <Card><CardHeader><CardTitle>{t("classes")}</CardTitle></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-[#10162A] text-white"><tr><th className="p-3 text-start">{t("class")}</th><th className="p-3 text-center">{t("students")}</th><th className="p-3 text-center">{t("students_with_grades")}</th><th className="p-3 text-center">{t("completion_percentage")}</th></tr></thead><tbody>{(data?.class_breakdown || []).map((item) => <tr key={item.class_id} className="border-b"><td className="p-3 font-medium">{item.class_name}</td><td className="p-3 text-center">{item.student_count}</td><td className="p-3 text-center">{item.students_with_grades}</td><td className="p-3 text-center font-bold">{item.completion_percentage}%</td></tr>)}</tbody></table></div></CardContent></Card>
    </div>

    {(variant === "analytics" || variant === "reports") && <Card><CardHeader><CardTitle>{t("tested")} / {t("not_tested")}</CardTitle><p className="text-sm text-muted-foreground">{t("no_performance_thresholds")}</p></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full min-w-[1120px] text-sm"><thead className="bg-muted/60"><tr><th className="p-3 text-start">{t("student")}</th><th className="p-3 text-start">{t("class")}</th>{TESTS.map((key) => <th key={key} className="p-3 text-center">{t(key)}</th>)}<th className="p-3 text-center">{t("best_theory")} /30</th><th className="p-3 text-center">{t("practical_weighted")} /30</th><th className="p-3 text-center">{t("tests_total")} /60</th></tr></thead><tbody>{(data?.students || []).map((student) => <tr key={student.id} className="border-b"><td className="p-3 font-medium">{student.full_name}</td><td className="p-3">{student.class_name}</td>{TESTS.map((key) => <td key={key} className={`p-3 text-center text-xs font-semibold ${student.test_completion?.[key] ? "text-emerald-600" : "text-rose-600"}`}>{student.test_completion?.[key] ? `${t("tested")} (${formatArabicScore(student[key])}/${student.exam_raw_max})` : t("not_tested")}</td>)}<td className="p-3 text-center font-semibold">{formatArabicScore(student.best_theory_weighted)}</td><td className="p-3 text-center font-semibold">{formatArabicScore(student.practical_weighted)}</td><td className="p-3 text-center font-bold">{formatArabicScore(student.tests_total)}</td></tr>)}</tbody></table></div></CardContent></Card>}

    {variant === "dashboard" && (
      <DashboardTimetable
        academicYear={academicYear}
        defaultOpen={profile?.role_name === "Teacher"}
        language={language}
        schoolSection="arabic"
        t={t}
        testIdPrefix="arabic-dashboard-timetable"
      />
    )}
  </div>;
}
