import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { AlertTriangle, CalendarDays, CheckCircle2, FileUp, GraduationCap } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useTranslations } from "@/lib/i18n";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const WEEK_TYPES = new Set(["preparation_week", "teaching_week"]);

const dateRange = (start, end) => {
  if (!start && !end) return "—";
  if (!end || start === end) return start || end;
  return `${start || "—"} — ${end}`;
};

function CalendarEventCard({ event, language, t }) {
  const title = language === "ar" ? event.title_ar : event.title_en;
  const accent = event.is_exam_period
    ? "border-violet-300/80 bg-violet-50/60 dark:bg-violet-950/20"
    : event.is_holiday
      ? "border-cyan-300/80 bg-cyan-50/60 dark:bg-cyan-950/20"
      : "border-border/70 bg-background";

  return (
    <div className={`rounded-xl border p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${accent}`} data-testid={`calendar-event-${event.id}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-foreground">{title}</p>
          <p className="mt-2 text-xs text-muted-foreground">{t("gregorian_dates")}: <span className="font-medium text-foreground">{dateRange(event.gregorian_start, event.gregorian_end)}</span></p>
          <p className="mt-1 text-xs text-muted-foreground">{t("hijri_dates")}: <span className="font-medium text-foreground">{dateRange(event.hijri_start, event.hijri_end)}</span></p>
        </div>
        {!event.verified && <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" aria-label={t("manual_review_required")} />}
      </div>
      {!event.verified && event.manual_review_note && (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          {t("manual_review_required")}: {event.manual_review_note}
        </p>
      )}
    </div>
  );
}

function SemesterCalendar({ semester, events, language, t }) {
  const weeks = events
    .filter((event) => WEEK_TYPES.has(event.event_type))
    .sort((left, right) => (left.week_number ?? 0) - (right.week_number ?? 0));
  const highlights = events
    .filter((event) => !WEEK_TYPES.has(event.event_type))
    .sort((left, right) => String(left.gregorian_start || "").localeCompare(String(right.gregorian_start || "")));

  return (
    <Card className="overflow-hidden" data-testid={`calendar-semester-${semester}`}>
      <CardHeader className="bg-gradient-to-r from-[#10162A] via-[#172554] to-[#312e81] text-white">
        <CardTitle className="flex items-center gap-2"><GraduationCap className="h-5 w-5 text-cyan-300" />{t(semester === 1 ? "semester_one" : "semester_two")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-7 pt-6">
        <section>
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-[#172554] dark:text-cyan-200">{t("preparation_and_teaching_weeks")}</h3>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-[#10162A] text-white">
                <tr><th className="p-3 text-start">{t("week_number")}</th><th className="p-3 text-start">{t("gregorian_dates")}</th><th className="p-3 text-start">{t("hijri_dates")}</th><th className="p-3 text-center">{t("calendar_verified")}</th></tr>
              </thead>
              <tbody>
                {weeks.map((event) => (
                  <tr key={event.id} className="border-b transition-colors hover:bg-cyan-50/60 dark:hover:bg-cyan-950/20">
                    <td className="p-3 font-semibold">{language === "ar" ? event.title_ar : event.title_en}</td>
                    <td className="p-3 tabular-nums">{dateRange(event.gregorian_start, event.gregorian_end)}</td>
                    <td className="p-3 tabular-nums">{dateRange(event.hijri_start, event.hijri_end)}</td>
                    <td className="p-3 text-center">{event.verified ? <CheckCircle2 className="mx-auto h-4 w-4 text-emerald-600" /> : <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700"><AlertTriangle className="h-4 w-4" />{t("manual_review_required")}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {weeks.filter((event) => !event.verified).map((event) => (
            <p key={`${event.id}-review`} className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              {(language === "ar" ? event.title_ar : event.title_en)} — {event.manual_review_note}
            </p>
          ))}
        </section>

        <section>
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-[#172554] dark:text-cyan-200">{t("holidays_and_important_events")}</h3>
          <div className="grid gap-3 md:grid-cols-2">{highlights.map((event) => <CalendarEventCard key={event.id} event={event} language={language} t={t} />)}</div>
        </section>
      </CardContent>
    </Card>
  );
}

export default function Calendar() {
  const { language } = useOutletContext();
  const t = useTranslations(language);
  const inputRef = useRef(null);
  const [years, setYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState("");
  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState(null);
  const [importing, setImporting] = useState(false);

  const loadYears = useCallback(async (preferredYear) => {
    const response = await api.get("/calendar/years");
    const calendars = response.data?.calendars || [];
    const nextYear = preferredYear || selectedYear || response.data?.active_academic_year || calendars[0]?.academic_year || "";
    setYears(calendars);
    setSelectedYear(nextYear);
    return nextYear;
  }, [selectedYear]);

  const loadCalendar = useCallback(async (year) => {
    if (!year) { setEvents([]); setStatus(null); return; }
    try {
      const params = { academic_year: year };
      const [eventsResponse, statusResponse] = await Promise.all([
        api.get("/calendar/events", { params }),
        api.get("/calendar/status", { params }),
      ]);
      setEvents(eventsResponse.data || []);
      setStatus(statusResponse.data || null);
    } catch {
      toast.error(t("calendar_failed"));
    }
  }, [t]);

  useEffect(() => {
    loadYears().catch(() => toast.error(t("calendar_failed")));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadCalendar(selectedYear); }, [loadCalendar, selectedYear]);

  const handleImport = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setImporting(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await api.post("/calendar/import", form);
      const importedYear = response.data?.academic_year;
      toast.success(`${t("calendar_imported")} · ${response.data?.count || 0}`);
      await loadYears(importedYear);
      await loadCalendar(importedYear);
    } catch (error) {
      toast.error(error?.response?.data?.detail || t("calendar_import_failed"));
    } finally {
      setImporting(false);
    }
  };

  const semesterOne = useMemo(() => events.filter((event) => event.semester === 1), [events]);
  const semesterTwo = useMemo(() => events.filter((event) => event.semester === 2), [events]);

  const formatTimestamp = (value) => {
    if (!value) return "—";
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString(language === "ar" ? "ar-SA" : "en-GB");
  };

  return (
    <div className="space-y-6" data-testid="calendar-page">
      <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={handleImport} data-testid="calendar-pdf-input" />
      <PageHeader
        pageKey="calendar"
        testIdPrefix="calendar"
        description={t("calendar_shared_sections")}
        action={<div className="flex flex-wrap items-center gap-3"><Select value={selectedYear} onValueChange={setSelectedYear}><SelectTrigger className="w-44 border-white/30 bg-white/10 text-white"><SelectValue placeholder={t("calendar_academic_year")} /></SelectTrigger><SelectContent>{years.map((year) => <SelectItem key={year.academic_year} value={year.academic_year}>{year.hijri_year} / {year.academic_year}</SelectItem>)}</SelectContent></Select><Button onClick={() => inputRef.current?.click()} disabled={importing} data-testid="calendar-import" className="active-glow"><FileUp className="me-2 h-4 w-4" />{importing ? `${t("loading")}…` : t("import_calendar_pdf")}</Button></div>}
      />

      <Card className="premium-active-card overflow-hidden" data-testid="calendar-status">
        <CardContent className="grid gap-4 pt-6 text-sm sm:grid-cols-2 xl:grid-cols-5">
          <div><span className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("calendar_academic_year")}</span><span className="mt-1 block font-bold">{status?.hijri_year || "—"} / {status?.academic_year || "—"}</span></div>
          <div><span className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("source")}</span><span className="mt-1 block font-bold">{language === "ar" ? status?.source_name_ar : status?.source_name}</span></div>
          <div><span className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("approved_school_pdf")}</span><span className="mt-1 block break-words font-medium">{status?.source_document || "—"}</span></div>
          <div><span className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("last_imported")}</span><span className="mt-1 block font-medium">{formatTimestamp(status?.updated_at || status?.imported_at)}</span></div>
          <div><span className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("calendar_verified")}</span><span className={`mt-1 inline-flex rounded-full px-3 py-1 text-xs font-bold ${status?.manual_review_count ? "bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200"}`}>{status?.manual_review_count ? `${t("manual_review_required")} · ${status.manual_review_count}` : t("calendar_verified")}</span></div>
          <div className="rounded-xl border border-cyan-200/70 bg-cyan-50/60 p-3 text-xs leading-5 text-cyan-900 dark:border-cyan-900 dark:bg-cyan-950/20 dark:text-cyan-100 sm:col-span-2 xl:col-span-5"><CalendarDays className="me-2 inline h-4 w-4" />{t("calendar_no_external_sync")} {t("calendar_history_hint")}</div>
        </CardContent>
      </Card>

      {events.length ? <div className="grid gap-6"><SemesterCalendar semester={1} events={semesterOne} language={language} t={t} /><SemesterCalendar semester={2} events={semesterTwo} language={language} t={t} /></div> : <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">{t("no_data")}</CardContent></Card>}
    </div>
  );
}
