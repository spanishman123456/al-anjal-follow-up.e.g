import { useEffect, useMemo, useRef, useState } from "react";
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
  CartesianGrid,
} from "recharts";
import { api, getApiErrorMessage } from "@/lib/api";
import {
  TERM_SCOPES,
  termScopeIdFromOutlet,
  resolveTermScope,
} from "@/lib/academicScope";
import { buildAutoInsightsFromOverview } from "@/lib/insightAutofill";
import { useTranslations } from "@/lib/i18n";
import { sortByClassOrder } from "@/lib/utils";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles, TrendingUp, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  BOARD,
  BoardShell,
  BoardPanel,
  BoardHighlightsCard,
  ClassAverageBarChart,
  PassSplitDonut,
  ScoreBreakdownDonut,
  QuarterOnLevelFocus,
  ClassScoreArea,
} from "@/components/dashboard/VisualBoard";

const PERFORMANCE_COLORS = {
  on_level: "#10b981",
  approach: "#f59e0b",
  below: "#ef4444",
  no_data: "#94a3b8",
};

const STUDENT_BREAKDOWN_COLORS = ["#38bdf8", "#22c55e", "#f59e0b", "#8b5cf6", "#ef4444"];

function toChartNumber(value) {
  if (value == null || value === "") return 0;
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function buildStudentBreakdownData(student, apiQuarter, t) {
  if (!student) return [];
  const defs = apiQuarter === 2
    ? [
        { label: t("quiz3"), value: student.focus_quiz_primary, max: 5 },
        { label: t("quiz4"), value: student.focus_quiz_secondary, max: 5 },
        { label: t("chapter_test2_practical"), value: student.focus_chapter_test, max: 10 },
        { label: t("quarter2_practical"), value: student.focus_final_practical, max: 10 },
        { label: t("quarter2_theory"), value: student.focus_final_theory, max: 10 },
      ]
    : [
        { label: t("quiz1"), value: student.focus_quiz_primary, max: 5 },
        { label: t("quiz2"), value: student.focus_quiz_secondary, max: 5 },
        { label: t("chapter_test1_practical"), value: student.focus_chapter_test, max: 10 },
        { label: t("quarter1_practical"), value: student.focus_final_practical, max: 10 },
        { label: t("quarter1_theory"), value: student.focus_final_theory, max: 10 },
      ];
  const rows = defs.map((item, index) => ({
    name: item.label,
    score: toChartNumber(item.value),
    max: item.max,
    fill: STUDENT_BREAKDOWN_COLORS[index % STUDENT_BREAKDOWN_COLORS.length],
  }));
  const total = rows.reduce((sum, row) => sum + row.score, 0);
  return rows.map((row) => ({
    ...row,
    share: total > 0 ? Math.round((row.score / total) * 1000) / 10 : 0,
    pctOfMax: row.max > 0 ? Math.round((row.score / row.max) * 1000) / 10 : 0,
  }));
}

const AnalyticsTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border/70 bg-background/95 px-3 py-2 text-xs shadow-lg backdrop-blur-sm">
      <p className="font-semibold">{label}</p>
      {payload.map((entry, idx) => (
        <p key={`${entry.name}-${idx}`} className="text-muted-foreground">
          {entry.name}: <span className="font-semibold text-foreground">{entry.value}</span>
        </p>
      ))}
    </div>
  );
};

export default function Analytics() {
  const { language, semester, quarter } = useOutletContext();
  const t = useTranslations(language);
  const [termScopeId, setTermScopeId] = useState(() =>
    termScopeIdFromOutlet(semester, quarter),
  );
  useEffect(() => {
    setTermScopeId(termScopeIdFromOutlet(semester, quarter));
  }, [semester, quarter]);
  const term = resolveTermScope(termScopeId);
  const apiSemester = term.semester;
  const apiQuarter = term.quarter;
  const [overview, setOverview] = useState(null);
  const [classSummary, setClassSummary] = useState([]);
  const [activeTab, setActiveTab] = useState("overview");
  const [classOptions, setClassOptions] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState("all");
  const [studentOptions, setStudentOptions] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState("all");
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [analysisStrengths, setAnalysisStrengths] = useState("");
  const [analysisWeaknesses, setAnalysisWeaknesses] = useState("");
  const [analysisPerformance, setAnalysisPerformance] = useState("");
  const [analysisStandoutData, setAnalysisStandoutData] = useState("");
  const [analysisActions, setAnalysisActions] = useState("");
  const [analysisRecommendations, setAnalysisRecommendations] = useState("");
  const latestRequestIdRef = useRef(0);

  const applyGeneratedInsights = (generated) => {
    if (!generated) return;
    setAnalysisStrengths(generated.analysis_strengths || "");
    setAnalysisWeaknesses(generated.analysis_weaknesses || "");
    setAnalysisPerformance(generated.analysis_performance || "");
    setAnalysisStandoutData(generated.analysis_standout_data || "");
    setAnalysisActions(generated.analysis_actions || "");
    setAnalysisRecommendations(generated.analysis_recommendations || "");
  };

  const autoFillInsights = () => {
    if (!overview) return;
    applyGeneratedInsights(buildAutoInsightsFromOverview(overview, apiQuarter, language));
  };

  useEffect(() => {
    const loadAnalytics = async () => {
      const requestId = ++latestRequestIdRef.current;
      setLoading(true);
      const params = {
        semester: apiSemester,
        quarter: apiQuarter,
        ...(selectedClassId !== "all" ? { class_id: selectedClassId } : {}),
        ...(selectedStudentId !== "all" ? { student_id: selectedStudentId } : {}),
      };
      const classSummaryParams = {
        semester: apiSemester,
        quarter: apiQuarter,
        ...(selectedClassId !== "all" ? { class_id: selectedClassId } : {}),
      };

      try {
        const overviewRes = await api.get("/analytics/overview", { params });
        if (latestRequestIdRef.current !== requestId) return;
        setOverview(overviewRes.data);
      } catch (error) {
        if (latestRequestIdRef.current !== requestId) return;
        try {
          const summaryRes = await api.get("/analytics/summary", { params });
          if (latestRequestIdRef.current !== requestId) return;
          const s = summaryRes.data;
          const dist = s?.distribution || [
            { level: "on_level", count: 0 },
            { level: "approach", count: 0 },
            { level: "below", count: 0 },
            { level: "no_data", count: 0 },
          ];
          const selectedQuarterSummary = {
            distribution: dist,
            avg_total: s?.avg_total_score ?? null,
            on_level_rate: s?.on_level_rate ?? s?.exceeding_rate ?? 0,
            total_with_data: (s?.total_students ?? 0) - (dist.find((d) => d.level === "no_data")?.count ?? 0),
          };
          setOverview({
            total_students: s?.total_students ?? 0,
            classes_count: s?.classes_count ?? 0,
            quarter1: apiQuarter === 1 ? selectedQuarterSummary : { distribution: [], avg_total: null, on_level_rate: 0, total_with_data: 0 },
            quarter2: apiQuarter === 2 ? selectedQuarterSummary : { distribution: [], avg_total: null, on_level_rate: 0, total_with_data: 0 },
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
              performance_level_q1: st.performance_level ?? "on_level",
              performance_level_q2: st.performance_level ?? "on_level",
              strengths: [],
            })),
            students_per_class: s?.students_per_class ?? [],
          });
        } catch (fallbackError) {
          if (latestRequestIdRef.current !== requestId) return;
          setOverview(null);
          setClassSummary([]);
          toast.error(getApiErrorMessage(fallbackError) || t("analytics_failed"));
        }
      } finally {
        if (latestRequestIdRef.current === requestId) setLoading(false);
      }

      api
        .get("/classes/summary", { params: classSummaryParams })
        .then((res) => {
          if (latestRequestIdRef.current !== requestId) return;
          setClassSummary(res.data || []);
        })
        .catch(() => {
          if (latestRequestIdRef.current !== requestId) return;
          setClassSummary([]);
        });

      api
        .get("/classes")
        .then((res) => {
          if (latestRequestIdRef.current !== requestId) return;
          setClassOptions(res.data || []);
        })
        .catch(() => {
          if (latestRequestIdRef.current !== requestId) return;
          setClassOptions([]);
        });

      if (selectedClassId !== "all") {
        api
          .get("/students", { params: { class_id: selectedClassId } })
          .then((res) => {
            if (latestRequestIdRef.current !== requestId) return;
            setStudentOptions(res.data || []);
          })
          .catch(() => {
            if (latestRequestIdRef.current !== requestId) return;
            setStudentOptions([]);
          });
      } else {
        setStudentOptions([]);
      }
    };
    loadAnalytics();
  }, [apiSemester, apiQuarter, selectedClassId, selectedStudentId, refreshKey]);

  useEffect(() => {
    if (selectedClassId === "all") {
      if (selectedStudentId !== "all") setSelectedStudentId("all");
      return;
    }
    if (selectedStudentId !== "all" && !studentOptions.some((student) => student.id === selectedStudentId)) {
      setSelectedStudentId("all");
    }
  }, [selectedClassId, selectedStudentId, studentOptions]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") setRefreshKey((k) => k + 1);
    };
    const onStudentsUpdated = () => setRefreshKey((k) => k + 1);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("students-updated", onStudentsUpdated);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("students-updated", onStudentsUpdated);
    };
  }, []);

  useEffect(() => {
    if (!overview) return;
    applyGeneratedInsights(buildAutoInsightsFromOverview(overview, apiQuarter, language));
  }, [overview, apiQuarter, language]);

  useEffect(() => {
    if (activeTab === "quarter2") setActiveTab("quarter1");
  }, [activeTab]);

  const q1 = overview?.quarter1 || {};
  const q2 = overview?.quarter2 || {};
  const selectedStudent = overview?.selected_student || null;
  const isStudentScoped = selectedStudentId !== "all" && !!selectedStudent;
  const selectedStudentTermTotal = apiQuarter === 2 ? selectedStudent?.quarter2_total : selectedStudent?.quarter1_total;
  const selectedStudentPerformanceLevel =
    apiQuarter === 2 ? selectedStudent?.performance_level_q2 : selectedStudent?.performance_level_q1;
  const studentBreakdownData = useMemo(
    () => (isStudentScoped && selectedStudent ? buildStudentBreakdownData(selectedStudent, apiQuarter, t) : []),
    [apiQuarter, isStudentScoped, selectedStudent, t],
  );
  const selectedStudentAchievementRate = useMemo(() => {
    if (!isStudentScoped) return 0;
    const total = Number(selectedStudentTermTotal);
    return Number.isFinite(total) ? Math.round((total / 50) * 1000) / 10 : 0;
  }, [isStudentScoped, selectedStudentTermTotal]);
  const selectedStudentStrongestComponent = useMemo(() => {
    if (!studentBreakdownData.length) return null;
    return [...studentBreakdownData].sort((a, b) => b.score - a.score)[0] || null;
  }, [studentBreakdownData]);
  const selectedStudentWeakestComponent = useMemo(() => {
    if (!studentBreakdownData.length) return null;
    return [...studentBreakdownData].sort((a, b) => a.score - b.score)[0] || null;
  }, [studentBreakdownData]);
  const selectedQuarterDistribution = useMemo(
    () => (apiQuarter === 1 ? q1.distribution || [] : q2.distribution || []),
    [apiQuarter, q1.distribution, q2.distribution],
  );
  const focusOnLevelRate = useMemo(() => {
    if (isStudentScoped) return selectedStudentAchievementRate;
    const dist = selectedQuarterDistribution || [];
    const onLevel = Number(dist.find((d) => d.level === "on_level")?.count ?? 0);
    const total = dist.reduce((sum, d) => sum + Number(d?.count ?? 0), 0);
    return total > 0 ? Math.round((onLevel / total) * 1000) / 10 : 0;
  }, [isStudentScoped, selectedQuarterDistribution, selectedStudentAchievementRate]);
  const q1Distribution = isStudentScoped
    ? studentBreakdownData.map((item) => ({
        name: item.name,
        value: item.score,
        level: item.name,
        fill: item.fill,
      }))
    : (q1.distribution || []).map((item) => ({
        name: t(item.level),
        value: item.count,
        level: item.level,
      }));

  const distributionBarData = useMemo(() => {
    if (isStudentScoped) {
      return studentBreakdownData.map((item) => ({
        level: item.name,
        levelKey: item.name,
        count: item.score,
        fill: item.fill,
      }));
    }
    const dist = apiQuarter === 1 ? q1.distribution : q2.distribution;
    const levels = ["on_level", "approach", "below"];
    return levels.map((level) => ({
      level: t(level),
      levelKey: level,
      count: dist?.find((d) => d.level === level)?.count ?? 0,
    }));
  }, [apiQuarter, isStudentScoped, q1.distribution, q2.distribution, studentBreakdownData, t]);

  const classChartData = useMemo(() => {
    if (isStudentScoped && selectedStudent) {
      return studentBreakdownData.map((item) => ({
        name: item.name,
        score: item.score,
      }));
    }
    return sortByClassOrder(
      classSummary.filter((cls) => selectedClassId === "all" || cls.class_id === selectedClassId),
    ).map((cls) => ({
      name: cls.class_name,
      score: cls.avg_total_score || 0,
    }));
  }, [classSummary, isStudentScoped, selectedClassId, selectedStudent, studentBreakdownData]);

  const gradeSummary = useMemo(() => {
    if (isStudentScoped && selectedStudent) {
      return [
        {
          grade: t(selectedStudentPerformanceLevel || "no_data"),
          avg: selectedStudentTermTotal != null ? Number(selectedStudentTermTotal) : 0,
        },
      ];
    }
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
  }, [classSummary, isStudentScoped, selectedStudent, selectedStudentPerformanceLevel, selectedStudentTermTotal, t]);

  const aiInsightRows = useMemo(() => {
    if (isStudentScoped && selectedStudent) {
      return [
        {
          icon: TrendingUp,
          tone: "text-emerald-600 dark:text-emerald-400",
          text:
            selectedStudentTermTotal != null
              ? `${selectedStudent.full_name} scored ${selectedStudentTermTotal}/50 and is currently ${t(selectedStudentPerformanceLevel || "no_data")} for ${t(`term_${termScopeId}`)}.`
              : `${selectedStudent.full_name} is currently ${t(selectedStudentPerformanceLevel || "no_data")} for ${t(`term_${termScopeId}`)}.`,
        },
        {
          icon: Sparkles,
          tone: "text-sky-600 dark:text-sky-400",
          text:
            selectedStudentStrongestComponent
              ? `Strongest scored area so far is ${selectedStudentStrongestComponent.name} with ${selectedStudentStrongestComponent.score}${selectedStudentStrongestComponent.max ? `/${selectedStudentStrongestComponent.max}` : ""}.`
              : `The strongest scored area will appear once component marks are available for ${selectedStudent.full_name}.`,
        },
        {
          icon: AlertTriangle,
          tone: "text-amber-600 dark:text-amber-400",
          text:
            selectedStudentWeakestComponent
              ? `Lowest scored area so far is ${selectedStudentWeakestComponent.name} with ${selectedStudentWeakestComponent.score}${selectedStudentWeakestComponent.max ? `/${selectedStudentWeakestComponent.max}` : ""}.`
              : selectedStudent.weak_areas?.length > 0
                ? `Focus: ${selectedStudent.weak_areas.join(", ")}.`
                : selectedStudent.strengths?.length > 0
                  ? `Strengths: ${selectedStudent.strengths.join(", ")}.`
                  : "Focus insight will appear once more scored records are available for this student.",
        },
      ];
    }
    const focus = apiQuarter === 1 ? q1 : q2;
    const dist = focus.distribution || [];
    const onLevel = Number(dist.find((d) => d.level === "on_level")?.count ?? 0);
    const total = dist.reduce((sum, d) => sum + Number(d?.count ?? 0), 0);
    const focusRate = total > 0 ? Math.round((onLevel / total) * 1000) / 10 : 0;
    const focusAvg = focus.avg_total ?? null;

    const classesWithAvg = [...classSummary].filter((c) => c.avg_total_score != null);
    const byAscendingAvg = [...classesWithAvg].sort((a, b) => (a.avg_total_score ?? 999) - (b.avg_total_score ?? 999));
    const weakestClass = byAscendingAvg[0] ?? null;
    const strongestClass = byAscendingAvg.length > 0 ? byAscendingAvg[byAscendingAvg.length - 1] : null;
    const weakestAvg = Number(weakestClass?.avg_total_score ?? 0);
    const strongestAvg = Number(strongestClass?.avg_total_score ?? 0);
    const hasContrast =
      weakestClass &&
      strongestClass &&
      weakestClass.class_id !== strongestClass.class_id &&
      weakestAvg < strongestAvg;

    return [
      {
        icon: TrendingUp,
        tone: "text-emerald-600 dark:text-emerald-400",
        text: `On-level rate for the selected term is ${focusRate}%.`,
      },
      {
        icon: Sparkles,
        tone: "text-sky-600 dark:text-sky-400",
        text:
          focusAvg != null
            ? `Average quarter total for the selected term is ${focusAvg}.`
            : "Waiting for more scored records to compute the quarter average.",
      },
      {
        icon: AlertTriangle,
        tone: "text-amber-600 dark:text-amber-400",
        text: hasContrast
          ? `Focus: ${weakestClass.class_name} is currently the lowest average class, while ${strongestClass.class_name} leads the cohort.`
          : classesWithAvg.length
            ? "Focus: Class averages are currently tied or only one class has data; more scored records will show a clear lowest vs leading contrast."
            : "Focus: Class-level contrast insight will appear once class averages are available.",
      },
    ];
  }, [
    apiQuarter,
    q1.distribution,
    q2.distribution,
    q1.avg_total,
    q2.avg_total,
    classSummary,
    isStudentScoped,
    selectedStudent,
    selectedStudentStrongestComponent,
    selectedStudentPerformanceLevel,
    selectedStudentTermTotal,
    selectedStudentWeakestComponent,
    t,
    termScopeId,
  ]);

  const handleDownload = async (format) => {
    try {
      const response = await api.get("/analytics/summary/export", {
        params: {
          format,
          semester: apiSemester,
          quarter: apiQuarter,
          ...(selectedClassId !== "all" ? { class_id: selectedClassId } : {}),
          ...(selectedStudentId !== "all" ? { student_id: selectedStudentId } : {}),
        },
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      const fnBase = `analytics_s${apiSemester}_q${apiQuarter}${
        selectedClassId !== "all"
          ? `_${selectedClassId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 24)}`
          : ""
      }${
        selectedStudentId !== "all"
          ? `_${selectedStudentId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 24)}`
          : ""
      }`;
      link.setAttribute("download", `${fnBase}.${format === "excel" ? "xlsx" : "pdf"}`);
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
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex min-w-[220px] flex-col gap-1">
              <span className="text-xs text-muted-foreground">{t("analytics_term_scope")}</span>
              <Select value={termScopeId} onValueChange={setTermScopeId}>
                <SelectTrigger className="w-48" data-testid="analytics-term-scope">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TERM_SCOPES.map((s) => (
                    <SelectItem key={s.id} value={s.id} data-testid={`analytics-term-${s.id}`}>
                      {t(`term_${s.id}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex min-w-[220px] flex-col gap-1">
              <span className="select-none text-xs text-muted-foreground opacity-0" aria-hidden="true">
                {t("analytics_term_scope")}
              </span>
              <Select
                value={selectedClassId}
                onValueChange={(value) => {
                  setSelectedClassId(value);
                  setSelectedStudentId("all");
                }}
              >
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
            </div>
            {selectedClassId !== "all" && (
              <div className="flex min-w-[220px] flex-col gap-1">
                <span className="select-none text-xs text-muted-foreground opacity-0" aria-hidden="true">
                  {t("analytics_term_scope")}
                </span>
                <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                  <SelectTrigger className="w-56" data-testid="analytics-student-filter">
                    <SelectValue placeholder={t("select_student")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" data-testid="analytics-student-all">
                      {t("all_students")}
                    </SelectItem>
                    {studentOptions.map((student) => (
                      <SelectItem
                        key={student.id}
                        value={student.id}
                        data-testid={`analytics-student-${student.id}`}
                      >
                        {student.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
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
            <Button
              variant="outline"
              onClick={autoFillInsights}
              data-testid="analytics-autofill-insights"
            >
              Auto-fill AI comments
            </Button>
          </div>
        }
      />

      <p className="text-xs text-muted-foreground" data-testid="analytics-term-hint">
        {t("analytics_term_scope_hint")}
      </p>

      <BoardShell
        sidebar={
          overview && totalStudents > 0 ? (
            <>
              <BoardHighlightsCard title={t("visual_board_key_highlights")}>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">{t("analytics_term_scope")}</p>
                  <p className="font-medium text-foreground">{t(`term_${termScopeId}`)}</p>
                </div>
                {isStudentScoped && selectedStudent && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">{t("student_name")}</p>
                    <p className="font-medium text-foreground">{selectedStudent.full_name}</p>
                  </div>
                )}
                <div className="rounded-lg border border-border/60 bg-background/80 px-3 py-2">
                  <p className="text-xs text-muted-foreground">
                    {isStudentScoped ? t("analytics_student_total") : t("analytics_focus_quarter")}
                  </p>
                  <p className="text-lg font-semibold tabular-nums text-primary">
                    {isStudentScoped
                      ? `${selectedStudentTermTotal != null ? selectedStudentTermTotal : "—"}/50`
                      : `${focusOnLevelRate}%`}
                    {!isStudentScoped && (
                      <span className="ml-1 text-sm font-normal text-muted-foreground">{t("on_level")}</span>
                    )}
                  </p>
                  {isStudentScoped && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {selectedStudentAchievementRate}% {t("analytics_student_achievement_caption")}
                    </p>
                  )}
                </div>
                <ul className="space-y-2 border-t border-border/50 pt-2 text-xs text-muted-foreground">
                  <li>
                    <span className="font-medium text-foreground">{totalStudents}</span> {t("total_students").toLowerCase()}
                  </li>
                  <li>
                    <span className="font-medium text-foreground">{classesCount}</span> {t("classes").toLowerCase()}
                  </li>
                  {overview.struggling_students?.length > 0 && (
                    <li className="text-amber-700 dark:text-amber-400">
                      {overview.struggling_students.length} {t("struggling_students").toLowerCase()}
                    </li>
                  )}
                  {overview.excelling_students?.length > 0 && (
                    <li className="text-emerald-700 dark:text-emerald-400">
                      {overview.excelling_students.length} {t("excelling_students").toLowerCase()}
                    </li>
                  )}
                </ul>
              </BoardHighlightsCard>
              <BoardHighlightsCard title={t("key_insights")}>
                <p>
                  <span className="font-medium text-foreground">{t(`term_${termScopeId}`)}:</span>{" "}
                  {isStudentScoped
                    ? `${selectedStudentTermTotal != null ? selectedStudentTermTotal : "—"}/50`
                    : `${focusOnLevelRate}% ${t("on_level")}`}
                  {!isStudentScoped && (apiQuarter === 1 ? q1.avg_total : q2.avg_total) != null && (
                    <span className="text-muted-foreground">
                      {" "}
                      · {t("avg_quarter_total")}: {apiQuarter === 1 ? q1.avg_total : q2.avg_total}
                    </span>
                  )}
                  {isStudentScoped && selectedStudentStrongestComponent && (
                    <span className="text-muted-foreground">
                      {" "}
                      · {selectedStudentStrongestComponent.name}: {selectedStudentStrongestComponent.score}
                    </span>
                  )}
                </p>
              </BoardHighlightsCard>
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
              {t("refresh_data")}…
            </div>
          )
        }
      >
      {/* Metric cards */}
      <section className="section-bg-alt-1 grid gap-4 rounded-xl border border-border/50 p-4 md:grid-cols-2 lg:grid-cols-3" data-testid="analytics-metrics">
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
        <Card data-testid="analytics-focus-quarter" className="ring-2 ring-primary ring-offset-2 ring-offset-background">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {isStudentScoped ? t("analytics_student_total") : `${t(`term_${termScopeId}`)} — ${t("on_level_rate")}`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-emerald-600 dark:text-emerald-400">
              {isStudentScoped
                ? `${selectedStudentTermTotal != null ? selectedStudentTermTotal : "—"}/50`
                : `${focusOnLevelRate}%`}
            </div>
            {!isStudentScoped && (apiQuarter === 1 ? q1.avg_total : q2.avg_total) != null && (
              <p className="mt-1 text-xs text-muted-foreground">
                {t("avg_quarter_total")}: {apiQuarter === 1 ? q1.avg_total : q2.avg_total}
              </p>
            )}
            {isStudentScoped && (
              <p className="mt-1 text-xs text-muted-foreground">
                {selectedStudentAchievementRate}% {t("analytics_student_achievement_caption")}
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      {overview && totalStudents > 0 && (
        <div className="grid gap-4 md:grid-cols-2" data-testid="analytics-visual-board-grid">
          <BoardPanel
            title={isStudentScoped ? t("analytics_student_marks_breakdown") : t("visual_board_chart_class_avg")}
            subtitle={isStudentScoped ? t("analytics_student_marks_breakdown_sub") : t("visual_board_chart_class_avg_sub")}
            testId="analytics-board-class-avg"
          >
            <ClassAverageBarChart data={classChartData} height={260} />
          </BoardPanel>
          <BoardPanel
            title={isStudentScoped ? t("analytics_student_component_share") : t("visual_board_chart_pass_split")}
            subtitle={isStudentScoped ? t("analytics_student_component_share_sub") : t("visual_board_chart_pass_split_sub")}
            testId="analytics-board-donut"
          >
            {isStudentScoped ? (
              <ScoreBreakdownDonut
                data={studentBreakdownData.map((item) => ({
                  name: item.name,
                  value: item.score,
                  fill: item.fill,
                }))}
                centerCaption={t("total_score")}
                height={260}
              />
            ) : (
              <PassSplitDonut
                distribution={selectedQuarterDistribution}
                onLevelLabel={t("on_level")}
                approachingLabel={t("visual_board_approaching_full_score")}
                belowLabel={t("visual_board_below_level")}
                noDataLabel={t("no_data")}
                centerCaption={t("on_level")}
                height={260}
              />
            )}
          </BoardPanel>
          <BoardPanel
            title={isStudentScoped ? t("analytics_student_achievement") : t("visual_board_chart_q_focus")}
            subtitle={isStudentScoped ? t("analytics_student_achievement_sub") : t("visual_board_chart_q_focus_sub")}
            testId="analytics-board-q-focus"
          >
            <QuarterOnLevelFocus
              rate={focusOnLevelRate}
              termLabel={isStudentScoped ? selectedStudent?.full_name : t(`term_${termScopeId}`)}
              lineName={isStudentScoped ? t("analytics_student_achievement_caption") : t("visual_board_line_cohort")}
              height={240}
            />
          </BoardPanel>
          <BoardPanel
            title={isStudentScoped ? t("analytics_student_component_profile") : t("visual_board_chart_class_curve")}
            subtitle={isStudentScoped ? t("analytics_student_component_profile_sub") : t("visual_board_chart_class_curve_sub")}
            testId="analytics-board-class-area"
          >
            <ClassScoreArea data={classChartData} height={240} />
          </BoardPanel>
        </div>
      )}

      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5" data-testid="analytics-ai-panel">
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" />
              AI Analytics Studio
            </CardTitle>
            <Badge variant="secondary" className="font-normal">
              Auto-updated by selected filters
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {aiInsightRows.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="rounded-lg border border-border/60 bg-background/70 px-3 py-2 text-sm"
                data-testid={`analytics-ai-insight-${idx}`}
              >
                <p className="flex items-start gap-2">
                  <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${item.tone}`} />
                  <span>{item.text}</span>
                </p>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="section-bg-alt-2 rounded-xl border border-border/50 p-4">
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        data-testid="analytics-tabs"
      >
        <TabsList className="flex h-auto flex-wrap gap-1 rounded-xl bg-muted/60 p-1" data-testid="analytics-tabs-list">
          <TabsTrigger value="overview" data-testid="analytics-tab-overview">
            {t("overview")}
          </TabsTrigger>
          <TabsTrigger value="quarter1" data-testid="analytics-tab-quarter1">
            {t("quarter_1")}
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
          <BoardPanel
            title={
              isStudentScoped
                ? `${t("analytics_student_marks_breakdown")} — ${t(`term_${termScopeId}`)}`
                : `${t("performance_distribution")} — ${t(`term_${termScopeId}`)}`
            }
            subtitle={
              <span className="inline-flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <Badge variant="outline" className="font-normal">
                  {t(apiSemester === 1 ? "semester_one" : "semester_two")} · {isStudentScoped ? t("analytics_student_marks_breakdown_sub") : t("analytics_charts_semester_badge")}
                </Badge>
              </span>
            }
          >
            <div className="h-80" data-testid="analytics-overview-bar">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={distributionBarData} barCategoryGap="22%" margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={BOARD.grid} vertical={false} />
                  <XAxis dataKey="level" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip content={<AnalyticsTooltip />} />
                  <Legend />
                  <Bar dataKey="count" name={isStudentScoped ? t("total_score") : t("students")} radius={[6, 6, 0, 0]} maxBarSize={56}>
                    {distributionBarData.map((entry, index) => (
                      <Cell key={`d-${index}`} fill={isStudentScoped ? entry.fill : PERFORMANCE_COLORS[entry.levelKey]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </BoardPanel>
        </TabsContent>

        <TabsContent value="quarter1" className="mt-6" data-testid="analytics-quarter1-content">
          <Card className="border-primary/20 shadow-sm">
            <CardHeader>
              <CardTitle>
                {isStudentScoped ? t("analytics_student_component_share") : `${t("quarter_1")} — ${t("performance_distribution")}`}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              <div className="h-64" data-testid="analytics-q1-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={q1Distribution} dataKey="value" innerRadius={60} outerRadius={90}>
                      {q1Distribution.map((entry) => (
                        <Cell key={entry.level} fill={isStudentScoped ? entry.fill : PERFORMANCE_COLORS[entry.level]} />
                      ))}
                    </Pie>
                    <Tooltip content={<AnalyticsTooltip />} />
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

        <TabsContent value="struggling" className="mt-6" data-testid="analytics-struggling-content">
          <Card>
            <CardHeader>
              <CardTitle className="text-amber-700 dark:text-amber-400">
                {t("struggling_students")}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {t("analytics_lists_for_term")} {t(`term_${termScopeId}`)} · {t("students_needing_support")} —{" "}
                {t("weaknesses")}
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
                              (apiQuarter === 1 ? student.performance_level_q1 : student.performance_level_q2) ===
                              "below"
                                ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                                : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                            }`}
                          >
                            {t(`term_${termScopeId}`)}:{" "}
                            {t(apiQuarter === 1 ? student.performance_level_q1 : student.performance_level_q2)}
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
                {t("analytics_lists_for_term")} {t(`term_${termScopeId}`)} · {t("top_performers")} — {t("strengths")}
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
                            {t(`term_${termScopeId}`)}:{" "}
                            {t(
                              (apiQuarter === 1 ? student.performance_level_q1 : student.performance_level_q2) ||
                                "on_level",
                            )}
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
          <Card className="border-primary/20 shadow-sm">
            <CardHeader>
              <CardTitle>{isStudentScoped ? t("analytics_student_total") : t("students_per_class")}</CardTitle>
            </CardHeader>
            <CardContent>
              {activeTab === "classes" ? (
                <div className="h-72" data-testid="analytics-classes-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={classChartData} barSize={28}>
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip content={<AnalyticsTooltip />} />
                      <Bar dataKey="score" fill="#1e3a8a" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="grades" className="mt-6" data-testid="analytics-grades-content">
          <Card className="border-primary/20 shadow-sm">
            <CardHeader>
              <CardTitle>{isStudentScoped ? t("performance_level") : t("grade")}</CardTitle>
            </CardHeader>
            <CardContent>
              {activeTab === "grades" ? (
                <div className="h-72" data-testid="analytics-grades-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={gradeSummary} barSize={32}>
                      <XAxis dataKey="grade" />
                      <YAxis />
                      <Tooltip content={<AnalyticsTooltip />} />
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

      <Card className="rounded-xl border border-slate-200/90 bg-white shadow-sm dark:border-border dark:bg-card">
        <CardHeader>
          <CardTitle className="text-base">{t("visual_board_full_analysis")}</CardTitle>
          <div className="grid gap-4 pt-2 md:grid-cols-2">
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-sm">
              <p className="font-semibold text-foreground">{t("visual_board_guide_read")}</p>
              <p className="mt-1.5 leading-relaxed text-muted-foreground">{t("visual_board_guide_read_body")}</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-sm">
              <p className="font-semibold text-foreground">{t("visual_board_guide_use")}</p>
              <p className="mt-1.5 leading-relaxed text-muted-foreground">{t("visual_board_guide_use_body")}</p>
            </div>
          </div>
        </CardHeader>
      </Card>

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
      </BoardShell>
    </div>
  );
}
