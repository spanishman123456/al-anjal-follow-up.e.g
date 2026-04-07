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
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 28, right: 8, left: 0, bottom: 4 }} barCategoryGap="18%">
          <CartesianGrid strokeDasharray="3 3" stroke={BOARD.grid} vertical={false} />
          <XAxis dataKey={labelKey} tick={{ fontSize: 11, fill: BOARD.axis }} interval={0} angle={chartData.length > 6 ? -25 : 0} textAnchor={chartData.length > 6 ? "end" : "middle"} height={chartData.length > 6 ? 48 : 28} />
          <YAxis tick={{ fontSize: 11, fill: BOARD.axis }} domain={[0, "auto"]} />
          <Tooltip content={boardTooltip} />
          <Bar dataKey={valueKey} fill={BOARD.barFill} radius={[6, 6, 0, 0]} maxBarSize={48}>
            <LabelList dataKey={valueKey} position="top" fill="#64748b" fontSize={11} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Donut: three performance bands (green / amber / red). No-data students are excluded from the ring and center %. */
export function PassSplitDonut({
  distribution,
  onLevelLabel,
  approachingLabel,
  belowLabel,
  noDataLabel,
  centerCaption,
  height = 240,
  showLegend = true,
}) {
  const list = Array.isArray(distribution) ? distribution : [];
  const onLevel = list.find((d) => d.level === "on_level")?.count ?? 0;
  const approach = list.find((d) => d.level === "approach")?.count ?? 0;
  const below = list.find((d) => d.level === "below")?.count ?? 0;
  const noData = list.find((d) => d.level === "no_data")?.count ?? 0;
  const total = onLevel + approach + below + noData;
  const graded = onLevel + approach + below;
  // Percentage is based on all students in the snapshot (including no_data) for clearer reporting context.
  const pct = total > 0 ? Math.round((onLevel / total) * 1000) / 10 : 0;
  const segments = [
    { name: onLevelLabel, value: onLevel, fill: "#10b981" },
    { name: approachingLabel, value: approach, fill: "#f59e0b" },
    { name: belowLabel, value: below, fill: "#ef4444" },
  ];
  const data = segments.filter((d) => d.value > 0);
  const legendSpace = showLegend ? 92 : 0;
  const chartHeight = Math.max(height - legendSpace, 150);

  if (total === 0) {
    return (
      <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
        —
      </div>
    );
  }

  if (graded === 0) {
    return (
      <div className="flex h-[240px] flex-col items-center justify-center gap-1 text-sm text-muted-foreground">
        <span>—</span>
        {noData > 0 ? (
          <span className="text-xs">
            {noDataLabel}: {noData}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-sm overflow-hidden" style={{ height }}>
      {showLegend ? (
        <div className="mb-2 space-y-1 text-sm font-semibold">
          {segments.map((s) => (
            <div key={s.name} className="flex items-center gap-2" style={{ color: s.fill }}>
              <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: s.fill }} />
              <span>
                {s.name}: {s.value}
              </span>
            </div>
          ))}
        </div>
      ) : null}
      <div className="relative" style={{ height: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="45%"
              innerRadius={52}
              outerRadius={74}
              paddingAngle={2}
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.fill} stroke="white" strokeWidth={1} />
              ))}
            </Pie>
            <Tooltip content={boardTooltip} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center -translate-y-3">
          <span className="text-2xl font-semibold tabular-nums text-slate-800 dark:text-foreground">
            {onLevel}
          </span>
          {centerCaption ? (
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {centerCaption}
            </span>
          ) : null}
          <span className="text-[10px] text-muted-foreground">{pct}%</span>
        </div>
      </div>
    </div>
  );
}

/** Single-quarter cohort on-level % (no Quarter 1 vs Quarter 2 comparison). */
export function QuarterOnLevelFocus({ rate, termLabel, lineName, height = 220 }) {
  const label = termLabel || "—";
  const data = [{ name: label, rate: Number(rate ?? 0) }];
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 28, right: 12, left: 0, bottom: 8 }} barCategoryGap="45%">
          <CartesianGrid strokeDasharray="3 3" stroke={BOARD.grid} vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: BOARD.axis }} interval={0} />
          <YAxis
            tick={{ fontSize: 11, fill: BOARD.axis }}
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip content={boardTooltip} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="rate" name={lineName} fill={BOARD.lineQ1} radius={[6, 6, 0, 0]} maxBarSize={72}>
            <LabelList dataKey="rate" position="top" formatter={(v) => `${v}%`} fill="#64748b" fontSize={11} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Smooth “trend” across classes — area under average score by class. */
export function ClassScoreArea({ data, valueKey = "score", labelKey = "name", height = 240 }) {
  const chartData = Array.isArray(data) ? data : [];
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 12, right: 8, left: 0, bottom: chartData.length > 6 ? 36 : 8 }}>
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
            angle={chartData.length > 5 ? -30 : 0}
            textAnchor={chartData.length > 5 ? "end" : "middle"}
            height={chartData.length > 5 ? 48 : 28}
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
