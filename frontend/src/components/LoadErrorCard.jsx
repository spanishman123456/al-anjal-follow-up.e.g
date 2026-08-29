import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function LoadErrorCard({ message, onRetry, t, testId = "load-error" }) {
  return <Card role="alert" className="border-rose-300 bg-rose-50/80 text-rose-950 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-100" data-testid={testId}>
    <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
      <div className="flex min-w-0 items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-300" />
        <div><p className="font-semibold">{t("load_failed_title")}</p><p className="mt-1 text-sm">{message}</p></div>
      </div>
      <Button type="button" variant="outline" onClick={onRetry}><RefreshCw className="me-2 h-4 w-4" />{t("retry")}</Button>
    </CardContent>
  </Card>;
}
