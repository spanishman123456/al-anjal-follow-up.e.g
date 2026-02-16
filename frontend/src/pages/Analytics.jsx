import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import { api, getApiErrorMessage } from "@/lib/api";
import { useTranslations } from "@/lib/i18n";
import { sortByClassOrder } from "@/lib/utils";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const PERFORMANCE_COLORS = {
  on_level: "#10b981",
  approach: "#f59e0b",
  below: "#ef4444",
  no_data: "#94a3b8",
};

export default function Analytics() {
  const { language, semester, quarter } = useOutletContext();
  const t = useTranslations(language);
  const semesterNumber = semester === "semester2" ? 2 : 1;
  const [overview, setOverview] = useState(null);
  const [classSummary, setClassSummary] = useState([]);
  const [activeTab, setActiveTab] = useState("overview");
  const [classOptions, setClassOptions] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState("all");
  const [loading, setLoading] = useState(true);
  const [analysisStrengths, setAnalysisStrengths] = useState("");
  const [analysisWeaknesses, setAnalysisWeaknesses] = useState("");
  const [analysisPerformance, setAnalysisPerformance] = useState("");
  const [analysisStandoutData, setAnalysisStandoutData] = useState("");
  const [analysisActions, setAnalysisActions] = useState("");
  const [analysisRecommendations, setAnalysisRecommendations] = useState("");

  useEffect(() => {
    let cancelled = false;
    const loadAnalytics = async () => {
      setLoading(true);
      try {
        const params = {
          semester: semesterNumber,
          quarter,
          ...(selectedClassId !== "all" ? { class_id: selectedClassId } : {}),
        };
        const [overviewRes, classRes, classesRes] = await Promise.all([
          api.get("/analytics/overview", { params }),
          api.get("/classes/summary", { params: { semester: semesterNumber, quarter } }),
          api.get("/classes"),
        ]);
        if (cancelled) return;
        setOverview(overviewRes.data);
        setClassSummary(classRes.data);
        setClassOptions(classesRes.data);
      } catch (error) {
        if (cancelled) return;
        try {
          const params = {
            semester: semesterNumber,
            quarter,
            ...(selectedClassId !== "all" ? { class_id: selectedClassId } : {}),
          };
          const [summaryRes, classRes, classesRes] = await Promise.all([
            api.get("/analytics/summary", { params }),
            api.get("/classes/summary", { params: { semester: semesterNumber, quarter } }),
            api.get("/classes"),
          ]);
          if (cancelled) return;
          const s = summaryRes.data;
          const dist = s?.distribution || [
            { level: "on_level", count: 0 },
            { level: "approach", count: 0 },
            { level: "below", count: 0 },
            { level: "no_data", count: 0 },
          ];
          setOverview({
            total_students: s?.total_students ?? 0,
            classes_count: s?.classes_count ?? 0,
            quarter1: {
              distribution: dist,
              avg_total: s?.avg_total_score ?? null,
              on_level_rate: s?.on_level_rate ?? s?.exceeding_rate ?? 0,
              total_with_data: (s?.total_students ?? 0) - (dist.find((d) => d.level === "no_data")?.count ?? 0),
            },
            quarter2: {
              distribution: dist,
              avg_total: s?.avg_total_score ?? null,
              on_level_rate: s?.on_level_rate ?? s?.exceeding_rate ?? 0,
              total_with_data: (s?.total_students ?? 0) - (dist.find((d) => d.level === "no_data")?.count ?? 0),
            },
            struggling_students: s?.students_needing_support?.map((st) => ({
              id: st.id,
              full_name: st.full_name || [st.first_name, st.last_name].filter(Boolean).join(" "),
              class_name: st.class_name || "",
              class_id: st.class_id,
              quarter1_total: null,
              quarter2_total: null,
              performance_level_q1: st.performance_level,
              performance_level_q2: st.performance_level,
              weak_areas: [],
            })) ?? [],
            excelling_students: (s?.top_performers ?? []).map((st) => ({
              id: st.id,
              full_name: st.full_name || [st.first_name, st.last_name].filter(Boolean).join(" "),
              class_name: st.class_name || "",
              class_id: st.class_id,
              quarter1_total: null,
              quarter2_total: null,
              performance_level_q1: "on_level",
              performance_level_q2: "on_level",
              strengths: [],
            })),
            students_per_class: s?.students_per_class ?? [],
          });
          setClassSummary(classRes.data);
          setClassOptions(classesRes.data);
        } catch (fallbackError) {
          setOverview(null);
          setClassSummary([]);
          toast.error(getApiErrorMessage(fallbackError) || t("analytics_failed"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadAnalytics();
    return () => { cancelled = true; };
  }, [semesterNumber, quarter, selectedClassId]);

  const q1 = overview?.quarter1 || {};
  const q2 = overview?.quarter2 || {};
  const q1Distribution = (q1.distribution || []).map((item) => ({
    name: t(item.level),
    value: item.count,
    level: item.level,
  }));
  const q2Distribution = (q2.distribution || []).map((item) => ({
    name: t(item.level),
    value: item.count,
    level: item.level,
  }));

  const comparisonBarData = useMemo(() => {
    const levels = ["on_level", "approach", "below"];
    return levels.map((level) => ({
      level: t(level),
      levelKey: level,
      [t("quarter_1")]: q1.distribution?.find((d) => d.level === level)?.count ?? 0,
      [t("quarter_2")]: q2.distribution?.find((d) => d.level === level)?.count ?? 0,
    }));
  }, [q1.distribution, q2.distribution, t]);

  const classChartData = sortByClassOrder(
    classSummary.filter((cls) => selectedClassId === "all" || cls.class_id === selectedClassId)
  ).map((cls) => ({
    name: cls.class_name,
    score: cls.avg_total_score || 0,
  }));

  const gradeSummary = useMemo(() => {
    const map = {};
    classSummary.forEach((cls) => {
      const grade = cls.grade || 0;
      if (!map[grade]) {
        map[grade] = { grade: `Grade ${grade}`, total: 0, count: 0 };
      }
      map[grade].total += cls.avg_total_score || 0;
      map[grade].count += 1;
    });
    return Object.values(map).map((item) => ({
      grade: item.grade,
      avg: item.count ? Number((item.total / item.count).toFixed(2)) : 0,
    }));
  }, [classSummary]);

  const handleDownload = async (format) => {
    try {
      const response = await api.get("/analytics/summary/export", {
        params: { format, semester: semesterNumber, quarter },
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      const sLabel = semesterNumber === 2 ? "S2" : "S1";
      const qLabel = `Q${quarter}`;
      link.setAttribute(
        "download",
        `analytics_summary_${sLabel}_${qLabel}.${format === "excel" ? "xlsx" : "pdf"}`,
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      toast.error(t("download_fail"));
    }
  };

  if (loading && !overview) {
    return (
      <div className="space-y-8" data-testid="analytics-page">
        <PageHeader title={t("analytics")} subtitle={t("overview")} testIdPrefix="analytics" />
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          {t("refresh_data")}…
        </div>
      </div>
    );
  }

  const totalStudents = overview?.total_students ?? 0;
  const classesCount = overview?.classes_count ?? 0;

  return (
    <div className="space-y-8" data-testid="analytics-page">
      <PageHeader
        title={t("analytics")}
        subtitle={t("overview")}
        testIdPrefix="analytics"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={selectedClassId} onValueChange={setSelectedClassId}>
              <SelectTrigger className="w-48" data-testid="analytics-class-filter">
                <SelectValue placeholder={t("classes")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" data-testid="analytics-class-all">
                  {t("all_classes")}
                </SelectItem>
                {sortByClassOrder(classOptions).map((cls) => (
                  <SelectItem key={cls.id} value={cls.id} data-testid={`analytics-class-${cls.id}`}>
                    {cls.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="secondary"
              onClick={() => handleDownload("pdf")}
              data-testid="analytics-download-pdf"
            >
              {t("download_pdf")}
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleDownload("excel")}
              data-testid="analytics-download-excel"
            >
              {t("download_excel")}
            </Button>
          </div>
        }
      />

      {/* Key insights strip */}
      {overview && totalStudents > 0 && (
        <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10 dark:from-primary/10 dark:to-primary/5">
          <CardContent className="py-4">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t("key_insights")}
            </h3>
            <div className="flex flex-wrap items-center gap-6 text-sm">
              <span>
                <strong>{t("quarter_1")}:</strong> {q1.on_level_rate ?? 0}% {t("on_level")}
                {q1.avg_total != null && (
                  <span className="ml-1 text-muted-foreground">
                    ({t("avg_quarter_total")}: {q1.avg_total})
                  </span>
                )}
              </span>
              <span>
                <strong>{t("quarter_2")}:</strong> {q2.on_level_rate ?? 0}% {t("on_level")}
                {q2.avg_total != null && (
                  <span className="ml-1 text-muted-foreground">
                    ({t("avg_quarter_total")}: {q2.avg_total})
                  </span>
                )}
              </span>
              {overview.struggling_students?.length > 0 && (
                <span className="text-amber-600 dark:text-amber-400">
                  {overview.struggling_students.length} {t("struggling_students").toLowerCase()}
                </span>
              )}
              {overview.excelling_students?.length > 0 && (
                <span className="text-emerald-600 dark:text-emerald-400">
                  {overview.excelling_students.length} {t("excelling_students").toLowerCase()}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Metric cards */}
      <section className="section-bg-alt-1 grid gap-4 rounded-xl border border-border/50 p-4 md:grid-cols-2 lg:grid-cols-4" data-testid="analytics-metrics">
        <Card data-testid="analytics-total-students">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("total_students")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold" data-testid="analytics-total-students-value">
              {totalStudents}
            </div>
          </CardContent>
        </Card>
        <Card data-testid="analytics-classes-count">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("classes")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold" data-testid="analytics-classes-count-value">
              {classesCount}
            </div>
          </CardContent>
        </Card>
        <Card data-testid="analytics-q1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("quarter_1")} — {t("on_level_rate")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-emerald-600 dark:text-emerald-400">
              {q1.on_level_rate ?? 0}%
            </div>
            {q1.avg_total != null && (
              <p className="mt-1 text-xs text-muted-foreground">
                {t("avg_quarter_total")}: {q1.avg_total}
              </p>
            )}
          </CardContent>
        </Card>
        <Card data-testid="analytics-q2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("quarter_2")} — {t("on_level_rate")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-emerald-600 dark:text-emerald-400">
              {q2.on_level_rate ?? 0}%
            </div>
            {q2.avg_total != null && (
              <p className="mt-1 text-xs text-muted-foreground">
                {t("avg_quarter_total")}: {q2.avg_total}
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      <div className="section-bg-alt-2 rounded-xl border border-border/50 p-4">
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        data-testid="analytics-tabs"
      >
        <TabsList className="flex flex-wrap h-auto gap-1" data-testid="analytics-tabs-list">
          <TabsTrigger value="overview" data-testid="analytics-tab-overview">
            {t("overview")}
          </TabsTrigger>
          <TabsTrigger value="quarter1" data-testid="analytics-tab-quarter1">
            {t("quarter_1")}
          </TabsTrigger>
          <TabsTrigger value="quarter2" data-testid="analytics-tab-quarter2">
            {t("quarter_2")}
          </TabsTrigger>
          <TabsTrigger value="struggling" data-testid="analytics-tab-struggling">
            {t("struggling_students")}
          </TabsTrigger>
          <TabsTrigger value="excelling" data-testid="analytics-tab-excelling">
            {t("excelling_students")}
          </TabsTrigger>
          <TabsTrigger value="classes" data-testid="analytics-tab-classes">
            {t("classes")}
          </TabsTrigger>
          <TabsTrigger value="grades" data-testid="analytics-tab-grades">
            {t("grade")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6" data-testid="analytics-overview-content">
          <Card>
            <CardHeader>
              <CardTitle>{t("performance_distribution")} — {t("quarter_1")} vs {t("quarter_2")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-8 md:grid-cols-2">
                <div className="h-72" data-testid="analytics-overview-bar">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={comparisonBarData} barCategoryGap="20%" barGap={4}>
                      <XAxis dataKey="level" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey={t("quarter_1")} radius={[4, 4, 0, 0]}>
                        {comparisonBarData.map((entry, index) => (
                          <Cell key={`q1-${index}`} fill={PERFORMANCE_COLORS[entry.levelKey]} />
                        ))}
                      </Bar>
                      <Bar dataKey={t("quarter_2")} radius={[4, 4, 0, 0]}>
                        {comparisonBarData.map((entry, index) => (
                          <Cell key={`q2-${index}`} fill={PERFORMANCE_COLORS[entry.levelKey]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="h-64">
                    <p className="mb-2 text-sm font-medium text-muted-foreground">{t("quarter_1")}</p>
                    <ResponsiveContainer width="100%" height="90%">
                      <PieChart>
                        <Pie data={q1Distribution} dataKey="value" innerRadius={40} outerRadius={70}>
                          {q1Distribution.map((entry) => (
                            <Cell key={entry.level} fill={PERFORMANCE_COLORS[entry.level]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="h-64">
                    <p className="mb-2 text-sm font-medium text-muted-foreground">{t("quarter_2")}</p>
                    <ResponsiveContainer width="100%" height="90%">
                      <PieChart>
                        <Pie data={q2Distribution} dataKey="value" innerRadius={40} outerRadius={70}>
                          {q2Distribution.map((entry) => (
                            <Cell key={entry.level} fill={PERFORMANCE_COLORS[entry.level]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quarter1" className="mt-6" data-testid="analytics-quarter1-content">
          <Card>
            <CardHeader>
              <CardTitle>{t("quarter_1")} — {t("performance_distribution")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              <div className="h-64" data-testid="analytics-q1-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={q1Distribution} dataKey="value" innerRadius={60} outerRadius={90}>
                      {q1Distribution.map((entry) => (
                        <Cell key={entry.level} fill={PERFORMANCE_COLORS[entry.level]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3" data-testid="analytics-q1-list">
                {q1Distribution.map((item) => (
                  <div
                    key={item.level}
                    className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2"
                  >
                    <span className="text-sm font-medium">{item.name}</span>
                    <span className="text-sm text-muted-foreground">{item.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quarter2" className="mt-6" data-testid="analytics-quarter2-content">
          <Card>
            <CardHeader>
              <CardTitle>{t("quarter_2")} — {t("performance_distribution")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              <div className="h-64" data-testid="analytics-q2-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={q2Distribution} dataKey="value" innerRadius={60} outerRadius={90}>
                      {q2Distribution.map((entry) => (
                        <Cell key={entry.level} fill={PERFORMANCE_COLORS[entry.level]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3" data-testid="analytics-q2-list">
                {q2Distribution.map((item) => (
                  <div
                    key={item.level}
                    className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2"
                  >
                    <span className="text-sm font-medium">{item.name}</span>
                    <span className="text-sm text-muted-foreground">{item.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="struggling" className="mt-6" data-testid="analytics-struggling-content">
          <Card>
            <CardHeader>
              <CardTitle className="text-amber-700 dark:text-amber-400">
                {t("struggling_students")}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {t("students_needing_support")} — {t("weaknesses")}
              </p>
            </CardHeader>
            <CardContent>
              {(!overview?.struggling_students || overview.struggling_students.length === 0) ? (
                <p className="py-8 text-center text-muted-foreground">
                  {t("no_students_in_category")}
                </p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {overview.struggling_students.map((student) => (
                    <Card
                      key={student.id}
                      className="border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20"
                      data-testid={`analytics-struggling-${student.id}`}
                    >
                      <CardContent className="pt-4">
                        <p className="font-medium text-foreground">{student.full_name}</p>
                        <p className="text-sm text-muted-foreground">{student.class_name}</p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          <span
                            className={`rounded px-2 py-0.5 text-xs ${
                              student.performance_level_q1 === "below"
                                ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                                : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                            }`}
                          >
                            Q1: {t(student.performance_level_q1)}
                          </span>
                          <span
                            className={`rounded px-2 py-0.5 text-xs ${
                              student.performance_level_q2 === "below"
                                ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                                : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                            }`}
                          >
                            Q2: {t(student.performance_level_q2)}
                          </span>
                        </div>
                        {student.weak_areas?.length > 0 && (
                          <div className="mt-3">
                            <p className="text-xs font-medium text-muted-foreground">
                              {t("weaknesses")}:
                            </p>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {student.weak_areas.map((area) => (
                                <span
                                  key={area}
                                  className="rounded bg-amber-200/80 px-2 py-0.5 text-xs dark:bg-amber-800/40"
                                >
                                  {area}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="excelling" className="mt-6" data-testid="analytics-excelling-content">
          <Card>
            <CardHeader>
              <CardTitle className="text-emerald-700 dark:text-emerald-400">
                {t("excelling_students")}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {t("top_performers")} — {t("strengths")}
              </p>
            </CardHeader>
            <CardContent>
              {(!overview?.excelling_students || overview.excelling_students.length === 0) ? (
                <p className="py-8 text-center text-muted-foreground">
                  {t("no_students_in_category")}
                </p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {overview.excelling_students.map((student) => (
                    <Card
                      key={student.id}
                      className="border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/20"
                      data-testid={`analytics-excelling-${student.id}`}
                    >
                      <CardContent className="pt-4">
                        <p className="font-medium text-foreground">{student.full_name}</p>
                        <p className="text-sm text-muted-foreground">{student.class_name}</p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                            Q1: {t("on_level")}
                          </span>
                          <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                            Q2: {t("on_level")}
                          </span>
                        </div>
                        {student.strengths?.length > 0 && (
                          <div className="mt-3">
                            <p className="text-xs font-medium text-muted-foreground">
                              {t("strengths")}:
                            </p>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {student.strengths.map((strength) => (
                                <span
                                  key={strength}
                                  className="rounded bg-emerald-200/80 px-2 py-0.5 text-xs dark:bg-emerald-800/40"
                                >
                                  {strength}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="classes" className="mt-6" data-testid="analytics-classes-content">
          <Card>
            <CardHeader>
              <CardTitle>{t("students_per_class")}</CardTitle>
            </CardHeader>
            <CardContent>
              {activeTab === "classes" ? (
                <div className="h-72" data-testid="analytics-classes-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={classChartData} barSize={28}>
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="score" fill="#1e3a8a" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="grades" className="mt-6" data-testid="analytics-grades-content">
          <Card>
            <CardHeader>
              <CardTitle>{t("grade")}</CardTitle>
            </CardHeader>
            <CardContent>
              {activeTab === "grades" ? (
                <div className="h-72" data-testid="analytics-grades-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={gradeSummary} barSize={32}>
                      <XAxis dataKey="grade" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="avg" fill="#10b981" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>

      {/* Analysis insights: strengths, weaknesses, performance, standout data, actions, recommendations */}
      <section className="section-hover grid gap-4 rounded-xl border border-border/50 p-4 md:grid-cols-2" data-testid="analytics-insights">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-emerald-700 dark:text-emerald-400">{t("analysis_strengths")}</CardTitle>
            <p className="text-xs font-normal text-muted-foreground">{t("analysis_strengths_desc")}</p>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder={t("analysis_strengths_desc")}
              value={analysisStrengths}
              onChange={(e) => setAnalysisStrengths(e.target.value)}
              className="min-h-[100px] resize-y"
              data-testid="analytics-insights-strengths"
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-amber-700 dark:text-amber-400">{t("analysis_weaknesses")}</CardTitle>
            <p className="text-xs font-normal text-muted-foreground">{t("analysis_weaknesses_desc")}</p>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder={t("analysis_weaknesses_desc")}
              value={analysisWeaknesses}
              onChange={(e) => setAnalysisWeaknesses(e.target.value)}
              className="min-h-[100px] resize-y"
              data-testid="analytics-insights-weaknesses"
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("analysis_performance")}</CardTitle>
            <p className="text-xs font-normal text-muted-foreground">{t("analysis_performance_desc")}</p>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder={t("analysis_performance_desc")}
              value={analysisPerformance}
              onChange={(e) => setAnalysisPerformance(e.target.value)}
              className="min-h-[100px] resize-y"
              data-testid="analytics-insights-performance"
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("analysis_standout_data")}</CardTitle>
            <p className="text-xs font-normal text-muted-foreground">{t("analysis_standout_data_desc")}</p>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder={t("analysis_standout_data_desc")}
              value={analysisStandoutData}
              onChange={(e) => setAnalysisStandoutData(e.target.value)}
              className="min-h-[100px] resize-y"
              data-testid="analytics-insights-standout"
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("analysis_actions")}</CardTitle>
            <p className="text-xs font-normal text-muted-foreground">{t("analysis_actions_desc")}</p>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder={t("analysis_actions_desc")}
              value={analysisActions}
              onChange={(e) => setAnalysisActions(e.target.value)}
              className="min-h-[100px] resize-y"
              data-testid="analytics-insights-actions"
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("analysis_recommendations")}</CardTitle>
            <p className="text-xs font-normal text-muted-foreground">{t("analysis_recommendations_desc")}</p>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder={t("analysis_recommendations_desc")}
              value={analysisRecommendations}
              onChange={(e) => setAnalysisRecommendations(e.target.value)}
              className="min-h-[100px] resize-y"
              data-testid="analytics-insights-recommendations"
            />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
