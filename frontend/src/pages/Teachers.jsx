import { useEffect, useState } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useTranslations } from "@/lib/i18n";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function Teachers() {
  const { language } = useOutletContext();
  const t = useTranslations(language);
  const navigate = useNavigate();
  const [teachers, setTeachers] = useState([]);

  const loadTeachers = async () => {
    try {
      const response = await api.get("/teachers");
      setTeachers(response.data);
    } catch (error) {
      toast.error(t("teachers_failed"));
    }
  };

  useEffect(() => {
    loadTeachers();
  }, []);

  return (
    <div className="space-y-6" data-testid="teachers-page">
      <PageHeader title={t("teachers")} subtitle={t("overview")} testIdPrefix="teachers" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-testid="teachers-grid">
        {teachers.length ? (
          teachers.map((teacher) => (
            <Card key={teacher.id} data-testid={`teacher-card-${teacher.id}`}>
              <CardContent className="space-y-3 pt-6">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                    {teacher.avatar_base64 ? (
                      <img
                        src={teacher.avatar_base64}
                        alt="Avatar"
                        className="h-full w-full object-cover"
                        data-testid={`teacher-avatar-${teacher.id}`}
                      />
                    ) : (
                      <span className="text-lg font-semibold">
                        {(teacher.name || "T").charAt(0)}
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold" data-testid={`teacher-name-${teacher.id}`}>
                      {teacher.name}
                    </p>
                    <p className="text-xs text-muted-foreground" data-testid={`teacher-email-${teacher.id}`}>
                      {teacher.email}
                    </p>
                  </div>
                </div>
                <p className="text-sm" data-testid={`teacher-classes-${teacher.id}`}>
                  {t("assigned_classes")}: {teacher.assigned_class_ids?.length || 0}
                </p>
                <Button
                  variant="outline"
                  onClick={() => navigate(`/teachers/${teacher.id}`)}
                  data-testid={`teacher-view-${teacher.id}`}
                >
                  {t("teacher_profile")}
                </Button>
              </CardContent>
            </Card>
          ))
        ) : (
          <p className="text-sm text-muted-foreground" data-testid="teachers-empty">
            {t("no_data")}
          </p>
        )}
      </div>
    </div>
  );
}
