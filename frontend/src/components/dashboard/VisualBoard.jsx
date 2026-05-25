import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  LabelList,
} from "recharts";
import { PERFORMANCE_CHART_COLORS } from "@/lib/performanceBadges";

/** Reference-inspired professional dashboard palette (light blues + clear semantic greens/ambers/reds). */
export const BOARD = {
  barFill: "#7dd3fc",
  barFillSecondary: "#38bdf8",
  grid: "#e2e8f0",
  axis: "#64748b",
  lineQ1: "#22c55e",
  area: "#93c5fd",
  areaStroke: "#2563eb",
};

const boardTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-md dark:border-border dark:bg-background/95">
      <p className="font-semibold text-foreground">{label}</p>
      {payload.map((entry, idx) => (
        <p key={idx} className="text-muted-foreground">
          {entry.name}: <span className="font-medium text-foreground">{entry.value}</span>
        </p>
      ))}
    </div>
  );
};

function DonutLegendList({ items, className = "", dense = false }) {
  const listClass = dense
    ? "donut-legend-list donut-legend-list--dense text-sm font-semibold"
    : "donut-legend-list space-y-2.5 text-sm font-semibold";
  return (
    <ul className={`${listClass} ${className}`.trim()}>
      {items.map((item) => (
        <li key={item.key || item.name} className="flex items-start gap-2.5 leading-snug">
          <span
            className="mt-1 inline-block h-3 w-3 shrink-0 rounded-sm"
            style={{ backgroundColor: item.fill, opacity: item.opacity ?? 1 }}
          />
          <span className="min-w-0 break-words text-foreground" style={{ color: item.fill }}>
            <span className="text-foreground">{item.legendName || item.name}</span>
            {item.value != null ? (
              <span className="font-medium text-muted-foreground">
                {": "}
                {item.value}
                {item.share != null ? ` (${item.share}%)` : ""}
              </span>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

function DonutChartPane({ data, centerValue, centerCaption, centerSubtext }) {
  return (
    <div className="donut-chart-panel">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius="52%"
            outerRadius="78%"
            paddingAngle={2}
          >
            {data.map((entry, i) => (
              <Cell
                key={entry.name || i}
                fill={entry.fill}
                fillOpacity={entry.opacity ?? 1}
                stroke="white"
                strokeWidth={1}
              />
            ))}
          </Pie>
          <Tooltip content={boardTooltip} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-semibold tabular-nums text-slate-800 dark:text-foreground">
          {centerValue}
        </span>
        {centerCaption ? (
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {centerCaption}
          </span>
        ) : null}
        {centerSubtext ? (
          <span className="text-[10px] text-muted-foreground">{centerSubtext}</span>
        ) : null}
      </div>
    </div>
  );
}

export function BoardShell({ sidebar, children, className = "" }) {
  return (
    <div
      className={`flex flex-col gap-6 lg:flex-row lg:items-start ${className}`}
      data-testid="visual-board-shell"
    >
      <aside className="w-full shrink-0 space-y-4 lg:sticky lg:top-4 lg:w-72">{sidebar}</aside>
      <div className="min-w-0 flex-1 space-y-6">{children}</div>
    </div>
  );
}

export function BoardPanel({ title, subtitle, children, className = "", testId }) {
  return (
    <div
      className={`rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-border dark:bg-card ${className}`}
      data-testid={testId}
    >
      <div className="mb-3 border-b border-slate-100 pb-2 dark:border-border/60">
        <h3 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-foreground">
          {title}
        </h3>
        {subtitle != null && subtitle !== false ? (
          <div className="mt-1 text-xs text-muted-foreground [&_.inline-flex]:text-foreground">{subtitle}</div>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export function ClassAverageBarChart({ data, valueKey = "score", labelKey = "name", height = 260 }) {
  const chartData = Array.isArray(data) ? data : [];
  const needsAngledTicks =
    chartData.length > 4 || chartData.some((item) => String(item?.[labelKey] || "").length > 14);
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 28, right: 8, left: 0, bottom: needsAngledTicks ? 20 : 4 }} barCategoryGap="18%">
          <CartesianGrid strokeDasharray="3 3" stroke={BOARD.grid} vertical={false} />
          <XAxis
            dataKey={labelKey}
            tick={{ fontSize: 11, fill: BOARD.axis }}
            interval={0}
            angle={needsAngledTicks ? -18 : 0}
            textAnchor={needsAngledTicks ? "end" : "middle"}
            height={needsAngledTicks ? 64 : 28}
          />
          <YAxis tick={{ fontSize: 11, fill: BOARD.axis }} domain={[0, "auto"]} />
          <Tooltip content={boardTooltip} />
          <Bar dataKey={valueKey} fill={BOARD.barFill} radius={[6, 6, 0, 0]} maxBarSize={48}>
            {chartData.map((entry, index) => (
              <Cell key={`bar-${index}`} fill={entry?.fill || BOARD.barFill} fillOpacity={entry?.opacity ?? 1} />
            ))}
            <LabelList dataKey={valueKey} position="top" fill="#64748b" fontSize={11} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Donut: performance bands — legend left, chart right (no overlap). */
export function PassSplitDonut({
  distribution,
  onLevelLabel,
  approachingLabel,
  belowLabel,
  noDataLabel,
  centerCaption,
  height = 280,
  showLegend = true,
}) {
  const list = Array.isArray(distribution) ? distribution : [];
  const onLevel = list.find((d) => d.level === "on_level")?.count ?? 0;
  const approach = list.find((d) => d.level === "approach")?.count ?? 0;
  const below = list.find((d) => d.level === "below")?.count ?? 0;
  const noData = list.find((d) => d.level === "no_data")?.count ?? 0;
  const total = onLevel + approach + below + noData;
  const graded = onLevel + approach + below;
  const pct = total > 0 ? Math.round((onLevel / total) * 1000) / 10 : 0;
  const segments = [
    { key: "on_level", name: onLevelLabel, value: onLevel, fill: PERFORMANCE_CHART_COLORS.on_level },
    { key: "approach", name: approachingLabel, value: approach, fill: PERFORMANCE_CHART_COLORS.approach },
    { key: "below", name: belowLabel, value: below, fill: PERFORMANCE_CHART_COLORS.below },
  ];
  const data = segments.filter((d) => d.value > 0);

  if (total === 0) {
    return (
      <div className="flex min-h-[240px] items-center justify-center text-sm text-muted-foreground">
        —
      </div>
    );
  }

  if (graded === 0) {
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center gap-1 text-sm text-muted-foreground">
        <span>—</span>
        {noData > 0 ? (
          <span className="text-xs">
            {noDataLabel}: {noData}
          </span>
        ) : null}
      </div>
    );
  }

  if (!showLegend) {
    return (
      <div className="flex min-h-[240px] items-center justify-center">
        <DonutChartPane
          data={data}
          centerValue={onLevel}
          centerCaption={centerCaption}
          centerSubtext={`${pct}%`}
        />
      </div>
    );
  }

  return (
    <div className="donut-layout w-full" style={{ minHeight: Math.max(height, 280) }}>
      <div className="donut-text-panel" aria-label="Chart legend">
        <DonutLegendList items={segments} />
        {noData > 0 ? (
          <p className="mt-4 text-xs text-muted-foreground">
            {noDataLabel}: {noData}
          </p>
        ) : null}
      </div>
      <div className="donut-chart-panel-wrap" aria-hidden={false}>
        <DonutChartPane
          data={data}
          centerValue={onLevel}
          centerCaption={centerCaption}
          centerSubtext={`${pct}%`}
        />
      </div>
    </div>
  );
}

export function ScoreBreakdownDonut({
  data,
  centerCaption,
  centerValue,
  height = 280,
  showLegend = true,
}) {
  const list = Array.isArray(data) ? data.filter((item) => Number(item?.value || 0) > 0) : [];
  const total = list.reduce((sum, item) => sum + Number(item?.value || 0), 0);

  if (total <= 0) {
    return (
      <div className="flex min-h-[240px] items-center justify-center text-sm text-muted-foreground">
        —
      </div>
    );
  }

  if (!showLegend) {
    return (
      <div className="flex min-h-[240px] items-center justify-center">
        <DonutChartPane
          data={list}
          centerValue={Math.round(Number(centerValue ?? total) * 10) / 10}
          centerCaption={centerCaption}
          centerSubtext="100%"
        />
      </div>
    );
  }

  const denseLegend = list.length >= 4;

  return (
    <div className="donut-layout w-full" style={{ minHeight: Math.max(height, 300) }}>
      <div className="donut-text-panel" aria-label="Component marks legend">
        <DonutLegendList items={list} dense={denseLegend} />
      </div>
      <div className="donut-chart-panel-wrap">
        <DonutChartPane
          data={list}
          centerValue={Math.round(Number(centerValue ?? total) * 10) / 10}
          centerCaption={centerCaption}
          centerSubtext="100%"
        />
      </div>
    </div>
  );
}

/** Single-quarter cohort on-level % (no Quarter 1 vs Quarter 2 comparison). */
export function QuarterOnLevelFocus({
  rate,
  termLabel,
  lineName,
  height = 220,
  maxValue = 100,
  tickFormatter,
  labelFormatter,
}) {
  const label = termLabel || "—";
  const data = [{ name: label, rate: Number(rate ?? 0) }];
  const resolvedTickFormatter =
    tickFormatter || ((value) => (maxValue === 100 ? `${value}%` : `${value}`));
  const resolvedLabelFormatter =
    labelFormatter || ((value) => (maxValue === 100 ? `${value}%` : `${value}`));
  const yTicks = maxValue === 100 ? [0, 25, 50, 75, 100] : [0, 10, 20, 30, 40, 50];
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 28, right: 12, left: 0, bottom: 8 }} barCategoryGap="45%">
          <CartesianGrid strokeDasharray="3 3" stroke={BOARD.grid} vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: BOARD.axis }} interval={0} />
          <YAxis
            tick={{ fontSize: 11, fill: BOARD.axis }}
            domain={[0, maxValue]}
            ticks={yTicks}
            tickFormatter={resolvedTickFormatter}
          />
          <Tooltip content={boardTooltip} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="rate" name={lineName} fill={BOARD.lineQ1} radius={[6, 6, 0, 0]} maxBarSize={72}>
            <LabelList dataKey="rate" position="top" formatter={resolvedLabelFormatter} fill="#64748b" fontSize={11} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Smooth “trend” across classes — area under average score by class. */
export function ClassScoreArea({ data, valueKey = "score", labelKey = "name", height = 240 }) {
  const chartData = Array.isArray(data) ? data : [];
  const needsAngledTicks =
    chartData.length > 4 || chartData.some((item) => String(item?.[labelKey] || "").length > 14);
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 12, right: 8, left: 0, bottom: needsAngledTicks ? 44 : 8 }}>
          <defs>
            <linearGradient id="boardAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={BOARD.area} stopOpacity={0.55} />
              <stop offset="100%" stopColor={BOARD.area} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={BOARD.grid} vertical={false} />
          <XAxis
            dataKey={labelKey}
            tick={{ fontSize: 10, fill: BOARD.axis }}
            interval={0}
            angle={needsAngledTicks ? -18 : 0}
            textAnchor={needsAngledTicks ? "end" : "middle"}
            height={needsAngledTicks ? 60 : 28}
          />
          <YAxis tick={{ fontSize: 11, fill: BOARD.axis }} domain={[0, "auto"]} />
          <Tooltip content={boardTooltip} />
          <Area
            type="monotone"
            dataKey={valueKey}
            stroke={BOARD.areaStroke}
            strokeWidth={2}
            fill="url(#boardAreaGrad)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BoardHighlightsCard({ children, title }) {
  return (
    <div className="rounded-xl border border-slate-200/90 bg-slate-50/80 p-4 shadow-sm dark:border-border dark:bg-muted/30">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      <div className="space-y-3 text-sm">{children}</div>
    </div>
  );
}
