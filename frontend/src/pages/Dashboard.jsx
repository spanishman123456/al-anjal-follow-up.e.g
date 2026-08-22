import { useEffect, useRef, useState } from "react";
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
} from "recharts";
import { toast } from "sonner";
import { api, getApiErrorMessage } from "@/lib/api";
import { useTranslations } from "@/lib/i18n";
import { displayQuarterNumber, termScopeIdFromOutlet } from "@/lib/academicScope";
import { AcademicTermSelect } from "@/components/layout/AcademicTermSelect";
import { sortByClassOrder } from "@/lib/utils";
import { PageHeader } from "@/components/layout/PageHeader";
import { ExpandableSection } from "@/components/ExpandableSection";
import { PerformanceLevelBadge } from "@/components/PerformanceLevelBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import TimetableEditor from "@/components/TimetableEditor";
import {
  PERFORMANCE_CHART_COLORS,
  performanceLegendSwatchClasses,
  performanceMetricTextClasses,
} from "@/lib/performanceBadges";
import { cn } from "@/lib/utils";
import { InternationalCompletionOverview } from "@/components/analytics/InternationalCompletionOverview";

const formatScore = (value, suffix = "") => {
  if (value === null || value === undefined) {
    return "—";
  }
  return `${value}${suffix}`;
};

export default function Dashboard() {
  const { language, semester, quarter, academicYear, profile } = useOutletContext();
  const t = useTranslations(language);
  const semesterNumber = semester === "semester2" ? 2 : 1;
  const termScopeId = termScopeIdFromOutlet(semester, quarter);
  const isTeacher = profile?.role_name === "Teacher";
  const [summary, setSummary] = useState(null);
  const [missedAssessments, setMissedAssessments] = useState(null);
  const [classSummary, setClassSummary] = useState([]);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);
  const lastMissedCountRef = useRef(null);
  const latestRequestIdRef = useRef(0);
  const [schedule, setSchedule] = useState({});
  const [savingSchedule, setSavingSchedule] = useState(false);

  const fetchSummary = async () => {
    const requestId = ++latestRequestIdRef.current;
    setLoading(true);
    const params = { semester: semesterNumber, quarter };
    try {
      const summaryRes = await api.get("/analytics/summary", { params });
      if (latestRequestIdRef.current !== requestId) return;
      setSummary(summaryRes.data);
    } catch (error) {
      if (latestRequestIdRef.current !== requestId) return;
      toast.error(getApiErrorMessage(error) || "Failed to load dashboard data");
    } finally {
      if (latestRequestIdRef.current === requestId) {
        setLoading(false);
      }
    }

    api
      .get("/analytics/missed-assessments", { params })
      .then((missedRes) => {
        if (latestRequestIdRef.current !== requestId) return;
        setMissedAssessments(missedRes.data);

        const groups = missedRes?.data?.groups || {};
        const missedCount =
          Number(groups?.quiz?.missed_count || 0) +
          Number(groups?.chapter_test?.missed_count || 0) +
          Number(groups?.final_practical?.missed_count || 0) +
          Number(groups?.final_theory?.missed_count || 0);
        if (missedCount > 0 && lastMissedCountRef.current !== missedCount) {
          toast.warning(
            t("missed_assessment_toast")
              .replace("{count}", String(missedCount))
              .replace("{semester}", String(semesterNumber))
              .replace("{quarter}", String(displayQuarterNumber(semesterNumber, quarter))),
          );
        }
        lastMissedCountRef.current = missedCount;
      })
      .catch(() => null);
    api
      .get("/classes/summary", { params })
      .then((response) => {
        if (latestRequestIdRef.current === requestId) setClassSummary(response.data || []);
      })
      .catch(() => null);
  };

  useEffect(() => {
    lastMissedCountRef.current = null;
    fetchSummary();
    api
      .get("/users/profile")
      .then((response) => setSchedule(response.data?.schedule || {}))
      .catch(() => null);
  }, [semesterNumber, quarter]);

  const handleScheduleSave = async () => {
    try {
      setSavingSchedule(true);
      await api.put("/users/profile/update", { schedule });
      toast.success(t("profile_updated"));
    } catch (error) {
      toast.error(t("profile_failed"));
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      await api.post("/import/excel", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Excel data imported successfully");
      window.dispatchEvent(new CustomEvent("students-updated"));
      fetchSummary();
    } catch (error) {
      toast.error(getApiErrorMessage(error) || "Import failed. Please check the file format.");
    }
  };

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") fetchSummary();
    };
    const onStudentsUpdated = () => fetchSummary();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("students-updated", onStudentsUpdated);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("students-updated", onStudentsUpdated);
    };
  }, [semesterNumber, quarter]);

  const distributionData = (summary?.distribution || []).map((item) => ({
    name: t(item.level),
    value: item.count,
    level: item.level,
  }));

  const classData = sortByClassOrder(summary?.students_per_class || []);
  const totalFromClasses = classData.reduce((sum, item) => sum + (Number(item.count) || 0), 0);
  const supportCount = summary
    ? summary.students_needing_support?.length ?? (summary.counts?.approach || 0) + (summary.counts?.below || 0)
    : 0;
  const assessmentCompletionItems = [
    ["quiz", t("assessment_quiz")],
    ["chapter_test", t("assessment_chapter_test")],
    ["final_practical", t("assessment_final_practical")],
    ["final_theory", t("assessment_final_theory")],
  ].map(([id, label]) => ({
    id,
    label,
    completed: Number(missedAssessments?.groups?.[id]?.submitted_count || 0),
    missing: Number(missedAssessments?.groups?.[id]?.missed_count || 0),
  }));
  const classCompletionRows = sortByClassOrder(classSummary).map((item) => ({
    id: item.class_id,
    name: item.class_name,
    total: Number(item.student_count || 0),
    completed: Math.max(Number(item.student_count || 0) - Number(item.distribution?.no_data || 0), 0),
  }));

  return (
    <div className="space-y-8" data-testid="dashboard-page">
      <PageHeader
        pageKey="dashboard"
        badges={[
          `${t("academic_year")}: ${academicYear}`,
          t(`term_${termScopeId}`),
        ]}
        testIdPrefix="dashboard"
        action={
          <div className="page-toolbar">
            <AcademicTermSelect
              testIdPrefix="dashboard-term"
              triggerClassName="w-[min(100%,240px)] sm:w-[240px] border-border bg-background text-foreground"
            />
            <Button
              variant="outline"
              className="page-hero-btn-secondary"
              onClick={fetchSummary}
              disabled={loading}
              data-testid="dashboard-refresh-button"
            >
              {t("refresh_data")}
            </Button>
          </div>
        }
      />

      <section
        className="section-bg-alt-1 grid items-stretch gap-4 rounded-xl border border-border/50 p-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7"
        data-testid="dashboard-metrics"
      >
        <Card className="flex h-full flex-col" data-testid="metric-total-students">
          <CardHeader className="flex-1 pb-2">
            <CardTitle
              className="text-sm text-muted-foreground"
              data-testid="metric-total-students-label"
            >
              {t("total_enrolled_students")}
            </CardTitle>
          </CardHeader>
          <CardContent className="mt-auto shrink-0">
            <div
              className="text-3xl font-bold"
              data-testid="metric-total-students-value"
            >
              {summary?.total_students ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card className="flex h-full flex-col" data-testid="metric-assessed-students">
          <CardHeader className="flex-1 pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              {t("assessed_students")}
            </CardTitle>
          </CardHeader>
          <CardContent className="mt-auto shrink-0">
            <div className="text-3xl font-bold text-sky-600" data-testid="metric-assessed-students-value">
              {summary?.students_with_data ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card className="flex h-full flex-col" data-testid="metric-no-data-students">
          <CardHeader className="flex-1 pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              {t("no_data_students")}
            </CardTitle>
          </CardHeader>
          <CardContent className="mt-auto shrink-0">
            <div
              className={cn("text-3xl font-bold", performanceMetricTextClasses.no_data)}
              data-testid="metric-no-data-students-value"
            >
              {summary?.students_no_data ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card className="flex h-full flex-col" data-testid="metric-exceeding">
          <CardHeader className="flex-1 pb-2">
            <CardTitle
              className="text-sm text-muted-foreground"
              data-testid="metric-exceeding-label"
            >
              {t("on_level")}
            </CardTitle>
          </CardHeader>
          <CardContent className="mt-auto shrink-0">
            <div
              className={cn("text-3xl font-bold", performanceMetricTextClasses.on_level)}
              data-testid="metric-exceeding-value"
            >
              {summary?.counts?.on_level ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card className="flex h-full flex-col" data-testid="metric-support">
          <CardHeader className="flex-1 pb-2">
            <CardTitle
              className="text-sm text-muted-foreground"
              data-testid="metric-support-label"
            >
              {t("need_support")}
            </CardTitle>
          </CardHeader>
          <CardContent className="mt-auto shrink-0">
            <div
              className={cn("text-3xl font-bold", performanceMetricTextClasses.approach)}
              data-testid="metric-support-value"
            >
              {supportCount}
            </div>
          </CardContent>
        </Card>
        <Card className="flex h-full flex-col" data-testid="metric-avg-quiz">
          <CardHeader className="flex-1 pb-2">
            <CardTitle
              className="text-sm text-muted-foreground"
              data-testid="metric-avg-quiz-label"
            >
              {t("avg_quiz_score")}
            </CardTitle>
          </CardHeader>
          <CardContent className="mt-auto shrink-0">
            <div
              className="text-3xl font-bold text-primary"
              data-testid="metric-avg-quiz-value"
            >
              {formatScore(summary?.avg_quiz_score, "/5")}
            </div>
          </CardContent>
        </Card>
        <Card className="flex h-full flex-col" data-testid="metric-avg-chapter">
          <CardHeader className="flex-1 pb-2">
            <CardTitle
              className="text-sm text-muted-foreground"
              data-testid="metric-avg-chapter-label"
            >
              {t("avg_chapter_score")}
            </CardTitle>
          </CardHeader>
          <CardContent className="mt-auto shrink-0">
            <div
              className="text-3xl font-bold text-sky-600"
              data-testid="metric-avg-chapter-value"
            >
              {formatScore(summary?.avg_chapter_score, "/10")}
            </div>
          </CardContent>
        </Card>
      </section>
      <p className="text-xs text-muted-foreground" data-testid="dashboard-metrics-scope-note">
        {t("dashboard_metrics_scope_note")}
      </p>

      <InternationalCompletionOverview
        t={t}
        testItems={assessmentCompletionItems}
        classRows={classCompletionRows}
        testIdPrefix="dashboard"
      />

      <section className="section-bg-alt-2 grid gap-6 rounded-xl border border-border/50 p-4 lg:grid-cols-3 animate-stagger" data-testid="dashboard-main">
        <Card className="lg:col-span-2 card-hover" data-testid="dashboard-distribution">
          <CardHeader>
            <CardTitle data-testid="dashboard-distribution-title">
              {t("performance_distribution")}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2">
            <div className="h-64" data-testid="dashboard-distribution-chart">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={distributionData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={90}
                  >
                    {distributionData.map((entry) => (
                      <Cell
                        key={entry.level}
                        fill={PERFORMANCE_CHART_COLORS[entry.level] || PERFORMANCE_CHART_COLORS.no_data}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3" data-testid="dashboard-distribution-list">
              {distributionData.map((item) => (
                <div
                  key={item.level}
                  className="list-row-interactive flex items-center justify-between rounded-lg border border-border/60 px-3 py-2"
                  data-testid={`dashboard-distribution-${item.level}`}
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <span
                      className={cn(
                        "inline-block h-2.5 w-2.5 shrink-0 rounded-full",
                        performanceLegendSwatchClasses[item.level] || performanceLegendSwatchClasses.no_data,
                      )}
                      aria-hidden
                    />
                    {item.name}
                  </span>
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover" data-testid="dashboard-import">
          <CardHeader>
            <CardTitle data-testid="dashboard-import-title">
              {t("import_excel")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground" data-testid="dashboard-import-instructions">
              {t("import_instructions")}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileSelected}
              style={{ display: "none" }}
              aria-hidden="true"
              data-testid="dashboard-import-file-input"
            />
            <Button
              className="w-full"
              onClick={handleImportClick}
              data-testid="dashboard-import-submit-button"
            >
              {t("import_excel")}
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-3" data-testid="dashboard-lists">
        <Card className="lg:col-span-2 card-hover" data-testid="dashboard-class-counts">
          <CardHeader>
            <CardTitle data-testid="dashboard-class-counts-title">
              {t("students_per_class")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64" data-testid="dashboard-class-chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={classData} barSize={28}>
                  <XAxis dataKey="class_name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#1e3a8a" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-3 text-xs text-muted-foreground" data-testid="dashboard-class-total-from-breakdown">
              {t("total_from_classes")}: <span className="font-semibold text-foreground">{totalFromClasses}</span>
            </p>
          </CardContent>
        </Card>
        <Card className="card-hover" data-testid="dashboard-support-list">
          <CardHeader>
            <CardTitle data-testid="dashboard-support-title">
              {t("students_needing_support")}
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-[32rem] space-y-3 overflow-y-auto pr-1">
            {summary?.students_needing_support?.length ? (
              summary.students_needing_support.map((student) => (
                <div
                  key={student.id}
                  className="list-row-interactive flex items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2"
                  data-testid={`support-student-${student.id}`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold" data-testid={`support-student-name-${student.id}`}>
                      {student.full_name}
                    </p>
                    <p className="text-xs text-muted-foreground" data-testid={`support-student-class-${student.id}`}>
                      {student.class_name}
                    </p>
                  </div>
                  <PerformanceLevelBadge
                    level={student.performance_level}
                    label={t(student.performance_level)}
                    data-testid={`support-student-level-${student.id}`}
                  />
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground" data-testid="support-empty">
                {t("no_data")}
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2" data-testid="dashboard-performers">
        <Card className="card-hover" data-testid="dashboard-top-performers">
          <CardHeader>
            <CardTitle data-testid="dashboard-top-performers-title">
              {t("top_performers")}
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-[28rem] space-y-3 overflow-y-auto pr-1">
            {summary?.top_performers?.length ? (
              summary.top_performers.map((student) => (
                <div
                  key={student.id}
                  className="list-row-interactive flex items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2"
                  data-testid={`top-performer-${student.id}`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold" data-testid={`top-performer-name-${student.id}`}>
                      {student.full_name}
                    </p>
                    <p className="text-xs text-muted-foreground" data-testid={`top-performer-class-${student.id}`}>
                      {student.class_name}
                    </p>
                  </div>
                  <PerformanceLevelBadge
                    level="on_level"
                    label={formatScore(student.total_score_normalized, "/50")}
                    data-testid={`top-performer-score-${student.id}`}
                  />
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground" data-testid="top-performers-empty">
                {t("no_data")}
              </p>
            )}
          </CardContent>
        </Card>
        <Card className="card-hover" data-testid="dashboard-average-scores">
          <CardHeader>
            <CardTitle data-testid="dashboard-average-title">
              {t("avg_total_score")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between" data-testid="avg-total-score">
              <span className="text-sm text-muted-foreground">{t("avg_total_score")}</span>
              <span className="text-sm font-semibold">
                {formatScore(summary?.avg_total_score, "/50")}
              </span>
            </div>
            <div className="flex items-center justify-between" data-testid="avg-chapter-score">
              <span className="text-sm text-muted-foreground">{t("avg_chapter_score")}</span>
              <span className="text-sm font-semibold">
                {formatScore(summary?.avg_chapter_score, "/10")}
              </span>
            </div>
            <div className="rounded-lg border border-border/60 p-3 text-sm text-muted-foreground" data-testid="thresholds-note">
              {t("dashboard_thresholds_note")}
            </div>
          </CardContent>
        </Card>
      </section>

      <ExpandableSection
        title={t("timetable")}
        defaultOpen={isTeacher}
        testId="dashboard-timetable-section"
        className="section-hover"
        headerExtra={
          <Button
            variant="success"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleScheduleSave();
            }}
            disabled={savingSchedule}
            data-testid="dashboard-timetable-save"
          >
            {t("save_changes")}
          </Button>
        }
      >
        <div data-testid="dashboard-timetable">
          <TimetableEditor
            schedule={schedule}
            onChange={setSchedule}
            orientation="days-rows"
            dayLabels={[t("sunday"), t("monday"), t("tuesday"), t("wednesday"), t("thursday")]}
            dayHeaderLabel={t("day")}
          />
        </div>
      </ExpandableSection>
    </div>
  );
}
