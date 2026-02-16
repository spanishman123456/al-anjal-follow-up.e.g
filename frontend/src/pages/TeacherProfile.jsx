import { useEffect, useState } from "react";
import { useOutletContext, useParams, useNavigate, Navigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useTranslations } from "@/lib/i18n";
import { sortByClassOrder } from "@/lib/utils";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import TimetableEditor from "@/components/TimetableEditor";

export default function TeacherProfile() {
  const { language } = useOutletContext();
  const t = useTranslations(language);
  const { teacherId } = useParams();
  const navigate = useNavigate();
  const [teacherData, setTeacherData] = useState(null);
  const [classes, setClasses] = useState([]);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    phone: "",
    subjects: "",
    assigned_class_ids: [],
    schedule: {},
    avatar_base64: "",
  });

  if (!teacherId) {
    return <Navigate to="/teachers" replace />;
  }

  const loadData = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [teacherRes, classesRes] = await Promise.all([
        api.get(`/teachers/${teacherId}`),
        api.get("/classes"),
      ]);
      setTeacherData(teacherRes.data);
      setClasses(classesRes.data);
      const teacher = teacherRes.data.teacher;
      setForm({
        phone: teacher.phone || "",
        subjects: (teacher.subjects || []).join(", "),
        assigned_class_ids: teacher.assigned_class_ids || [],
        schedule: teacher.schedule || {},
        avatar_base64: teacher.avatar_base64 || "",
      });
    } catch (error) {
      toast.error(t("teacher_profile_failed"));
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [teacherId]);

  const handleAvatarChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setForm((prev) => ({ ...prev, avatar_base64: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const toggleClass = (classId) => {
    setForm((prev) => ({
      ...prev,
      assigned_class_ids: prev.assigned_class_ids.includes(classId)
        ? prev.assigned_class_ids.filter((id) => id !== classId)
        : [...prev.assigned_class_ids, classId],
    }));
  };

  const handleSave = async () => {
    try {
      await api.put(`/teachers/${teacherId}`, {
        phone: form.phone,
        subjects: form.subjects
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        assigned_class_ids: form.assigned_class_ids,
        schedule: form.schedule,
        avatar_base64: form.avatar_base64,
      });
      toast.success(t("teacher_update_success"));
      loadData();
    } catch (error) {
      toast.error(t("teacher_update_fail"));
    }
  };

  if (loading && !teacherData) {
    return (
      <div className="space-y-6" data-testid="teacher-profile-page">
        <PageHeader title={t("teacher_profile")} subtitle="" testIdPrefix="teacher-profile" />
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">{t("loading") || "Loading…"}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loadError && !teacherData) {
    return (
      <div className="space-y-6" data-testid="teacher-profile-page">
        <PageHeader title={t("teacher_profile")} subtitle="" testIdPrefix="teacher-profile" />
        <Card>
          <CardContent className="pt-6 space-y-4">
            <p className="text-muted-foreground">{t("teacher_profile_failed")}</p>
            <Button variant="outline" onClick={() => navigate("/teachers")} data-testid="teacher-profile-back">
              {t("back_to_list") || "Back to teachers"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!teacherData) return null;

  const { teacher, class_performance, audit_logs } = teacherData;

  return (
    <div className="space-y-6" data-testid="teacher-profile-page">
      <PageHeader
        title={t("teacher_profile")}
        subtitle={teacher.name}
        testIdPrefix="teacher-profile"
        action={
          <Button variant="success" onClick={handleSave} data-testid="teacher-save-button">
            {t("save_profile")}
          </Button>
        }
      />

      <Card data-testid="teacher-info-card">
        <CardHeader>
          <CardTitle>{t("my_profile")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-[140px_1fr]">
          <div className="space-y-3">
            <div className="h-28 w-28 overflow-hidden rounded-full border border-border bg-muted flex items-center justify-center">
              {form.avatar_base64 ? (
                <img
                  src={form.avatar_base64}
                  alt="Avatar"
                  className="h-full w-full object-cover"
                  data-testid="teacher-avatar"
                />
              ) : (
                <span className="text-2xl font-semibold">
                  {(teacher.name || "T").charAt(0)}
                </span>
              )}
            </div>
            <label className="cursor-pointer text-sm font-medium text-primary" data-testid="teacher-avatar-label">
              {t("change_photo")}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
                data-testid="teacher-avatar-input"
              />
            </label>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Input value={teacher.name} readOnly data-testid="teacher-name" />
            <Input value={teacher.email} readOnly data-testid="teacher-email" />
            <Input
              placeholder={t("phone")}
              value={form.phone}
              onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
              data-testid="teacher-phone"
            />
            <Input
              placeholder={t("subjects")}
              value={form.subjects}
              onChange={(event) => setForm((prev) => ({ ...prev, subjects: event.target.value }))}
              data-testid="teacher-subjects"
            />
          </div>
        </CardContent>
      </Card>

      <Card data-testid="teacher-classes-card">
        <CardHeader>
          <CardTitle>{t("assigned_classes")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {sortByClassOrder(classes).map((cls) => (
            <label key={cls.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.assigned_class_ids.includes(cls.id)}
                onChange={() => toggleClass(cls.id)}
                data-testid={`teacher-class-${cls.id}`}
              />
              {cls.name}
            </label>
          ))}
        </CardContent>
      </Card>

      <Card data-testid="teacher-permissions-card">
        <CardHeader>
          <CardTitle>{t("permissions_list")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {(teacher.permissions || []).map((permission) => (
            <Badge key={permission} variant="secondary">
              {permission}
            </Badge>
          ))}
        </CardContent>
      </Card>

      <Card data-testid="teacher-schedule-card">
        <CardHeader>
          <CardTitle>{t("timetable")}</CardTitle>
        </CardHeader>
        <CardContent>
          <TimetableEditor
            schedule={form.schedule}
            onChange={(next) => setForm((prev) => ({ ...prev, schedule: next }))}
            dayLabels={[t("sunday"), t("monday"), t("tuesday"), t("wednesday"), t("thursday")]}
            periodLabel={t("period")}
          />
        </CardContent>
      </Card>

      <Card data-testid="teacher-performance-card">
        <CardHeader>
          <CardTitle>{t("class_performance")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {class_performance?.length ? (
            class_performance.map((item) => (
              <div
                key={item.class_id}
                className="flex items-center justify-between rounded-lg border border-border px-4 py-2"
                data-testid={`teacher-performance-${item.class_id}`}
              >
                <span>{item.class_name}</span>
                <span className="text-sm text-muted-foreground">
                  {item.avg_total_score ? `${item.avg_total_score}/50` : "—"}
                </span>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground" data-testid="teacher-performance-empty">
              {t("no_data")}
            </p>
          )}
        </CardContent>
      </Card>

      <Card data-testid="teacher-audit-card">
        <CardHeader>
          <CardTitle>{t("audit_log")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {audit_logs?.length ? (
            audit_logs.map((log) => (
              <div
                key={log.id}
                className="flex flex-wrap items-center justify-between gap-2 text-sm"
                data-testid={`audit-log-${log.id}`}
              >
                <span>{log.action}</span>
                <span className="text-muted-foreground">
                  {t("edited_by")}: {log.editor_name}
                </span>
                <span className="text-muted-foreground">{log.timestamp}</span>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground" data-testid="audit-empty">
              {t("no_data")}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
