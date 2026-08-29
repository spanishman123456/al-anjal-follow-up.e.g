import { useEffect, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function interpolate(message, values) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
    message,
  );
}

export function ScoreSheetImportControl({
  t,
  endpoint = "/score-sheet/import",
  params,
  targets,
  disabled = false,
  onImported,
  testIdPrefix = "score-sheet",
}) {
  const [target, setTarget] = useState(targets[0]?.value || "");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!targets.some((item) => item.value === target)) setTarget(targets[0]?.value || "");
  }, [target, targets]);

  const upload = async (file, apply) => {
    const form = new FormData();
    form.append("file", file);
    return api.post(endpoint, form, {
      headers: { "Content-Type": "multipart/form-data" },
      params: { ...params, target, apply },
    });
  };

  const importFile = async (file) => {
    if (!file || !target || busy) return;
    setBusy(true);
    try {
      const preview = (await upload(file, false)).data;
      if (!preview.matched_count) {
        toast.error(t("score_sheet_no_matches"));
        return;
      }
      const confirmed = window.confirm(interpolate(t("score_sheet_confirm"), {
        matched: preview.matched_count,
        overwrite: preview.overwrite_count,
        unmatched: preview.unmatched_count + preview.ambiguous_count + preview.duplicate_count,
        invalid: preview.invalid_count,
      }));
      if (!confirmed) return;
      const result = (await upload(file, true)).data;
      toast.success(interpolate(t("score_sheet_imported"), { count: result.imported_count }));
      await onImported?.(result);
    } catch (error) {
      const detail = error?.response?.data?.detail;
      toast.error(typeof detail === "string" && detail.startsWith("score_sheet_") ? t(detail) : t("score_sheet_import_failed"));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return <div className="flex flex-wrap items-center gap-2" data-testid={`${testIdPrefix}-control`}>
    {targets.length > 1 && <Select value={target} onValueChange={setTarget} disabled={disabled || busy}>
      <SelectTrigger className="w-full min-w-[220px] sm:w-auto" data-testid={`${testIdPrefix}-target`}>
        <SelectValue placeholder={t("score_sheet_target")} />
      </SelectTrigger>
      <SelectContent>{targets.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
    </Select>}
    <input
      ref={inputRef}
      type="file"
      accept=".xlsx,.xls,.csv"
      className="hidden"
      data-testid={`${testIdPrefix}-file`}
      onChange={(event) => importFile(event.target.files?.[0])}
    />
    <Button type="button" onClick={() => inputRef.current?.click()} disabled={disabled || busy || !target} data-testid={`${testIdPrefix}-button`}>
      <Upload className="me-2 h-4 w-4" />{t(busy ? "score_sheet_importing" : "score_sheet_import_excel")}
    </Button>
  </div>;
}
