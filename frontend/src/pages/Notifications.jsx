import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { api } from "@/lib/api";
import { useTranslations } from "@/lib/i18n";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const EVENT_TYPES = [
  { value: "all", labelKey: "all_types" },
  { value: "calendar_sync", labelKey: "calendar" },
  { value: "promotion", labelKey: "promote_students" },
  { value: "student_transfer", labelKey: "transfer_student" },
  { value: "student_delete", labelKey: "delete_student" },
  { value: "password_change", labelKey: "password_change" },
];

export default function Notifications() {
  const { language } = useOutletContext();
  const t = useTranslations(language);
  const [logs, setLogs] = useState([]);
  const [filterType, setFilterType] = useState("all");

  const getEventLabel = (value) => {
    const match = EVENT_TYPES.find((type) => type.value === value);
    return match ? t(match.labelKey) : value;
  };

  const loadLogs = async (type = filterType) => {
    try {
      const response = await api.get("/notifications", {
        params: type === "all" ? {} : { event_type: type },
      });
      setLogs(response.data);
    } catch (error) {
      toast.error(t("notifications_failed"));
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const handleFilterChange = (value) => {
    setFilterType(value);
    loadLogs(value);
  };

  const handleExport = async (format) => {
    try {
      const response = await api.get("/notifications/export", {
        params: filterType === "all" ? { format } : { format, event_type: filterType },
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `notifications.${format === "excel" ? "xlsx" : "pdf"}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      toast.error(t("download_fail"));
    }
  };

  const handleClearNotifications = async () => {
    try {
      const res = await api.delete("/notifications");
      setLogs([]);
      const count = res?.data?.deleted_count ?? 0;
      toast.success(count ? `Cleared ${count} notification(s).` : "Notifications cleared.");
    } catch (error) {
      toast.error("Failed to clear notifications.");
    }
  };

  return (
    <div className="space-y-6" data-testid="notifications-page">
      <PageHeader
        title={t("notifications")}
        subtitle={t("overview")}
        testIdPrefix="notifications"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={handleClearNotifications} data-testid="notifications-clear">
              Clear Notification
            </Button>
            <Button variant="secondary" onClick={() => handleExport("pdf")} data-testid="notifications-export-pdf">
              {t("download_pdf")}
            </Button>
            <Button variant="secondary" onClick={() => handleExport("excel")} data-testid="notifications-export-excel">
              {t("download_excel")}
            </Button>
          </div>
        }
      />

      <Card data-testid="notifications-filter">
        <CardContent className="flex flex-wrap items-center gap-3 pt-6">
          <Select value={filterType} onValueChange={handleFilterChange}>
            <SelectTrigger className="w-56" data-testid="notifications-filter-select">
              <SelectValue placeholder={t("filter_by_type")} />
            </SelectTrigger>
            <SelectContent>
              {EVENT_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value} data-testid={`notifications-filter-${type.value}`}>
                  {t(type.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="grid gap-3" data-testid="notifications-list">
        {logs.length ? (
          logs.map((log) => (
            <Card key={log.id} data-testid={`notification-${log.id}`}>
              <CardContent className="pt-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold" data-testid={`notification-message-${log.id}`}>
                      {log.message}
                    </p>
                    <p className="text-sm text-muted-foreground" data-testid={`notification-recipient-${log.id}`}>
                      {t("recipient")}: {log.recipient || "—"}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge data-testid={`notification-type-${log.id}`}>
                      {getEventLabel(log.event_type)}
                    </Badge>
                    <span className="text-xs text-muted-foreground" data-testid={`notification-time-${log.id}`}>
                      {log.created_at}
                    </span>
                    <span className="text-xs text-muted-foreground" data-testid={`notification-status-${log.id}`}>
                      {t("status")}: {log.status}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <p className="text-sm text-muted-foreground" data-testid="notifications-empty">
            {t("no_data")}
          </p>
        )}
      </div>
    </div>
  );
}
