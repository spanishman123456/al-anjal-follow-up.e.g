import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, getApiErrorMessage, getLocalizedApiErrorMessage } from "@/lib/api";
import { ExpandableSection } from "@/components/ExpandableSection";
import TimetableEditor from "@/components/TimetableEditor";
import { Button } from "@/components/ui/button";

export function DashboardTimetable({
  academicYear,
  defaultOpen = false,
  language,
  schoolSection,
  t,
  testIdPrefix,
}) {
  const [schedule, setSchedule] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setSchedule({});
    api
      .get("/timetables/profile", {
        params: { school_section: schoolSection, academic_year: academicYear },
      })
      .then((response) => {
        if (active) setSchedule(response.data?.schedule || {});
      })
      .catch((error) => {
        if (active) toast.error(getLocalizedApiErrorMessage(error, t));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [academicYear, schoolSection, t]);

  const save = async () => {
    try {
      setSaving(true);
      const response = await api.put(
        "/timetables/profile",
        { schedule },
        { params: { school_section: schoolSection, academic_year: academicYear } },
      );
      setSchedule(response.data?.schedule || schedule);
      toast.success(t("profile_updated"));
    } catch (error) {
      toast.error(getApiErrorMessage(error) || t("profile_failed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ExpandableSection
      title={t("timetable")}
      description={`${t("academic_year")}: ${academicYear}`}
      defaultOpen={defaultOpen}
      testId={`${testIdPrefix}-section`}
      className="section-hover premium-active-card overflow-hidden"
      headerExtra={
        <Button
          variant="success"
          size="sm"
          className="shadow-[0_0_18px_rgba(34,211,238,0.24)] transition-all hover:-translate-y-0.5 hover:shadow-[0_0_24px_rgba(124,58,237,0.3)]"
          onClick={(event) => {
            event.stopPropagation();
            save();
          }}
          disabled={loading || saving}
          data-testid={`${testIdPrefix}-save`}
        >
          {t("save_changes")}
        </Button>
      }
    >
      <div dir={language === "ar" ? "rtl" : "ltr"} data-testid={testIdPrefix}>
        <TimetableEditor
          schedule={schedule}
          onChange={setSchedule}
          orientation="days-rows"
          dayLabels={[t("sunday"), t("monday"), t("tuesday"), t("wednesday"), t("thursday")]}
          dayHeaderLabel={t("day")}
          disabled={loading}
          testIdPrefix={schoolSection === "international" ? "timetable" : testIdPrefix}
        />
      </div>
    </ExpandableSection>
  );
}
