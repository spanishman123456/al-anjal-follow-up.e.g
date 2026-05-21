import { useState, useEffect, useRef } from "react";
import { useOutletContext, Link } from "react-router-dom";
import { api } from "@/lib/api";
import {
  TERM_SCOPES,
  termScopeIdFromOutlet,
  resolveTermScope,
} from "@/lib/academicScope";
import { buildAutoInsightsFromReport } from "@/lib/insightAutofill";
import { useTranslations } from "@/lib/i18n";
import { getClassGradeValue } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Sparkles, TrendingUp, AlertTriangle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BoardShell,
  BoardHighlightsCard,
  ClassAverageBarChart,
  PassSplitDonut,
  QuarterOnLevelFocus,
  ClassScoreArea,
} from "@/components/dashboard/VisualBoard";
import { ExpandableSection } from "@/components/ExpandableSection";
import { PerformanceLevelBadge } from "@/components/PerformanceLevelBadge";
import {
  performanceChipClasses,
  performanceLegendSwatchClasses,
  performanceTextClasses,
  getScoreBandBadgeClass,
} from "@/lib/performanceBadges";
import {
  MetricCard,
  ChartCard,
  ReportCoverMeta,
  ReportSection,
  AnalyticsToolbar,
  FilterField,
  DashboardPageHeader,
} from "@/components/analytics";

export default function Reports() {
  const { language, semester, quarter, profile, classes: contextClasses = [] } = useOutletContext();
  const t = useTranslations(language);
  const isTeacher = profile?.role_name === "Teacher";
  const [termScopeId, setTermScopeId] = useState(() =>
    termScopeIdFromOutlet(semester, quarter),
  );
  useEffect(() => {
    setTermScopeId(termScopeIdFromOutlet(semester, quarter));
  }, [semester, quarter]);
  const term = resolveTermScope(termScopeId);
  const apiSemester = term.semester;
  const apiQuarter = term.quarter;
  const [grade, setGrade] = useState("4");
  const [reportType, setReportType] = useState("summary");
  const isFullReport = reportType === "full";
  const [report, setReport] = useState(null);
  const [analysisStrengths, setAnalysisStrengths] = useState("");
  const [analysisWeaknesses, setAnalysisWeaknesses] = useState("");
  const [analysisPerformance, setAnalysisPerformance] = useState("");
  const [analysisStandoutData, setAnalysisStandoutData] = useState("");
  const [analysisActions, setAnalysisActions] = useState("");
  const [analysisRecommendations, setAnalysisRecommendations] = useState("");
  const fetchReportRef = useRef(() => {});
  const hasReportRef = useRef(false);
  const availableGrades = Array.from(
    new Set(
      (contextClasses || [])
        .map((cls) => getClassGradeValue(cls))
        .filter((value) => Number.isFinite(value) && value > 0),
    ),
  ).sort((a, b) => a - b);

  useEffect(() => {
    if (!availableGrades.length) {
      setGrade("");
      setReport(null);
      return;
    }
    if (!availableGrades.includes(Number(grade))) {
      setGrade(String(availableGrades[0]));
    }
  }, [availableGrades, grade]);

  const applyGeneratedInsights = (generated) => {
    if (!generated) return;
    setAnalysisStrengths(generated.analysis_strengths || "");
    setAnalysisWeaknesses(generated.analysis_weaknesses || "");
    setAnalysisPerformance(generated.analysis_performance || "");
    setAnalysisStandoutData(generated.analysis_standout_data || "");
    setAnalysisActions(generated.analysis_actions || "");
    setAnalysisRecommendations(generated.analysis_recommendations || "");
  };

  const autoFillInsights = (reportData = report) => {
    if (!reportData) {
      toast.info("Generate the report first to auto-fill comments.");
      return;
    }
    applyGeneratedInsights(buildAutoInsightsFromReport(reportData, language));
  };

  const fetchReport = () => {
    if (!grade) return;
    api
      .get("/reports/grade", { params: { grade, semester: apiSemester, quarter: apiQuarter } })
      .then((res) => {
        const reportData = res.data;
        setReport(reportData);
        applyGeneratedInsights(buildAutoInsightsFromReport(reportData, language));
      })
      .catch(() => {});
  };
  fetchReportRef.current = fetchReport;

  const handleGenerate = async () => {
    if (!grade) return;
    const response = await api.get("/reports/grade", {
      params: { grade, semester: apiSemester, quarter: apiQuarter },
    });
    const reportData = response.data;
    setReport(reportData);
    applyGeneratedInsights(buildAutoInsightsFromReport(reportData, language));
  };

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible" && grade) fetchReportRef.current();
    };
    const onStudentsUpdated = () => fetchReportRef.current();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("students-updated", onStudentsUpdated);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("students-updated", onStudentsUpdated);
    };
  }, []);

  useEffect(() => {
    hasReportRef.current = Boolean(report);
  }, [report]);

  useEffect(() => {
    if (!grade || !hasReportRef.current) return;
    fetchReportRef.current();
  }, [grade, termScopeId]);

  useEffect(() => {
    if (!report) return;
    applyGeneratedInsights(buildAutoInsightsFromReport(report, language));
  }, [report, language]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = async (format) => {
    try {
      const response = await api.get("/reports/grade/export", {
        params: {
          grade,
          format,
          report_type: reportType,
          semester: apiSemester,
          quarter: apiQuarter,
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
      link.setAttribute(
        "download",
        `grade_${grade}_${termScopeId}_report.${format === "excel" ? "xlsx" : "pdf"}`,
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      toast.error(t("download_fail"));
    }
  };

  const handleSchedule = async () => {
    try {
      await api.post("/reports/settings", {
        grade: Number(grade),
        report_type: reportType,
      });
      toast.success(t("schedule_success"));
    } catch (error) {
      toast.error(t("schedule_fail"));
    }
  };

  const classBreakdown = report?.class_breakdown || [];
  const focusComponentLabels = apiQuarter === 2
    ? [
        { key: "focus_assessment", label: t("assessment") },
        { key: "focus_quiz_primary", label: t("quiz3") },
        { key: "focus_quiz_secondary", label: t("quiz4") },
        { key: "focus_chapter_test", label: t("chapter_test2_practical") },
        { key: "focus_final_practical", label: t("quarter2_practical") },
        { key: "focus_final_theory", label: t("quarter2_theory") },
      ]
    : [
        { key: "focus_assessment", label: t("assessment") },
        { key: "focus_quiz_primary", label: t("quiz1") },
        { key: "focus_quiz_secondary", label: t("quiz2") },
        { key: "focus_chapter_test", label: t("chapter_test1_practical") },
        { key: "focus_final_practical", label: t("quarter1_practical") },
        { key: "focus_final_theory", label: t("quarter1_theory") },
      ];
  const renderMarksBreakdown = (student) => (
    <div className="space-y-1 text-xs text-muted-foreground">
      {focusComponentLabels.map((item) => (
        <div key={item.key}>
          <span className="font-medium text-foreground">{item.label}:</span>{" "}
          {student?.[item.key] != null ? student[item.key] : "—"}
        </div>
      ))}
    </div>
  );

  const reportClassAverageBars = (report?.class_breakdown || []).map((row) => ({
    name: row.class_name,
    score: row.avg_total_score || 0,
  }));

  const reportQuarterDistribution = report?.distribution || [];

  const focusQuarterStudentTotal = (student) =>
    apiQuarter === 2 ? student.quarter2_total ?? "—" : student.quarter1_total ?? "—";

  const executiveSummaryText = [
    analysisStrengths,
    analysisPerformance,
    analysisStandoutData,
  ]
    .map((s) => (s || "").trim())
    .filter(Boolean)
    .join(" ")
    .slice(0, 320);

  return (
    <div className="dashboard-premium-shell space-y-6 sm:space-y-8" data-testid="reports-page">
      <DashboardPageHeader
        title={t("reports")}
        subtitle={t("report_type")}
        description={t("analytics_page_description")}
        metaItems={[t(`term_${termScopeId}`), `Grade ${grade || "-"}`]}
        actions={
          <>
            <Button onClick={handleGenerate} data-testid="reports-hero-generate" disabled={isTeacher && !availableGrades.length}>
              {t("generate_report")}
            </Button>
            <Button variant="secondary" onClick={() => handleDownload("pdf")} data-testid="reports-hero-download-pdf" disabled={!report}>
              {t("download_pdf")}
            </Button>
          </>
        }
        testId="reports-hero"
      />

      <AnalyticsToolbar
        testId="reports-toolbar"
        className="no-print"
        filters={
          <>
            <FilterField label={t("analytics_term_scope")}>
              <Select value={termScopeId} onValueChange={setTermScopeId}>
                <SelectTrigger className="w-full min-w-[12rem] sm:w-48" data-testid="reports-term-scope">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TERM_SCOPES.map((s) => (
                    <SelectItem key={s.id} value={s.id} data-testid={`reports-term-${s.id}`}>
                      {t(`term_${s.id}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>
            <FilterField label={t("grade")}>
              <Select value={grade} onValueChange={setGrade} disabled={!availableGrades.length}>
                <SelectTrigger className="w-full min-w-[10rem]" data-testid="reports-grade-select">
                  <SelectValue placeholder={t("grade")} />
                </SelectTrigger>
                <SelectContent>
                  {availableGrades.map((value) => (
                    <SelectItem key={value} value={String(value)} data-testid={`reports-grade-${value}`}>
                      Grade {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>
            <FilterField label={t("report_type")}>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger className="w-full min-w-[10rem]" data-testid="reports-type-select">
                  <SelectValue placeholder={t("report_type")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="summary" data-testid="reports-type-summary">
                    {t("summary_report")}
                  </SelectItem>
                  <SelectItem value="full" data-testid="reports-type-full">
                    {t("full_report")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </FilterField>
          </>
        }
        actions={
          <>
            <Button onClick={handleGenerate} data-testid="reports-generate-button" disabled={isTeacher && !availableGrades.length}>
              {t("generate_report")}
            </Button>
            <Button variant="outline" onClick={() => autoFillInsights()} data-testid="reports-autofill-insights-button" disabled={!report}>
              Auto-fill AI comments
            </Button>
            <Button variant="outline" onClick={handlePrint} className="no-print" data-testid="reports-print-button" disabled={!report}>
              {t("print")}
            </Button>
            <Button variant="secondary" onClick={() => handleDownload("pdf")} data-testid="reports-download-pdf-button" disabled={!report}>
              {t("download_pdf")}
            </Button>
            <Button variant="secondary" onClick={() => handleDownload("excel")} data-testid="reports-download-excel-button" disabled={!report}>
              {t("download_excel")}
            </Button>
            <Button onClick={handleSchedule} className="no-print" data-testid="reports-schedule-button">
              {t("schedule_weekly")}
            </Button>
          </>
        }
      />

      <p className="text-xs text-muted-foreground" data-testid="reports-term-hint">
        {t("analytics_term_scope_hint")}
      </p>
      <p className="max-w-3xl text-xs text-muted-foreground" data-testid="reports-type-hint">
        {isFullReport ? t("report_type_full_help") : t("report_type_summary_help")}
      </p>

      {report ? (
        <div className="report-document space-y-6" data-testid="reports-content">
          <ReportCoverMeta
            title={t("reports")}
            subtitle={t("report_prepared_for")}
            organization={t("app_name")}
            reportTypeLabel={isFullReport ? t("full_report") : t("summary_report")}
            gradeLabel={t("grade")}
            gradeValue={`Grade ${grade}`}
            termLabel={t("analytics_term_scope")}
            termValue={t(`term_${termScopeId}`)}
            generatedLabel={t("generated_on")}
            generatedValue={new Date().toLocaleDateString()}
            summary={executiveSummaryText || t("report_executive_intro")}
            testId="reports-cover"
          />

          <BoardShell
            sidebar={
              <>
                <BoardHighlightsCard title={t("visual_board_key_highlights")}>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">{t("analytics_term_scope")}</p>
                    <p className="font-medium text-foreground">{t(`term_${termScopeId}`)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">{t("grade")}</p>
                    <p className="text-lg font-semibold text-foreground">{grade}</p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-background/80 px-3 py-2">
                    <p className="text-xs text-muted-foreground">{t("on_level")}</p>
                    <p className="text-lg font-semibold tabular-nums text-primary">{report.exceeding_rate}%</p>
                  </div>
                  <Link
                    to="/analytics"
                    className="inline-flex text-sm font-medium text-primary hover:underline"
                  >
                    {t("view_analytics")} →
                  </Link>
                </BoardHighlightsCard>
                <Card className="card-hover border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10 dark:from-primary/10 dark:to-primary/5">
                  <CardContent className="py-4 text-sm text-muted-foreground">
                    {t("reports_synced_with_analytics")}
                  </CardContent>
                </Card>
              </>
            }
          >
          <Card className="card-hover border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10 dark:from-primary/10 dark:to-primary/5 lg:hidden">
            <CardContent className="py-4">
              <p className="text-sm text-muted-foreground">
                {t("reports_synced_with_analytics")}{" "}
                <span className="font-medium text-foreground">({t(`term_${termScopeId}`)})</span>
              </p>
              <Link
                to="/analytics"
                className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
              >
                {t("view_analytics")} →
              </Link>
            </CardContent>
          </Card>

          <ReportSection
            title={t("key_metrics")}
            description={t("report_executive_intro")}
            lead={executiveSummaryText || t("reports_synced_with_analytics")}
            testId="reports-summary"
            variant="accent"
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" data-testid="reports-summary-metrics">
              <MetricCard
                icon={TrendingUp}
                label={t("total_students")}
                value={report.total_students}
                delta={`${report.class_breakdown?.length || 0} ${t("classes").toLowerCase()}`}
                status={t("overview")}
                testId="reports-total-students"
              />
              <MetricCard
                icon={Sparkles}
                label={t("avg_total_score")}
                value={report.avg_total_score != null ? report.avg_total_score : "—"}
                delta={`${t(`term_${termScopeId}`)}`}
                status={t("analytics")}
                testId="reports-avg-total"
              />
              <MetricCard
                icon={AlertTriangle}
                label={t("on_level")}
                value={`${report.exceeding_rate}%`}
                delta={`${t("focus_quarter_total")}`}
                deltaTone={report.exceeding_rate >= 75 ? "positive" : report.exceeding_rate < 50 ? "negative" : "neutral"}
                hint={t(`term_${termScopeId}`)}
                accent="primary"
                status={t("key_insights")}
                testId="reports-exceeding-rate"
              />
              <MetricCard
                icon={Sparkles}
                label={t("students_needing_support")}
                value={(report.students_needing_support || []).length}
                delta={`${(report.top_performers || []).length} ${t("top_performers").toLowerCase()}`}
                deltaTone={(report.students_needing_support || []).length > 0 ? "negative" : "positive"}
                hint={t("reports_synced_with_analytics")}
                accent="warning"
                status={t("report_type")}
                testId="reports-support-students"
              />
            </div>
          </ReportSection>

          <ReportSection
            title={t("visual_insights")}
            description={t(`term_${termScopeId}`)}
            lead={t("report_type_full_help")}
            testId="reports-visual-board-grid"
          >
            <div className="analytics-chart-grid-premium">
            <ChartCard title={t("avg_total_score")} subtitle={t("visual_board_chart_class_curve_sub")}>
              <ClassAverageBarChart data={reportClassAverageBars} height={260} />
            </ChartCard>
            <ChartCard title={t("visual_board_chart_pass_split")} subtitle={t(`term_${termScopeId}`)} summary={`${report.exceeding_rate}%`} summaryLabel={t("on_level")}>
              <div className="mb-2 space-y-1 text-sm font-semibold">
                <div className={`flex items-center gap-2 ${performanceTextClasses.on_level}`}>
                  <span className={`inline-block h-3 w-3 rounded-sm ${performanceLegendSwatchClasses.on_level}`} />
                  {t("on_level")}
                </div>
                <div className={`flex items-center gap-2 ${performanceTextClasses.approach}`}>
                  <span className={`inline-block h-3 w-3 rounded-sm ${performanceLegendSwatchClasses.approach}`} />
                  {t("visual_board_approaching_full_score")}
                </div>
                <div className={`flex items-center gap-2 ${performanceTextClasses.below}`}>
                  <span className={`inline-block h-3 w-3 rounded-sm ${performanceLegendSwatchClasses.below}`} />
                  {t("visual_board_below_level")}
                </div>
              </div>
              <PassSplitDonut
                distribution={reportQuarterDistribution || []}
                onLevelLabel={t("on_level")}
                approachingLabel={t("visual_board_approaching_full_score")}
                belowLabel={t("visual_board_below_level")}
                noDataLabel={t("no_data")}
                centerCaption={t("on_level")}
                height={260}
                showLegend={false}
              />
            </ChartCard>
            {isFullReport ? (
              <>
              <ChartCard title={t("visual_board_chart_q_focus")} subtitle={t("visual_board_chart_q_focus_sub")}>
                <QuarterOnLevelFocus
                  rate={report.exceeding_rate}
                  termLabel={t(`term_${termScopeId}`)}
                  lineName={t("visual_board_line_cohort")}
                  height={240}
                />
              </ChartCard>
              <ChartCard title={t("visual_board_chart_class_curve")} subtitle={t("visual_board_chart_class_curve_sub")}>
                <ClassScoreArea data={reportClassAverageBars} height={240} />
              </ChartCard>
              </>
            ) : null}
            </div>
          </ReportSection>

          <section className="grid gap-4 lg:grid-cols-3" data-testid="reports-story-cards">
            <article className="story-card">
              <p className="story-card-kicker">Executive Summary</p>
              <h3 className="story-card-title">{t("executive_summary")}</h3>
              <p className="story-card-body">{executiveSummaryText || t("report_executive_intro")}</p>
            </article>
            <article className="story-card">
              <p className="story-card-kicker">Risk Indicator</p>
              <h3 className="story-card-title">{t("students_needing_support")}</h3>
              <p className="story-card-body">
                {(report.students_needing_support || []).length} {t("students")} · {t("performance_level")}
              </p>
            </article>
            <article className="story-card">
              <p className="story-card-kicker">Top Performing Area</p>
              <h3 className="story-card-title">{t("top_performers")}</h3>
              <p className="story-card-body">
                {(report.top_performers || []).length} {t("students")} · {t("on_level")}
              </p>
            </article>
          </section>

          {!isFullReport && (
            <Card
              className="card-hover border-amber-500/35 bg-amber-500/[0.06] dark:bg-amber-950/20"
              data-testid="reports-summary-mode-banner"
            >
              <CardContent className="py-3 text-sm text-muted-foreground">
                {t("reports_summary_layout_note")}
              </CardContent>
            </Card>
          )}

          {isFullReport && (
            <>
          <ExpandableSection
            title={t("executive_summary")}
            description={`${t("generated_on")}: ${new Date().toLocaleDateString()}`}
            defaultOpen
            testId="reports-executive-summary-section"
            className="section-bg-alt-3 print:break-inside-avoid"
          >
          <Card data-testid="reports-tabs-card" className="border-none bg-transparent shadow-none">
            <CardContent className="pt-2">
              <Tabs defaultValue="top" data-testid="reports-tabs">
                <TabsList className="h-auto flex-wrap">
                  <TabsTrigger value="top" data-testid="reports-tab-top">
                    {t("top_performers")}
                  </TabsTrigger>
                  <TabsTrigger value="support" data-testid="reports-tab-support">
                    {t("students_needing_support")}
                  </TabsTrigger>
                  <TabsTrigger value="classes" data-testid="reports-tab-classes">
                    {t("class_breakdown")}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="top" className="mt-4" data-testid="reports-top-content">
                  <div className="table-responsive-wrap rounded-xl border border-border/60 overflow-hidden">
                  <Table className="report-table-premium">
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("student_name")}</TableHead>
                        <TableHead>{t("class_name")}</TableHead>
                        <TableHead>{t("focus_quarter_total")}</TableHead>
                        <TableHead>{t("total_score")}</TableHead>
                        <TableHead>{t("analytics_student_marks_breakdown")}</TableHead>
                        <TableHead>{t("strengths")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(report.top_performers || []).map((student) => (
                        <TableRow key={student.id} data-testid={`reports-top-${student.id}`}>
                          <TableCell>{student.full_name}</TableCell>
                          <TableCell>{student.class_name}</TableCell>
                          <TableCell>{focusQuarterStudentTotal(student)}</TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={getScoreBandBadgeClass(student.total_score_normalized, 50)}
                            >
                              {student.total_score_normalized != null ? student.total_score_normalized : "-"}
                            </Badge>
                          </TableCell>
                          <TableCell>{renderMarksBreakdown(student)}</TableCell>
                          <TableCell>
                            {(student.strengths || []).length > 0 ? (
                              <span className="flex flex-wrap gap-1">
                                {(student.strengths || []).map((str) => (
                                  <span
                                    key={str}
                                    className={performanceChipClasses.on_level}
                                  >
                                    {str}
                                  </span>
                                ))}
                              </span>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  </div>
                </TabsContent>

                <TabsContent value="support" className="mt-4" data-testid="reports-support-content">
                  <div className="table-responsive-wrap rounded-xl border border-border/60 overflow-hidden">
                  <Table className="report-table-premium">
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("student_name")}</TableHead>
                        <TableHead>{t("class_name")}</TableHead>
                        <TableHead>{t("focus_quarter_total")}</TableHead>
                        <TableHead>{t("performance_level")}</TableHead>
                        <TableHead>{t("analytics_student_marks_breakdown")}</TableHead>
                        <TableHead>{t("weaknesses")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(report.students_needing_support || []).map((student) => (
                        <TableRow key={student.id} data-testid={`reports-support-${student.id}`}>
                          <TableCell>{student.full_name}</TableCell>
                          <TableCell>{student.class_name}</TableCell>
                          <TableCell>{focusQuarterStudentTotal(student)}</TableCell>
                          <TableCell>
                            <PerformanceLevelBadge
                              level={student.performance_level}
                              label={t(student.performance_level)}
                            />
                          </TableCell>
                          <TableCell>{renderMarksBreakdown(student)}</TableCell>
                          <TableCell>
                            {(student.weak_areas || []).length > 0 ? (
                              <span className="flex flex-wrap gap-1">
                                {(student.weak_areas || []).map((area) => (
                                  <span
                                    key={area}
                                    className={performanceChipClasses.approach}
                                  >
                                    {area}
                                  </span>
                                ))}
                              </span>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  </div>
                </TabsContent>

                <TabsContent value="classes" className="mt-4" data-testid="reports-classes-content">
                  <div className="table-responsive-wrap rounded-xl border border-border/60 overflow-hidden">
                  <Table className="report-table-premium">
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("class_name")}</TableHead>
                        <TableHead>{t("total_students")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {classBreakdown.map((item) => (
                        <TableRow key={item.class_name} data-testid={`reports-class-${item.class_name}`}>
                          <TableCell>{item.class_name}</TableCell>
                          <TableCell>{item.student_count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
          </ExpandableSection>

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
            testId="reports-insights"
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
                  data-testid="reports-insights-strengths"
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
                  data-testid="reports-insights-weaknesses"
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
                  data-testid="reports-insights-performance"
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
                  data-testid="reports-insights-standout"
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
                  data-testid="reports-insights-actions"
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
                  data-testid="reports-insights-recommendations"
                />
              </CardContent>
            </Card>
          </section>
          </ExpandableSection>
            </>
          )}
          </BoardShell>
        </div>
      ) : (
        <Card data-testid="reports-empty">
          <CardContent className="pt-6 text-sm text-muted-foreground">
            {t("generate_report")}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
