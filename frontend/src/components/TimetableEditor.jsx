import { Input } from "@/components/ui/input";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"];
const PERIODS = Array.from({ length: 8 }, (_, index) => index + 1);

const normalizeSchedule = (schedule = {}) => {
  const base = {};
  DAYS.forEach((day) => {
    base[day] = schedule[day] ? [...schedule[day]] : Array(8).fill("");
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
      <div className="overflow-x-auto" data-testid="timetable-editor">
        <table className="min-w-full border border-border text-sm" data-testid="timetable-table">
          <thead>
            <tr className="bg-muted">
              <th className="border border-border px-3 py-2 text-left">{dayHeader}</th>
              {PERIODS.map((period) => (
                <th key={period} className="border border-border px-3 py-2 text-left">
                  {period}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAYS.map((day, dayIndex) => (
              <tr key={day}>
                <td className="border border-border px-3 py-2">{labels[dayIndex] || day}</td>
                {PERIODS.map((period, index) => (
                  <td key={`${day}-${period}`} className="border border-border px-2 py-2">
                    {readOnly ? (
                      <span data-testid={`timetable-cell-${day}-${index}`}>
                        {normalized[day][index] || "—"}
                      </span>
                    ) : (
                      <Input
                        value={normalized[day][index]}
                        onChange={(event) => updateCell(day, index, event.target.value)}
                        data-testid={`timetable-input-${day}-${index}`}
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
    <div className="overflow-x-auto" data-testid="timetable-editor">
      <table className="min-w-full border border-border text-sm" data-testid="timetable-table">
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
                    <span data-testid={`timetable-cell-${day}-${index}`}>
                      {normalized[day][index] || "—"}
                    </span>
                  ) : (
                    <Input
                      value={normalized[day][index]}
                      onChange={(event) => updateCell(day, index, event.target.value)}
                      data-testid={`timetable-input-${day}-${index}`}
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
