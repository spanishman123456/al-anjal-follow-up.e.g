import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { api } from "@/lib/api";
import { useTranslations } from "@/lib/i18n";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function Calendar() {
  const { language } = useOutletContext();
  const t = useTranslations(language);
  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState(null);

  const loadEvents = async () => {
    try {
      const [eventsRes, statusRes] = await Promise.all([
        api.get("/calendar/events"),
        api.get("/calendar/status"),
      ]);
      setEvents(eventsRes.data);
      setStatus(statusRes.data);
    } catch (error) {
      toast.error(t("calendar_failed"));
    }
  };

  const handleSync = async () => {
    try {
      await api.post("/calendar/sync");
      toast.success(t("calendar_updated"));
      loadEvents();
    } catch (error) {
      toast.error(t("calendar_failed"));
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  return (
    <div className="space-y-6" data-testid="calendar-page">
      <PageHeader
        title={t("calendar")}
        subtitle={t("overview")}
        testIdPrefix="calendar"
        action={
          <div className="flex items-center gap-3">
            <Button onClick={handleSync} data-testid="calendar-sync">
              {t("sync_calendar")}
            </Button>
          </div>
        }
      />
      <Card data-testid="calendar-status">
        <CardContent className="pt-6 text-sm text-muted-foreground">
          <div data-testid="calendar-last-sync">
            {t("last_sync")}: {status?.synced_at || "—"}
          </div>
          <div className="mt-1 text-xs" data-testid="calendar-source">
            {t("source")}: {status?.source || "—"}
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-3" data-testid="calendar-events">
        {events.length ? (
          events.map((event) => (
            <Card key={event.id} data-testid={`calendar-event-${event.id}`}>
              <CardContent className="pt-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{event.title}</p>
                  <span className="text-sm text-muted-foreground">{event.date}</span>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <p className="text-sm text-muted-foreground" data-testid="calendar-empty">
            {t("no_data")}
          </p>
        )}
      </div>
    </div>
  );
}
