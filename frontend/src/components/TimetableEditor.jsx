import { Input } from "@/components/ui/input";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"];
const PERIODS = Array.from({ length: 8 }, (_, index) => index + 1);

const normalizeSchedule = (schedule = {}) => {
  const base = {};
  DAYS.forEach((day) => {
    const values = Array.isArray(schedule[day]) ? schedule[day].slice(0, 8) : [];
    base[day] = [...values, ...Array(Math.max(0, 8 - values.length)).fill("")];
  });
  return base;
};

export default function TimetableEditor({
  schedule,
  onChange,
  readOnly = false,
  dayLabels,
  periodLabel,
  orientation = "days-columns",
  dayHeaderLabel,
  disabled = false,
  testIdPrefix = "timetable",
}) {
  const normalized = normalizeSchedule(schedule);
  const labels = dayLabels || DAYS;
  const periodText = periodLabel || "Period";
  const dayHeader = dayHeaderLabel || "Day";

  const updateCell = (day, index, value) => {
    const next = normalizeSchedule(schedule);
    next[day][index] = value;
    onChange?.(next);
  };

  if (orientation === "days-rows") {
    return (
      <div className="overflow-x-auto rounded-lg border border-border/70" data-testid={`${testIdPrefix}-editor`}>
        <table className="min-w-[980px] w-full border-collapse text-sm" data-testid={`${testIdPrefix}-table`}>
          <thead>
            <tr className="bg-gradient-to-r from-[#10162A] via-[#172554] to-[#312e81] text-white">
              <th className="border border-white/15 px-3 py-3 text-start">{dayHeader}</th>
              {PERIODS.map((period) => (
                <th key={period} className="border border-white/15 px-3 py-3 text-center">
                  {period}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAYS.map((day, dayIndex) => (
              <tr key={day} className="transition-colors even:bg-muted/20 hover:bg-cyan-50/50 dark:hover:bg-cyan-950/20">
                <td className="border border-border/70 px-3 py-2 font-semibold text-foreground">{labels[dayIndex] || day}</td>
                {PERIODS.map((period, index) => (
                  <td key={`${day}-${period}`} className="border border-border/70 px-2 py-2">
                    {readOnly ? (
                      <span data-testid={`${testIdPrefix}-cell-${day}-${index}`}>
                        {normalized[day][index] || "—"}
                      </span>
                    ) : (
                      <Input
                        value={normalized[day][index]}
                        onChange={(event) => updateCell(day, index, event.target.value)}
                        disabled={disabled}
                        className="min-w-[88px] border-border/70 bg-background/90 transition-all focus-visible:border-cyan-400 focus-visible:ring-cyan-400/30"
                        data-testid={`${testIdPrefix}-input-${day}-${index}`}
                      />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto" data-testid={`${testIdPrefix}-editor`}>
      <table className="min-w-full border border-border text-sm" data-testid={`${testIdPrefix}-table`}>
        <thead>
          <tr className="bg-muted">
            <th className="border border-border px-3 py-2 text-left">{periodText}</th>
            {DAYS.map((day, index) => (
              <th key={day} className="border border-border px-3 py-2 text-left">
                {labels[index] || day}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PERIODS.map((period, index) => (
            <tr key={period}>
              <td className="border border-border px-3 py-2">{period}</td>
              {DAYS.map((day) => (
                <td key={day} className="border border-border px-2 py-2">
                  {readOnly ? (
                    <span data-testid={`${testIdPrefix}-cell-${day}-${index}`}>
                      {normalized[day][index] || "—"}
                    </span>
                  ) : (
                    <Input
                      value={normalized[day][index]}
                      onChange={(event) => updateCell(day, index, event.target.value)}
                      disabled={disabled}
                      data-testid={`${testIdPrefix}-input-${day}-${index}`}
                    />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
