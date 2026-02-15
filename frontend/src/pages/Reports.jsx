import { useState } from "react";
import { useOutletContext, Link } from "react-router-dom";
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
import { api } from "@/lib/api";
import { useTranslations } from "@/lib/i18n";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
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

const PERFORMANCE_COLORS = {
  on_level: "#10b981",
  approach: "#f59e0b",
  below: "#ef4444",
  no_data: "#94a3b8",
};

export default function Reports() {
  const { language, semester } = useOutletContext();
  const t = useTranslations(language);
  const [grade, setGrade] = useState("4");
  const [reportType, setReportType] = useState("summary");
  const [report, setReport] = useState(null);
  const [analysisStrengths, setAnalysisStrengths] = useState("");
  const [analysisWeaknesses, setAnalysisWeaknesses] = useState("");
  const [analysisPerformance, setAnalysisPerformance] = useState("");
  const [analysisStandoutData, setAnalysisStandoutData] = useState("");
  const [analysisActions, setAnalysisActions] = useState("");
  const [analysisRecommendations, setAnalysisRecommendations] = useState("");

  const handleGenerate = async () => {
    const response = await api.get("/reports/grade", {
      params: { grade, semester: semester === "semester2" ? 2 : 1 },
    });
    setReport(response.data);
  };

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
          semester: semester === "semester2" ? 2 : 1,
        },
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `grade_${grade}_report.${format === "excel" ? "xlsx" : "pdf"}`,
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

  const distributionData = (report?.distribution || []).map((item) => ({
    name: t(item.level),
    value: item.count,
    level: item.level,
  }));

  const classBreakdown = report?.class_breakdown || [];

  return (
    <div className="space-y-8" data-testid="reports-page">
      <PageHeader
        title={t("reports")}
        subtitle={t("overview")}
        testIdPrefix="reports"
        action={
          <div className="flex flex-wrap items-center gap-3">
            <Select value={grade} onValueChange={setGrade}>
              <SelectTrigger data-testid="reports-grade-select">
                <SelectValue placeholder={t("grade")} />
              </SelectTrigger>
              <SelectContent>
                {[4, 5, 6, 7, 8].map((value) => (
                  <SelectItem key={value} value={String(value)} data-testid={`reports-grade-${value}`}>
                    Grade {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={reportType} onValueChange={setReportType}>
              <SelectTrigger data-testid="reports-type-select">
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
            <Button onClick={handleGenerate} data-testid="reports-generate-button">
              {t("generate_report")}
            </Button>
            <Button variant="outline" onClick={handlePrint} data-testid="reports-print-button">
              {t("print")}
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleDownload("pdf")}
              data-testid="reports-download-pdf-button"
            >
              {t("download_pdf")}
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleDownload("excel")}
              data-testid="reports-download-excel-button"
            >
              {t("download_excel")}
            </Button>
            <Button
              onClick={handleSchedule}
              data-testid="reports-schedule-button"
            >
              {t("schedule_weekly")}
            </Button>
          </div>
        }
      />

      {report ? (
        <div className="space-y-6" data-testid="reports-content">
          <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10 dark:from-primary/10 dark:to-primary/5">
            <CardContent className="py-4">
              <p className="text-sm text-muted-foreground">
                {t("reports_synced_with_analytics")}
              </p>
              <Link
                to="/analytics"
                className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
              >
                {t("view_analytics")} →
              </Link>
            </CardContent>
          </Card>

          <section className="section-bg-alt-1 grid gap-4 rounded-xl border border-border/50 p-4 md:grid-cols-2 lg:grid-cols-5" data-testid="reports-summary">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">{t("total_students")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold" data-testid="reports-total-students">
                  {report.total_students}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">{t("avg_total_score")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold" data-testid="reports-avg-total">
                  {report.avg_total_score != null ? report.avg_total_score : "—"}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">{t("on_level")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold" data-testid="reports-exceeding-rate">
                  {report.exceeding_rate}%
                </div>
                <p className="text-xs text-muted-foreground">both quarters</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">{t("quarter_1")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold text-emerald-600 dark:text-emerald-400">
                  {report.quarter1?.on_level_rate ?? 0}%
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("avg_quarter_total")}: {report.quarter1?.avg_total ?? "—"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">{t("quarter_2")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold text-emerald-600 dark:text-emerald-400">
                  {report.quarter2?.on_level_rate ?? 0}%
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("avg_quarter_total")}: {report.quarter2?.avg_total ?? "—"}
                </p>
              </CardContent>
            </Card>
          </section>

          <section className="section-bg-alt-2 grid gap-6 rounded-xl border border-border/50 p-4 lg:grid-cols-2" data-testid="reports-charts">
            <Card>
              <CardHeader>
                <CardTitle>{t("performance_distribution")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64" data-testid="reports-distribution-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={distributionData} dataKey="value" innerRadius={60} outerRadius={90}>
                        {distributionData.map((entry) => (
                          <Cell key={entry.level} fill={PERFORMANCE_COLORS[entry.level]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>{t("classes")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64" data-testid="reports-classes-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={classBreakdown} barSize={28}>
                      <XAxis dataKey="class_name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="student_count" fill="#1e3a8a" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </section>

          <div className="section-bg-alt-3 rounded-xl border border-border/50 p-4">
          <Card data-testid="reports-tabs-card">
            <CardHeader>
              <CardTitle>{t("executive_summary")}</CardTitle>
              <p className="text-xs text-muted-foreground" data-testid="reports-generated-on">
                {t("generated_on")}: {new Date().toLocaleDateString()}
              </p>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="top" data-testid="reports-tabs">
                <TabsList>
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
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("student_name")}</TableHead>
                        <TableHead>{t("class_name")}</TableHead>
                        <TableHead>{t("quarter1_total")}</TableHead>
                        <TableHead>{t("quarter2_total")}</TableHead>
                        <TableHead>{t("total_score")}</TableHead>
                        <TableHead>{t("strengths")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(report.top_performers || []).map((student) => (
                        <TableRow key={student.id} data-testid={`reports-top-${student.id}`}>
                          <TableCell>{student.full_name}</TableCell>
                          <TableCell>{student.class_name}</TableCell>
                          <TableCell>{student.quarter1_total ?? "-"}</TableCell>
                          <TableCell>{student.quarter2_total ?? "-"}</TableCell>
                          <TableCell>{student.total_score_normalized != null ? student.total_score_normalized : "-"}</TableCell>
                          <TableCell>
                            {(student.strengths || []).length > 0 ? (
                              <span className="flex flex-wrap gap-1">
                                {(student.strengths || []).map((str) => (
                                  <span
                                    key={str}
                                    className="rounded bg-emerald-100 px-2 py-0.5 text-xs dark:bg-emerald-900/40"
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
                </TabsContent>

                <TabsContent value="support" className="mt-4" data-testid="reports-support-content">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("student_name")}</TableHead>
                        <TableHead>{t("class_name")}</TableHead>
                        <TableHead>{t("quarter1_total")}</TableHead>
                        <TableHead>{t("quarter2_total")}</TableHead>
                        <TableHead>{t("performance_level")}</TableHead>
                        <TableHead>{t("weaknesses")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(report.students_needing_support || []).map((student) => (
                        <TableRow key={student.id} data-testid={`reports-support-${student.id}`}>
                          <TableCell>{student.full_name}</TableCell>
                          <TableCell>{student.class_name}</TableCell>
                          <TableCell>{student.quarter1_total ?? "-"}</TableCell>
                          <TableCell>{student.quarter2_total ?? "-"}</TableCell>
                          <TableCell>{t(student.performance_level)}</TableCell>
                          <TableCell>
                            {(student.weak_areas || []).length > 0 ? (
                              <span className="flex flex-wrap gap-1">
                                {(student.weak_areas || []).map((area) => (
                                  <span
                                    key={area}
                                    className="rounded bg-amber-100 px-2 py-0.5 text-xs dark:bg-amber-900/40"
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
                </TabsContent>

                <TabsContent value="classes" className="mt-4" data-testid="reports-classes-content">
                  <Table>
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
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
          </div>

          {/* Analysis insights: strengths, weaknesses, performance, standout data, actions, recommendations */}
          <section className="grid gap-4 rounded-xl border border-border/50 p-4 md:grid-cols-2" data-testid="reports-insights">
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
