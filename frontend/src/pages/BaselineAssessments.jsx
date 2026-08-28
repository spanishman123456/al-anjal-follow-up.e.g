import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useOutletContext, useSearchParams } from "react-router-dom";
import { BarChart3, BookOpenCheck, Download, Save, Users, Percent, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useTranslations } from "@/lib/i18n";
import { displayQuarterNumber } from "@/lib/academicScope";
import { BASELINE_COLORS, baselinePercent, changedBaselineMarks, parseBaselineMark } from "@/lib/baselineScores";
import { PageHeader } from "@/components/layout/PageHeader";
import { AcademicTermSelect } from "@/components/layout/AcademicTermSelect";
import { ChartCard, MetricCard } from "@/components/analytics";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const selectStyle = "h-11 w-full min-w-0 rounded-xl border border-input bg-background px-3 text-sm text-foreground";
const draftKey = (user, record) => `baseline-draft:${user}:${record}`;
function readDraft(key) { try { return JSON.parse(sessionStorage.getItem(key)); } catch { return null; } }
function removeDraft(key) { try { sessionStorage.removeItem(key); } catch { /* storage unavailable */ } }

export function BaselineBar({ label, value, display, color = "#38BDF8" }) {
  return <div className="space-y-2 py-2" data-testid="baseline-bar">
    <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm"><span className="break-words font-medium">{label}</span><span className="font-bold tabular-nums" style={{ color }}>{display ?? baselinePercent(value)}</span></div>
    <div role="img" aria-label={`${label}: ${display ?? baselinePercent(value)}`} className="h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"><div className="h-full rounded-full" style={{ width: `${value ?? 0}%`, background: color }} /></div>
  </div>;
}

export function BaselineDonut({ student, labels }) {
  const value = student.percentage;
  return <div className="flex flex-col items-center gap-6 rounded-3xl bg-[#172138] p-6 text-white sm:flex-row" data-testid="baseline-student-donut">
    <div className="relative h-48 w-48 shrink-0"><svg viewBox="0 0 120 120" role="img" aria-label={`${student.full_name}: ${baselinePercent(value)}`}>
      <circle cx="60" cy="60" r="49" fill="none" stroke="#34415B" strokeWidth="10" />
      <circle cx="60" cy="60" r="49" fill="none" stroke="#48D1E5" strokeWidth="10" pathLength="100" strokeDasharray={`${value ?? 0} 100`} transform="rotate(-90 60 60)" />
    </svg><div className="absolute inset-0 flex flex-col items-center justify-center"><strong className="text-3xl tabular-nums">{baselinePercent(value)}</strong><span className="mt-2 text-sm text-slate-300">{labels.percent}</span></div></div>
    <div className="min-w-0 space-y-3"><h3 className="break-words text-2xl font-bold">{student.full_name}</h3><p className="text-slate-300">{student.class_name} · {labels.subject}</p><p>{labels.score}: <bdi dir="ltr" className="font-bold">{student.score_label}</bdi></p><p>{labels.level}: <strong className="text-cyan-300">{student.level_label}</strong></p></div>
  </div>;
}

function Insights({ items }) {
  return <div className="grid gap-4 md:grid-cols-2">{items.map((item) => <Card key={item.title} className="border-primary/20 bg-primary/[0.03]"><CardHeader className="pb-2"><CardTitle className="text-base text-primary">{item.title}</CardTitle></CardHeader><CardContent><p className="text-sm leading-7">{item.body}</p></CardContent></Card>)}</div>;
}

export default function BaselineAssessments({ view = "entry" }) {
  const context = useOutletContext();
  // Scope remounts prevent outstanding responses from crossing terms/sections/users.
  return <BaselinePage key={`${context.profile?.id}:${context.schoolSection}:${context.academicYear}:${context.semester}:${context.quarter}:${view}`} context={context} view={view} />;
}

function BaselinePage({ context, view }) {
  const { language, schoolSection, academicYear, semester, quarter, classes = [], profile } = context;
  const t = useTranslations(language);
  const [search, setSearch] = useSearchParams();
  const [records, setRecords] = useState(null);
  const [recordId, setRecordId] = useState("");
  const [snapshot, setSnapshot] = useState(null);
  const [values, setValues] = useState({});
  const [classId, setClassId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [tab, setTab] = useState("overview");
  const [setupOpen, setSetupOpen] = useState(false);
  const today = new Date();
  const [form, setForm] = useState({ title: "", max_score: "", test_date: `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`, class_ids: [] });
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [tick, setTick] = useState(0);
  const [listTick, setListTick] = useState(0);
  const initialRecord = useRef(search.get("record"));
  const scope = useMemo(() => ({ school_section: schoolSection, academic_year: academicYear, semester: semester === "semester2" ? 2 : 1, quarter }), [schoolSection, academicYear, semester, quarter]);
  const analytics = view === "analytics";
  const titleKey = schoolSection === "arabic" ? "baseline_diagnostic" : "baseline_pre";
  const rows = snapshot?.students || [];
  const selected = rows.find((s) => s.id === studentId) || rows[0];
  const storageKey = draftKey(profile?.id, recordId);
  const dirty = !analytics && rows.some((s) => { try { return parseBaselineMark(values[s.id], snapshot.record.max_score) !== s.score; } catch { return true; } });
  const invalid = !analytics && rows.some((s) => { try { parseBaselineMark(values[s.id], snapshot?.record.max_score); return false; } catch { return true; } });
  const errorMessage = (e, fallback) => typeof e?.response?.data?.detail === "string" && e.response.data.detail.startsWith("baseline_") ? t(e.response.data.detail) : t(fallback);

  useEffect(() => {
    if (!profile?.id) return;
    let active = true;
    setError("");
    api.get("/baseline-assessments", { params: scope }).then(({ data }) => {
      if (!active) return;
      setRecords(data);
      setRecordId((previous) => data.some((r) => r.id === previous) ? previous : data.find((r) => r.id === initialRecord.current)?.id || data[0]?.id || "");
    }).catch((e) => { if (active) setError(errorMessage(e, "baseline_load_failed")); });
    return () => { active = false; };
    // Language does not affect record metadata or entered marks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, profile?.id, listTick]);

  useEffect(() => {
    if (!recordId || !profile?.id) return;
    let active = true;
    setLoading(true); setError(""); setSnapshot(null);
    api.get(`/baseline-assessments/${recordId}`, { params: { lang: language, class_id: analytics && classId ? classId : undefined } }).then(({ data }) => {
      if (!active) return;
      setSnapshot(data);
      const draft = !analytics && readDraft(storageKey);
      setValues(draft?.values || Object.fromEntries(data.students.map((s) => [s.id, s.score ?? ""])));
      setConflict(Boolean(draft && draft.revision !== data.record.revision));
      setStudentId((previous) => data.students.some((s) => s.id === previous) ? previous : data.students[0]?.id || "");
    }).catch((e) => { if (active) setError(errorMessage(e, "baseline_load_failed")); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordId, language, analytics, classId, tick, profile?.id, storageKey]);

  useEffect(() => {
    const warn = (event) => { if (dirty) { event.preventDefault(); event.returnValue = ""; } };
    const refresh = () => { setTick((v) => v + 1); setListTick((v) => v + 1); };
    window.addEventListener("beforeunload", warn);
    window.addEventListener("app-refresh-data", refresh);
    return () => { window.removeEventListener("beforeunload", warn); window.removeEventListener("app-refresh-data", refresh); };
  }, [dirty]);

  function changeMark(id, raw) {
    const next = { ...values, [id]: raw }; setValues(next);
    try {
      if (!Object.keys(changedBaselineMarks(rows, next, snapshot.record.max_score)).length) { removeDraft(storageKey); return; }
    } catch { /* Preserve invalid drafts until corrected. */ }
    try { sessionStorage.setItem(storageKey, JSON.stringify({ revision: snapshot.record.revision, values: next })); } catch { /* beforeunload still warns */ }
  }
  function reload() {
    if (dirty && !window.confirm(t("baseline_leave"))) return;
    removeDraft(storageKey); setTick((v) => v + 1); setListTick((v) => v + 1);
  }
  async function setup(event) {
    event.preventDefault();
    if (busyRef.current) return;
    const max = Number(form.max_score);
    if (!form.title.trim() || !form.test_date || !Number.isFinite(max) || max < 0.01 || max > 1000000 || Number(max.toFixed(2)) !== max || !form.class_ids.length) { toast.error(t("baseline_invalid_setup")); return; }
    if (!window.confirm(`${t("baseline_confirm_setup")}\n${t("baseline_max")}: ${max}\n${form.class_ids.map((id) => classes.find((c) => c.id === id)?.name).join(", ")}`)) return;
    busyRef.current = true; setBusy(true);
    try {
      const { data } = await api.post("/baseline-assessments", { ...scope, ...form, title: form.title.trim(), max_score: max });
      setRecords((prev) => [data, ...(prev || [])]); setRecordId(data.id); setClassId(""); setSetupOpen(false);
      setSearch({ record: data.id }, { replace: true });
    } catch (e) { toast.error(errorMessage(e, "baseline_save_failed")); }
    finally { busyRef.current = false; setBusy(false); }
  }
  async function save() {
    if (busyRef.current || !snapshot || conflict) return;
    let changes;
    try { changes = changedBaselineMarks(rows, values, snapshot.record.max_score); } catch { toast.error(t("baseline_invalid_score")); return; }
    if (!Object.keys(changes).length) { removeDraft(storageKey); return; }
    if (rows.some((s) => s.score != null && changes[s.id] === null) && !window.confirm(t("baseline_clear"))) return;
    busyRef.current = true; setBusy(true);
    try {
      await api.patch(`/baseline-assessments/${recordId}/scores`, { revision: snapshot.record.revision, scores: changes });
      removeDraft(storageKey); toast.success(t("baseline_saved")); setTick((v) => v + 1);
    } catch (e) {
      if (e?.response?.status === 409) setConflict(true);
      toast.error(errorMessage(e, "baseline_save_failed"));
    } finally { busyRef.current = false; setBusy(false); }
  }
  async function download() {
    if (busyRef.current || !snapshot) return;
    busyRef.current = true; setBusy(true);
    try {
      const response = await api.get(`/baseline-assessments/${recordId}/export.pdf`, { params: { snapshot_id: snapshot.snapshot_id, lang: language, class_id: classId || undefined, student_id: selected?.id }, responseType: "blob" });
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement("a"); anchor.href = url;
      anchor.download = `baseline-${academicYear}-Q${displayQuarterNumber(semester, quarter)}-${language}.pdf`;
      document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      if (e?.response?.status === 409) { setConflict(true); toast.error(t("baseline_conflict")); }
      else toast.error(t("baseline_export_failed"));
    } finally { busyRef.current = false; setBusy(false); }
  }

  const recordClasses = records?.find((r) => r.id === recordId)?.classes || [];
  const visibleRows = !analytics && classId ? rows.filter((s) => s.class_id === classId) : rows;
  const labels = snapshot?.labels;
  const navQuery = recordId ? `?record=${recordId}` : "";
  return <div dir={language === "ar" ? "rtl" : "ltr"} className="space-y-6" data-testid="baseline-page">
    <PageHeader title={t(analytics ? `${titleKey}_analytics` : titleKey)} description={t("baseline_description")} eyebrow={`${academicYear} · Q${displayQuarterNumber(semester, quarter)}`} badges={["75%+ · 50%+"]} action={<div className="flex flex-wrap gap-2">
      {!analytics && <Button onClick={() => setSetupOpen(!setupOpen)} disabled={busy}><BookOpenCheck className="me-2 h-4 w-4" />{t("baseline_setup")}</Button>}
      {analytics && <Button onClick={download} disabled={!snapshot || busy || loading || conflict}><Download className="me-2 h-4 w-4" />{t(busy ? "baseline_exporting" : "baseline_export")}</Button>}
    </div>} />
    <nav className="flex flex-wrap gap-3" aria-label={t("baseline_analysis")}>
      <Button asChild variant={!analytics ? "default" : "outline"}><Link to={`/baseline-scores${navQuery}`}>{t("baseline_entry")}</Link></Button>
      <Button asChild variant={analytics ? "default" : "outline"}><Link to={`/baseline-analytics${navQuery}`} onClick={(e) => { if (dirty && !window.confirm(t("baseline_leave"))) e.preventDefault(); }}><BarChart3 className="me-2 h-4 w-4" />{t("baseline_analysis")}</Link></Button>
    </nav>
    {setupOpen && !analytics && <Card><CardHeader><CardTitle>{t("baseline_setup")}</CardTitle><p className="text-sm leading-7 text-muted-foreground">{t("baseline_setup_hint")}</p></CardHeader><CardContent>
      <form onSubmit={setup} className="space-y-5"><fieldset disabled={busy} className="grid gap-4 md:grid-cols-3">
        <label className="space-y-2 text-sm">{t("baseline_title")}<Input required maxLength={120} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
        <label className="space-y-2 text-sm">{t("baseline_date")}<Input required type="date" value={form.test_date} onChange={(e) => setForm({ ...form, test_date: e.target.value })} /></label>
        <label className="space-y-2 text-sm">{t("baseline_max")}<Input required type="number" min="0.01" max="1000000" step="0.01" placeholder="0.00" data-testid="baseline-max-score" aria-describedby="baseline-max-hint" value={form.max_score} onChange={(e) => setForm({ ...form, max_score: e.target.value })} onBlur={(e) => {
          // Pad exact hundredths without rounding the maximum; 0.00 still cannot be submitted.
          const numeric = Number(e.target.value);
          if (e.target.value !== "" && Number.isFinite(numeric) && numeric >= 0 && numeric <= 1000000 && Number(numeric.toFixed(2)) === numeric) {
            const formatted = numeric.toFixed(2);
            setForm((previous) => ({ ...previous, max_score: formatted }));
          }
        }} /><span id="baseline-max-hint" className="block text-xs text-muted-foreground">{t("baseline_max_hint")}</span></label>
      </fieldset><fieldset disabled={busy}><legend className="mb-3 text-sm font-bold">{t("baseline_classes")}</legend><div className="flex flex-wrap gap-3">{classes.map((cls) => <label key={cls.id} className="flex cursor-pointer items-center gap-2 rounded-xl border p-3"><input type="checkbox" checked={form.class_ids.includes(cls.id)} onChange={(e) => setForm({ ...form, class_ids: e.target.checked ? [...form.class_ids, cls.id] : form.class_ids.filter((id) => id !== cls.id) })} />{cls.name}</label>)}</div></fieldset><Button type="submit" disabled={busy || !classes.length}>{t("baseline_create")}</Button></form>
    </CardContent></Card>}
    <Card><CardContent className="grid gap-4 pt-6 md:grid-cols-3"><label className="space-y-2 text-sm"><span>{t("baseline_select")}</span><select aria-label={t("baseline_select")} className={selectStyle} value={recordId} disabled={busy || !records?.length} onChange={(e) => { setRecordId(e.target.value); setClassId(""); setSearch({ record: e.target.value }, { replace: true }); }}><option value="" disabled>—</option>{records?.map((r) => <option key={r.id} value={r.id}>{r.title} · {r.teacher_name} · /{r.max_score}</option>)}</select></label>
      <label className="space-y-2 text-sm"><span>{t("baseline_classes")}</span><select aria-label={t("baseline_classes")} className={selectStyle} value={classId} disabled={!recordId || busy} onChange={(e) => setClassId(e.target.value)}><option value="">{t("baseline_all")}</option>{recordClasses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <div className="flex items-end"><AcademicTermSelect disabled={busy} testIdPrefix="baseline-term" triggerClassName="w-full sm:w-full" /></div>
    </CardContent></Card>
    {error && <div role="alert" className="rounded-xl border border-rose-300 p-4 text-rose-600">{error}<Button variant="outline" className="ms-3" onClick={reload}>{t("baseline_reload")}</Button></div>}
    {conflict && <div role="alert" className="rounded-xl border border-amber-400 p-4">{t("baseline_conflict")}<Button variant="outline" className="ms-3" onClick={reload}>{t("baseline_reload")}</Button></div>}
    {(loading || (!records && !error)) && <p role="status">{t("baseline_loading")}</p>}
    {records?.length === 0 && <Card><CardContent className="py-12 text-center text-muted-foreground">{t("baseline_empty")}</CardContent></Card>}
    {snapshot && !loading && <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard className="bg-card text-card-foreground" icon={Users} label={labels.total} value={snapshot.stats.total} /><MetricCard className="bg-card text-card-foreground" icon={CheckCircle2} label={labels.graded} value={<bdi dir="ltr">{snapshot.stats.graded} / {snapshot.stats.total}</bdi>} /><MetricCard className="bg-card text-card-foreground" icon={Percent} accent="primary" label={labels.mean} value={baselinePercent(snapshot.stats.mean)} /><MetricCard className="bg-card text-card-foreground" icon={BarChart3} accent="success" label={labels.completion} value={baselinePercent(snapshot.stats.completion)} /></div>
      {!analytics ? <Card><CardHeader className="gap-3"><div className="flex flex-wrap items-center justify-between gap-3"><CardTitle>{t("baseline_entry")} · {t("baseline_max")}: {snapshot.record.max_score}</CardTitle><Button onClick={save} disabled={busy || !dirty || invalid || conflict}><Save className="me-2 h-4 w-4" />{t(busy ? "baseline_saving" : "baseline_save")}</Button></div><p className="text-sm text-muted-foreground">{labels.rules}</p><p className="text-xs text-muted-foreground">{t("baseline_roster_hint")}</p>{dirty && <p role="status" className="text-sm font-bold text-amber-600">{t("baseline_dirty")}</p>}{invalid && <p role="alert" className="text-sm text-rose-600">{t("baseline_invalid_score")}</p>}</CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full text-start text-sm"><thead><tr>{[labels.student, labels.class, labels.score, labels.percent, labels.level].map((l) => <th key={l} className="p-3 text-start">{l}</th>)}</tr></thead><tbody>{visibleRows.map((s) => {
        let isInvalid = false; try { parseBaselineMark(values[s.id], snapshot.record.max_score); } catch { isInvalid = true; }
        return <tr key={s.id} className="border-b"><td className="p-3">{s.full_name}</td><td className="p-3">{s.class_name}</td><td className="p-3"><Input type="text" inputMode="decimal" aria-label={`${labels.score}: ${s.full_name}`} aria-invalid={isInvalid} disabled={busy || conflict} className="w-28" value={values[s.id] ?? ""} onChange={(e) => changeMark(s.id, e.target.value)} /></td><td className="p-3 tabular-nums">{baselinePercent(s.percentage)}</td><td className="p-3 font-bold" style={{ color: BASELINE_COLORS[s.level] }}>{s.level_label}</td></tr>;
      })}</tbody></table></div></CardContent></Card> : <>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label={t("baseline_analysis")}>{["overview", "individual", "report"].map((item) => <Button key={item} role="tab" aria-selected={tab === item} variant={tab === item ? "default" : "outline"} onClick={() => setTab(item)}>{t(`baseline_${item}`)}</Button>)}</div>
        <label className="block max-w-xl space-y-2 rounded-2xl border bg-card p-4 text-sm text-card-foreground">{t("baseline_student")}<select className={selectStyle} value={selected?.id || ""} disabled={!rows.length} onChange={(e) => setStudentId(e.target.value)}>{rows.map((s) => <option key={s.id} value={s.id}>{s.full_name} · {s.class_name}</option>)}</select></label>
        {selected && <BaselineDonut student={selected} labels={labels} />}
        {tab !== "individual" && <>
          <div className="grid gap-5 lg:grid-cols-2"><ChartCard title={labels.class_means}>{snapshot.classes.map((c) => <BaselineBar key={c.id} label={c.name} value={c.mean} />)}</ChartCard><ChartCard title={labels.distribution}>{snapshot.distribution.map((d) => <BaselineBar key={d.key} label={d.label} value={d.percentage} display={`${d.count} · ${d.percentage}%`} color={BASELINE_COLORS[d.key]} />)}</ChartCard></div>
          <ChartCard title={labels.students} subtitle={t("baseline_legend")}><div className={tab === "report" ? "" : "max-h-[520px] overflow-y-auto pe-2"}>{rows.map((s) => <button type="button" key={s.id} className="block w-full rounded-lg px-2 text-start hover:bg-muted/60 focus-visible:outline-primary" onClick={() => { setStudentId(s.id); setTab("individual"); }} aria-label={`${t("baseline_detail")}: ${s.full_name}`}><BaselineBar label={`${s.full_name} · ${s.class_name} · ${s.score_label}`} value={s.percentage} display={`${baselinePercent(s.percentage)} · ${s.level_label}`} color={BASELINE_COLORS[s.level]} /></button>)}</div></ChartCard>
          <Insights items={snapshot.insights} />
        </>}
        {selected && tab !== "overview" && <><ChartCard title={labels.comparison}><BaselineBar label={labels.student} value={selected.percentage} /><BaselineBar label={labels.mean} value={selected.class_mean} color="#8B2BEC" /></ChartCard><Insights items={selected.insights} /></>}
        <div className="space-y-3 rounded-2xl border bg-card p-5 text-card-foreground"><p className="text-sm leading-7">{labels.rules}</p><p className="text-sm leading-7">{labels.scope_note}</p><p className="text-xs text-muted-foreground">{t("baseline_pdf_hint")}</p></div>
      </>}
    </>}
  </div>;
}
