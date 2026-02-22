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
import { sortByClassOrder } from "@/lib/utils";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import TimetableEditor from "@/components/TimetableEditor";

const PERFORMANCE_COLORS = {
  on_level: "#10b981",
  approach: "#f59e0b",
  below: "#ef4444",
  no_data: "#94a3b8",
};

const formatScore = (value, suffix = "") => {
  if (value === null || value === undefined) {
    return "—";
  }
  return `${value}${suffix}`;
};

export default function Dashboard() {
  const { language, semester, setSemester, quarter, academicYear, profile } = useOutletContext();
  const t = useTranslations(language);
  const semesterNumber = semester === "semester2" ? 2 : 1;
  const isTeacher = profile?.role_name === "Teacher";
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);
  const [schedule, setSchedule] = useState({});
  const [savingSchedule, setSavingSchedule] = useState(false);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const response = await api.get("/analytics/summary", {
        params: { semester: semesterNumber, quarter },
      });
      setSummary(response.data);
    } catch (error) {
      toast.error(getApiErrorMessage(error) || "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
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
      fetchSummary();
    } catch (error) {
      toast.error(getApiErrorMessage(error) || "Import failed. Please check the file format.");
    }
  };

  const distributionData = (summary?.distribution || []).map((item) => ({
    name: t(item.level),
    value: item.count,
    level: item.level,
  }));

  const classData = sortByClassOrder(summary?.students_per_class || []);
  const supportCount = summary
    ? (summary.counts?.approach || 0) + (summary.counts?.below || 0)
    : 0;

  return (
    <div className="space-y-8" data-testid="dashboard-page">
      <PageHeader
        title={t("dashboard")}
        subtitle={t("overview")}
        testIdPrefix="dashboard"
        action={
          <div className="flex flex-wrap items-center gap-4">
            <Badge variant="outline" data-testid="academic-year-badge">
              {t("academic_year")}: {academicYear}
            </Badge>
            <Select value={semester} onValueChange={setSemester}>
              <SelectTrigger className="w-[180px]" data-testid="semester-list">
                <SelectValue placeholder={t("semesters")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="semester1" data-testid="semester-one-button">
                  {t("semester_one")}
                </SelectItem>
                <SelectItem value="semester2" data-testid="semester-two-button">
                  {t("semester_two")}
                </SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
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
        className="section-bg-alt-1 grid gap-4 rounded-xl border border-border/50 p-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7"
        data-testid="dashboard-metrics"
      >
        <Card data-testid="metric-total-students">
          <CardHeader className="pb-2">
            <CardTitle
              className="text-sm text-muted-foreground"
              data-testid="metric-total-students-label"
            >
              {t("total_enrolled_students")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="text-3xl font-bold"
              data-testid="metric-total-students-value"
            >
              {summary?.total_students ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card data-testid="metric-assessed-students">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              {t("assessed_students")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-sky-600" data-testid="metric-assessed-students-value">
              {summary?.students_with_data ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card data-testid="metric-no-data-students">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              {t("no_data_students")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-600" data-testid="metric-no-data-students-value">
              {summary?.students_no_data ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card data-testid="metric-exceeding">
          <CardHeader className="pb-2">
            <CardTitle
              className="text-sm text-muted-foreground"
              data-testid="metric-exceeding-label"
            >
              {t("on_level")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="text-3xl font-bold text-emerald-600"
              data-testid="metric-exceeding-value"
            >
              {summary?.counts?.on_level ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card data-testid="metric-support">
          <CardHeader className="pb-2">
            <CardTitle
              className="text-sm text-muted-foreground"
              data-testid="metric-support-label"
            >
              {t("need_support")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="text-3xl font-bold text-amber-600"
              data-testid="metric-support-value"
            >
              {supportCount}
            </div>
          </CardContent>
        </Card>
        <Card data-testid="metric-avg-quiz">
          <CardHeader className="pb-2">
            <CardTitle
              className="text-sm text-muted-foreground"
              data-testid="metric-avg-quiz-label"
            >
              {t("avg_quiz_score")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="text-3xl font-bold text-primary"
              data-testid="metric-avg-quiz-value"
            >
              {formatScore(summary?.avg_quiz_score, "/5")}
            </div>
          </CardContent>
        </Card>
        <Card data-testid="metric-avg-chapter">
          <CardHeader className="pb-2">
            <CardTitle
              className="text-sm text-muted-foreground"
              data-testid="metric-avg-chapter-label"
            >
              {t("avg_chapter_score")}
            </CardTitle>
          </CardHeader>
          <CardContent>
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
                        fill={PERFORMANCE_COLORS[entry.level]}
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
                  className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2"
                  data-testid={`dashboard-distribution-${item.level}`}
                >
                  <span className="text-sm font-medium">{item.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {!isTeacher && (
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
        )}
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
          </CardContent>
        </Card>
        <Card className="card-hover" data-testid="dashboard-support-list">
          <CardHeader>
            <CardTitle data-testid="dashboard-support-title">
              {t("students_needing_support")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {summary?.students_needing_support?.length ? (
              summary.students_needing_support.slice(0, 5).map((student) => (
                <div
                  key={student.id}
                  className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2"
                  data-testid={`support-student-${student.id}`}
                >
                  <div>
                    <p className="text-sm font-semibold" data-testid={`support-student-name-${student.id}`}>
                      {student.full_name}
                    </p>
                    <p className="text-xs text-muted-foreground" data-testid={`support-student-class-${student.id}`}>
                      {student.class_name}
                    </p>
                  </div>
                  <Badge
                    className="bg-amber-100 text-amber-700"
                    data-testid={`support-student-level-${student.id}`}
                  >
                    {t(student.performance_level)}
                  </Badge>
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
          <CardContent className="space-y-3">
            {summary?.top_performers?.length ? (
              summary.top_performers.map((student) => (
                <div
                  key={student.id}
                  className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2"
                  data-testid={`top-performer-${student.id}`}
                >
                  <div>
                    <p className="text-sm font-semibold" data-testid={`top-performer-name-${student.id}`}>
                      {student.full_name}
                    </p>
                    <p className="text-xs text-muted-foreground" data-testid={`top-performer-class-${student.id}`}>
                      {student.class_name}
                    </p>
                  </div>
                  <Badge
                    className="bg-emerald-100 text-emerald-700"
                    data-testid={`top-performer-score-${student.id}`}
                  >
                    {formatScore(student.total_score_normalized, "/50")}
                  </Badge>
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

      <section className="grid gap-6" data-testid="dashboard-timetable">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle data-testid="dashboard-timetable-title">{t("timetable")}</CardTitle>
            <Button
              variant="success"
              onClick={handleScheduleSave}
              disabled={savingSchedule}
              data-testid="dashboard-timetable-save"
            >
              {t("save_changes")}
            </Button>
          </CardHeader>
          <CardContent>
            <TimetableEditor
              schedule={schedule}
              onChange={setSchedule}
              orientation="days-rows"
              dayLabels={[t("sunday"), t("monday"), t("tuesday"), t("wednesday"), t("thursday")]}
              dayHeaderLabel={t("day")}
            />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
