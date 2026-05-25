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
  termScopeIdFromOutlet,
  resolveTermScope,
  displayQuarterLabel,
  displayQuarterNumber,
} from "@/lib/academicScope";
import { AcademicTermSelect } from "@/components/layout/AcademicTermSelect";
import { buildAutoInsightsFromOverview } from "@/lib/insightAutofill";
import { useTranslations } from "@/lib/i18n";
import { sortByClassOrder } from "@/lib/utils";
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
  BoardHighlightsCard,
  ClassAverageBarChart,
  PassSplitDonut,
  ScoreBreakdownDonut,
  QuarterOnLevelFocus,
  ClassScoreArea,
} from "@/components/dashboard/VisualBoard";
import { ExpandableSection } from "@/components/ExpandableSection";
import { PerformanceLevelBadge } from "@/components/PerformanceLevelBadge";
import { PERFORMANCE_CHART_COLORS, getScoreBandBadgeClass } from "@/lib/performanceBadges";
import {
  MetricCard,
  ChartCard,
  InsightPanel,
  InsightRow,
  DashboardLoading,
  DashboardEmpty,
  AnalyticsToolbar,
  FilterField,
  DashboardPageHeader,
} from "@/components/analytics";

const STUDENT_BREAKDOWN_COLORS = ["#0ea5e9", "#38bdf8", "#22c55e", "#f59e0b", "#8b5cf6", "#ef4444"];

function toChartNumber(value) {
  if (value == null || value === "") return 0;
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function buildStudentBreakdownData(student, apiQuarter, t) {
  if (!student) return [];
  const defs = apiQuarter === 2
    ? [
        { key: "assessment", label: t("assessment"), value: student.focus_assessment, max: 15, kind: "assessment" },
        { key: "quiz3", label: t("quiz3"), value: student.focus_quiz_primary, max: 5, kind: "quiz" },
        { key: "quiz4", label: t("quiz4"), value: student.focus_quiz_secondary, max: 5, kind: "quiz" },
        { key: "chapter_test2", label: t("chapter_test2_practical"), value: student.focus_chapter_test, max: 10, kind: "chapter" },
        { key: "quarter2_practical", label: t("quarter2_practical"), value: student.focus_final_practical, max: 10, kind: "final" },
        { key: "quarter2_theory", label: t("quarter2_theory"), value: student.focus_final_theory, max: 10, kind: "final" },
      ]
    : [
        { key: "assessment", label: t("assessment"), value: student.focus_assessment, max: 15, kind: "assessment" },
        { key: "quiz1", label: t("quiz1"), value: student.focus_quiz_primary, max: 5, kind: "quiz" },
        { key: "quiz2", label: t("quiz2"), value: student.focus_quiz_secondary, max: 5, kind: "quiz" },
        { key: "chapter_test1", label: t("chapter_test1_practical"), value: student.focus_chapter_test, max: 10, kind: "chapter" },
        { key: "quarter1_practical", label: t("quarter1_practical"), value: student.focus_final_practical, max: 10, kind: "final" },
        { key: "quarter1_theory", label: t("quarter1_theory"), value: student.focus_final_theory, max: 10, kind: "final" },
      ];
  const quizDefs = defs.filter((item) => item.kind === "quiz");
  const quizScores = quizDefs.map((item) => toChartNumber(item.value));
  const bestQuizIndex = quizScores.length ? (quizScores[0] >= quizScores[1] ? 0 : 1) : -1;
  const rows = defs.map((item, index) => {
    const score = toChartNumber(item.value);
    const quizIndex = quizDefs.findIndex((entry) => entry.key === item.key);
    const excludedFromTotal = item.kind === "quiz" && score > 0 && quizIndex !== bestQuizIndex;
    const countedScore = excludedFromTotal ? 0 : score;
    return {
      name: item.label,
      legendName: excludedFromTotal ? `${item.label} (${t("analytics_shown_not_counted")})` : item.label,
      score,
      countedScore,
      max: item.max,
      fill: STUDENT_BREAKDOWN_COLORS[index % STUDENT_BREAKDOWN_COLORS.length],
      opacity: excludedFromTotal ? 0.4 : 1,
      excludedFromTotal,
    };
  });
  const total = rows.reduce((sum, row) => sum + row.countedScore, 0);
  return rows.map((row) => ({
    ...row,
    share: total > 0 ? Math.round((row.countedScore / total) * 1000) / 10 : 0,
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
      {payload.some((entry) => entry?.payload?.excludedFromTotal) && (
        <p className="mt-1 text-muted-foreground">{payload.find((entry) => entry?.payload?.excludedFromTotal)?.payload?.legendName}</p>
      )}
    </div>
  );
};

export default function Analytics() {
  const { language, semester, quarter } = useOutletContext();
  const t = useTranslations(language);
  const termScopeId = termScopeIdFromOutlet(semester, quarter);
  const term = resolveTermScope(termScopeId);
  const apiSemester = term.semester;
  const apiQuarter = term.quarter;
  const sameSemesterQuarterOneLabel = displayQuarterLabel(t, apiSemester, 1);
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
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
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
        legendName: item.legendName,
        value: item.score,
        level: item.name,
        fill: item.fill,
        opacity: item.opacity,
        excludedFromTotal: item.excludedFromTotal,
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
        opacity: item.opacity,
        excludedFromTotal: item.excludedFromTotal,
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
        fill: item.fill,
        opacity: item.opacity,
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
    if (format === "pdf" && isExportingPdf) return;
    if (format === "excel" && isExportingExcel) return;
    if (format === "pdf") setIsExportingPdf(true);
    if (format === "excel") setIsExportingExcel(true);
    const timerLabel = format === "pdf" ? "analytics-pdf-export" : "analytics-excel-export";
    console.time(timerLabel);
    try {
      const response = await api.get("/analytics/summary/export", {
        params: {
          format,
          semester: apiSemester,
          quarter: apiQuarter,
          ...(selectedClassId !== "all" ? { class_id: selectedClassId } : {}),
          ...(selectedStudentId !== "all" ? { student_id: selectedStudentId } : {}),
          analysis_strengths: analysisStrengths,
          analysis_weaknesses: analysisWeaknesses,
          analysis_performance: analysisPerformance,
          analysis_standout_data: analysisStandoutData,
          analysis_actions: analysisActions,
          analysis_recommendations: analysisRecommendations,
          lang: language,
        },
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      const fnBase = `analytics_s${apiSemester}_q${displayQuarterNumber(apiSemester, apiQuarter)}${
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
      toast.success(format === "pdf" ? "PDF downloaded successfully" : "Excel downloaded successfully");
    } catch (error) {
      console.error("Analytics export failed:", {
        format,
        semester: apiSemester,
        quarter: apiQuarter,
        selectedClassId,
        selectedStudentId,
        error,
      });
      let detail = getApiErrorMessage(error);
      if (error?.response?.data instanceof Blob) {
        try {
          const errText = await error.response.data.text();
          const parsed = JSON.parse(errText);
          detail = parsed?.detail || parsed?.message || detail;
        } catch {
          // keep fallback detail
        }
      }
      toast.error(
        format === "pdf"
          ? `PDF export failed because the report could not be rendered. ${detail || "Please try again."}`
          : `Excel export failed. ${detail || "Please try again."}`,
      );
    } finally {
      console.timeEnd(timerLabel);
      if (format === "pdf") setIsExportingPdf(false);
      if (format === "excel") setIsExportingExcel(false);
    }
  };

  if (loading && !overview) {
    return (
      <div className="analytics-page dashboard-premium-shell page-enter space-y-8" data-testid="analytics-page">
        <DashboardPageHeader
          title={t("analytics")}
          subtitle={t("hero_eyebrow_analysis_term")}
          description={t("analytics_page_description")}
          metaItems={[t(`term_${termScopeId}`)]}
          testId="analytics-hero-loading"
        />
        <DashboardLoading message={t("analytics_loading")} testId="analytics-loading" />
      </div>
    );
  }

  const totalStudents = overview?.total_students ?? 0;
  const classesCount = overview?.classes_count ?? 0;
  const focusAvg = apiQuarter === 1 ? q1.avg_total : q2.avg_total;

  return (
    <div className="analytics-page dashboard-premium-shell page-enter space-y-6 sm:space-y-8" data-testid="analytics-page">
      <DashboardPageHeader
        title={t("analytics")}
        subtitle={t("hero_eyebrow_analysis_term")}
        description={t("analytics_page_description")}
        metaItems={[t(`term_${termScopeId}`), selectedClassId === "all" ? t("all_classes") : t("class_name")]}
        actions={
          <>
            <Button
              variant="secondary"
              className="page-hero-btn-primary"
              onClick={() => handleDownload("pdf")}
              data-testid="analytics-hero-download-pdf"
              disabled={isExportingPdf}
            >
              {isExportingPdf ? "Preparing PDF..." : t("download_pdf")}
            </Button>
            <Button
              variant="outline"
              className="page-hero-btn-secondary"
              onClick={() => setRefreshKey((k) => k + 1)}
              data-testid="analytics-hero-refresh"
            >
              {t("refresh_data")}
            </Button>
          </>
        }
        testId="analytics-hero"
      />

      <AnalyticsToolbar
        testId="analytics-toolbar"
        filters={
          <>
            <FilterField label={t("analytics_term_scope")}>
              <AcademicTermSelect testIdPrefix="analytics-term" />
            </FilterField>
            <FilterField label={t("classes")}>
              <Select
                value={selectedClassId}
                onValueChange={(value) => {
                  setSelectedClassId(value);
                  setSelectedStudentId("all");
                }}
              >
                <SelectTrigger className="w-full min-w-[12rem] sm:w-48" data-testid="analytics-class-filter">
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
            </FilterField>
            {selectedClassId !== "all" && (
              <FilterField label={t("students")}>
                <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                  <SelectTrigger className="w-full min-w-[12rem] sm:w-56" data-testid="analytics-student-filter">
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
              </FilterField>
            )}
          </>
        }
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => handleDownload("pdf")}
              data-testid="analytics-download-pdf"
              disabled={isExportingPdf}
            >
              {isExportingPdf ? "Preparing PDF..." : t("download_pdf")}
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleDownload("excel")}
              data-testid="analytics-download-excel"
              disabled={isExportingExcel}
            >
              {isExportingExcel ? "Preparing Excel..." : t("download_excel")}
            </Button>
            <Button variant="outline" onClick={autoFillInsights} data-testid="analytics-autofill-insights">
              Auto-fill AI comments
            </Button>
          </>
        }
      />

      <p className="text-xs text-muted-foreground" data-testid="analytics-term-hint">
        {t("analytics_term_scope_hint")}
      </p>

      {!overview ? (
        <DashboardEmpty
          title={t("analytics_no_data")}
          description={t("analytics_failed")}
          actionLabel={t("analytics_retry")}
          onAction={() => setRefreshKey((k) => k + 1)}
          testId="analytics-empty"
        />
      ) : null}

      {overview ? (
      <BoardShell
        sidebar={
          totalStudents > 0 ? (
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
                      {selectedStudentAchievementRate}%
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
      <section className="space-y-3" data-testid="analytics-metrics">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t("analytics_kpi_section")}
        </h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={TrendingUp}
            label={t("total_students")}
            value={totalStudents}
            delta={`${focusOnLevelRate}% ${t("on_level")}`}
            deltaTone={focusOnLevelRate >= 75 ? "positive" : focusOnLevelRate < 50 ? "negative" : "neutral"}
            hint={t("dashboard_metrics_scope_note")}
            status={t("overview")}
            testId="analytics-total-students"
          />
          <MetricCard
            icon={Sparkles}
            label={t("classes")}
            value={classesCount}
            delta={selectedClassId === "all" ? t("all_classes") : t("class_name")}
            hint={t(`term_${termScopeId}`)}
            status={t("analytics")}
            testId="analytics-classes-count"
          />
          <MetricCard
            icon={AlertTriangle}
            label={isStudentScoped ? t("analytics_student_total") : `${t(`term_${termScopeId}`)} — ${t("on_level_rate")}`}
            value={
              isStudentScoped
                ? `${selectedStudentTermTotal != null ? selectedStudentTermTotal : "—"}/50`
                : `${focusOnLevelRate}%`
            }
            delta={
              isStudentScoped
                ? `${selectedStudentPerformanceLevel ? t(selectedStudentPerformanceLevel) : t("no_data")}`
                : `${t("avg_quarter_total")}: ${focusAvg != null ? focusAvg : "—"}`
            }
            deltaTone={
              isStudentScoped
                ? selectedStudentPerformanceLevel === "on_level"
                  ? "positive"
                  : selectedStudentPerformanceLevel === "below"
                    ? "negative"
                    : "neutral"
                : focusOnLevelRate >= 75
                  ? "positive"
                  : focusOnLevelRate < 50
                    ? "negative"
                    : "neutral"
            }
            hint={
              !isStudentScoped && focusAvg != null
                ? `${t("avg_quarter_total")}: ${focusAvg}`
                : isStudentScoped
                  ? `${selectedStudentAchievementRate}%`
                  : undefined
            }
            accent="primary"
            status={t("key_insights")}
            testId="analytics-focus-quarter"
          />
          <MetricCard
            icon={Sparkles}
            label={t("students_needing_support")}
            value={overview?.struggling_students?.length ?? 0}
            delta={`${overview?.excelling_students?.length ?? 0} ${t("top_performers").toLowerCase()}`}
            deltaTone={(overview?.struggling_students?.length ?? 0) > 0 ? "negative" : "positive"}
            hint={t("dashboard_thresholds_note")}
            accent="warning"
            status={t(`term_${termScopeId}`)}
            testId="analytics-support-count"
          />
        </div>
      </section>

      {totalStudents > 0 && (
        <section className="space-y-3" data-testid="analytics-visual-board-grid">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t("analytics_visual_insights")}
          </h2>
          <div className="analytics-chart-grid-premium">
          <ChartCard
            title={isStudentScoped ? t("analytics_student_marks_breakdown") : t("visual_board_chart_class_avg")}
            subtitle={isStudentScoped ? t("analytics_student_marks_breakdown_sub") : t("visual_board_chart_class_avg_sub")}
            summary={!isStudentScoped && focusAvg != null ? String(focusAvg) : undefined}
            summaryLabel={!isStudentScoped ? t("avg_quarter_total") : undefined}
            badge={<Badge variant="outline">{t("key_insights")}</Badge>}
            testId="analytics-board-class-avg"
            span="hero"
            insight={isStudentScoped ? t("analytics_student_component_profile_sub") : t("visual_board_chart_class_avg_sub")}
          >
            <ClassAverageBarChart data={classChartData} height={260} />
          </ChartCard>
          <ChartCard
            title={isStudentScoped ? t("analytics_student_component_share") : t("visual_board_chart_pass_split")}
            subtitle={isStudentScoped ? t("analytics_student_component_share_sub") : t("visual_board_chart_pass_split_sub")}
            summary={!isStudentScoped ? `${focusOnLevelRate}%` : undefined}
            summaryLabel={!isStudentScoped ? t("on_level") : undefined}
            testId="analytics-board-donut"
            span="donut"
            insight={isStudentScoped ? t("analytics_student_component_share_sub") : t("visual_board_chart_pass_split_sub")}
          >
            {isStudentScoped ? (
              <ScoreBreakdownDonut
                data={studentBreakdownData.map((item) => ({
                  name: item.name,
                  legendName: item.legendName,
                  value: item.score,
                  share: item.share,
                  fill: item.fill,
                  opacity: item.opacity,
                }))}
                centerValue={selectedStudentTermTotal}
                centerCaption={t("total_score")}
                height={300}
              />
            ) : (
              <PassSplitDonut
                distribution={selectedQuarterDistribution}
                onLevelLabel={t("on_level")}
                approachingLabel={t("visual_board_approaching_full_score")}
                belowLabel={t("visual_board_below_level")}
                noDataLabel={t("no_data")}
                centerCaption={t("on_level")}
                height={280}
              />
            )}
          </ChartCard>
          <ChartCard
            title={isStudentScoped ? t("analytics_student_achievement") : t("visual_board_chart_q_focus")}
            subtitle={isStudentScoped ? t("analytics_student_achievement_sub") : t("visual_board_chart_q_focus_sub")}
            testId="analytics-board-q-focus"
            insight={isStudentScoped ? t("analytics_student_achievement_caption") : t("visual_board_chart_q_focus_sub")}
          >
            <QuarterOnLevelFocus
              rate={isStudentScoped ? selectedStudentTermTotal : focusOnLevelRate}
              termLabel={isStudentScoped ? selectedStudent?.full_name : t(`term_${termScopeId}`)}
              lineName={isStudentScoped ? t("focus_quarter_total") : t("visual_board_line_cohort")}
              maxValue={isStudentScoped ? 50 : 100}
              labelFormatter={isStudentScoped ? ((value) => `${value}/50`) : undefined}
              height={240}
            />
          </ChartCard>
          <ChartCard
            title={isStudentScoped ? t("analytics_student_component_profile") : t("visual_board_chart_class_curve")}
            subtitle={isStudentScoped ? t("analytics_student_component_profile_sub") : t("visual_board_chart_class_curve_sub")}
            testId="analytics-board-class-area"
            insight={isStudentScoped ? t("analytics_student_component_profile_sub") : t("visual_board_chart_class_curve_sub")}
          >
            <ClassScoreArea data={classChartData} height={240} />
          </ChartCard>
          </div>
        </section>
      )}

      <InsightPanel
        title="AI Analytics Studio"
        badge={
          <Badge variant="secondary" className="font-normal">
            Auto-updated by selected filters
          </Badge>
        }
        testId="analytics-ai-panel"
      >
        {aiInsightRows.map((item, idx) => (
          <InsightRow
            key={idx}
            icon={item.icon}
            tone={item.tone}
            text={item.text}
            testId={`analytics-ai-insight-${idx}`}
          />
        ))}
      </InsightPanel>

      <section className="grid gap-4 lg:grid-cols-3" data-testid="analytics-story-cards">
        <article className="story-card">
          <p className="story-card-kicker">Key Insight</p>
          <h3 className="story-card-title">{isStudentScoped ? selectedStudent?.full_name || t("students") : t("on_level")}</h3>
          <p className="story-card-body">
            {isStudentScoped
              ? `${t("analytics_student_total")}: ${selectedStudentTermTotal != null ? selectedStudentTermTotal : "—"}/50.`
              : `${focusOnLevelRate}% ${t("on_level")} ${t("analytics_focus_quarter").toLowerCase()}.`}
          </p>
        </article>
        <article className="story-card">
          <p className="story-card-kicker">Performance Trend</p>
          <h3 className="story-card-title">{t(`term_${termScopeId}`)}</h3>
          <p className="story-card-body">
            {focusAvg != null
              ? `${t("avg_quarter_total")}: ${focusAvg}.`
              : t("dashboard_thresholds_note")}
          </p>
        </article>
        <article className="story-card">
          <p className="story-card-kicker">Recommended Action</p>
          <h3 className="story-card-title">{t("analysis_actions")}</h3>
          <p className="story-card-body">
            {analysisActions?.trim()
              ? analysisActions.trim().slice(0, 160)
              : t("analysis_actions_desc")}
          </p>
        </article>
      </section>

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
            {sameSemesterQuarterOneLabel}
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
          <ChartCard
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
            span="full"
          >
            <div className="h-80" data-testid="analytics-overview-bar">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={distributionBarData} barCategoryGap="22%" margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={BOARD.grid} vertical={false} />
                  <XAxis
                    dataKey="level"
                    tick={{ fontSize: 11 }}
                    interval={0}
                    angle={isStudentScoped ? -18 : 0}
                    textAnchor={isStudentScoped ? "end" : "middle"}
                    height={isStudentScoped ? 64 : 30}
                  />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip content={<AnalyticsTooltip />} />
                  <Legend />
                  <Bar dataKey="count" name={isStudentScoped ? t("total_score") : t("students")} radius={[6, 6, 0, 0]} maxBarSize={56}>
                    {distributionBarData.map((entry, index) => (
                      <Cell
                        key={`d-${index}`}
                        fill={isStudentScoped ? entry.fill : PERFORMANCE_CHART_COLORS[entry.levelKey]}
                        fillOpacity={isStudentScoped ? (entry.opacity ?? 1) : 1}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </TabsContent>

        <TabsContent value="quarter1" className="mt-6" data-testid="analytics-quarter1-content">
          <Card className="border-primary/20 shadow-sm">
            <CardHeader>
              <CardTitle>
                {isStudentScoped ? t("analytics_student_component_share") : `${sameSemesterQuarterOneLabel} — ${t("performance_distribution")}`}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              <div className="h-64" data-testid="analytics-q1-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={q1Distribution} dataKey="value" innerRadius={60} outerRadius={90}>
                      {q1Distribution.map((entry) => (
                        <Cell
                          key={entry.level}
                          fill={isStudentScoped ? entry.fill : PERFORMANCE_CHART_COLORS[entry.level]}
                          fillOpacity={isStudentScoped ? (entry.opacity ?? 1) : 1}
                        />
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
                    className="interactive-surface flex items-center justify-between rounded-lg border border-border/60 px-3 py-2"
                  >
                    <span className="text-sm font-medium">{item.legendName || item.name}</span>
                    <span className="text-sm text-muted-foreground">{item.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="struggling" className="mt-6" data-testid="analytics-struggling-content">
          <Card className="card-hover">
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
                      className="card-hover border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20"
                      data-testid={`analytics-struggling-${student.id}`}
                    >
                      <CardContent className="pt-4">
                        <p className="font-medium text-foreground">{student.full_name}</p>
                        <p className="text-sm text-muted-foreground">{student.class_name}</p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          <PerformanceLevelBadge
                            level={
                              apiQuarter === 1
                                ? student.performance_level_q1
                                : student.performance_level_q2
                            }
                            label={`${t(`term_${termScopeId}`)}: ${t(
                              apiQuarter === 1
                                ? student.performance_level_q1
                                : student.performance_level_q2,
                            )}`}
                            className="text-xs"
                          />
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
          <Card className="card-hover">
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
                      className="card-hover border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/20"
                      data-testid={`analytics-excelling-${student.id}`}
                    >
                      <CardContent className="pt-4">
                        <p className="font-medium text-foreground">{student.full_name}</p>
                        <p className="text-sm text-muted-foreground">{student.class_name}</p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          <PerformanceLevelBadge
                            level={
                              (apiQuarter === 1
                                ? student.performance_level_q1
                                : student.performance_level_q2) || "on_level"
                            }
                            label={`${t(`term_${termScopeId}`)}: ${t(
                              (apiQuarter === 1
                                ? student.performance_level_q1
                                : student.performance_level_q2) || "on_level",
                            )}`}
                            className="text-xs"
                          />
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
          <Card className="card-hover border-primary/20 shadow-sm">
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
          <Card className="card-hover border-primary/20 shadow-sm">
            <CardHeader>
              <CardTitle>{isStudentScoped ? t("performance_level") : t("grade")}</CardTitle>
            </CardHeader>
            <CardContent>
              {activeTab === "grades" ? (
                <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
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
                  <div className="space-y-2" data-testid="analytics-grades-badges">
                    {gradeSummary.map((item) => (
                      <div
                        key={item.grade}
                        className="interactive-surface flex items-center justify-between rounded-lg border border-border/60 px-3 py-2"
                      >
                        <span className="text-sm font-medium">{item.grade}</span>
                        <Badge
                          variant="outline"
                          className={getScoreBandBadgeClass(item.avg, isStudentScoped ? 50 : 100)}
                        >
                          {item.avg}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>

      <Card className="card-hover rounded-xl border border-slate-200/90 bg-white shadow-sm dark:border-border dark:bg-card">
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

      <ExpandableSection
        title={t("visual_board_full_analysis")}
        description={t("analysis_strengths_desc")}
        defaultOpen={false}
        testId="analytics-insights"
        className="section-hover"
      >
      <section className="grid gap-4 md:grid-cols-2">
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
      </ExpandableSection>
      </BoardShell>
      ) : null}
    </div>
  );
}
