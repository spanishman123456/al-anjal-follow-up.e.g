function topLabels(items, key, limit = 3) {
  const counts = new Map();
  (items || []).forEach((item) => {
    (item?.[key] || []).forEach((label) => {
      const clean = String(label || "").trim();
      if (!clean) return;
      counts.set(clean, (counts.get(clean) || 0) + 1);
    });
  });
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label]) => label);
}

function topNames(items, limit = 3) {
  return (items || [])
    .map((item) => String(item?.full_name || "").trim())
    .filter(Boolean)
    .slice(0, limit);
}

function formatNames(names) {
  if (!names.length) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names[0]}, ${names[1]}, and ${names[2]}`;
}

function toNumber(value) {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function quarterTrendSummary(students) {
  let improved = 0;
  let declined = 0;
  let stable = 0;
  (students || []).forEach((student) => {
    const q1 = toNumber(student?.quarter1_total);
    const q2 = toNumber(student?.quarter2_total);
    if (q1 == null || q2 == null) return;
    const delta = q2 - q1;
    if (delta >= 2) improved += 1;
    else if (delta <= -2) declined += 1;
    else stable += 1;
  });
  return { improved, declined, stable };
}

function buildCommonInsights(payload) {
  const excelling = payload?.excelling || [];
  const struggling = payload?.struggling || [];
  const allStudentsForTrend = [...excelling, ...struggling];

  const strengths = topLabels(excelling, "strengths");
  const weaknesses = topLabels(struggling, "weak_areas");
  const topExcellingNames = topNames(excelling);
  const topSupportNames = topNames(struggling);

  const q1Rate = toNumber(payload?.q1Rate) ?? 0;
  const q2Rate = toNumber(payload?.q2Rate) ?? 0;
  const q1Avg = toNumber(payload?.q1Avg);
  const q2Avg = toNumber(payload?.q2Avg);
  const trend = quarterTrendSummary(allStudentsForTrend);

  const rateDelta = (q2Rate - q1Rate).toFixed(1);
  const avgDelta =
    q1Avg != null && q2Avg != null ? (q2Avg - q1Avg).toFixed(2) : null;

  const strengthsText = strengths.length
    ? strengths.join(", ")
    : "consistent completion of core assessments";
  const weaknessesText = weaknesses.length
    ? weaknesses.join(", ")
    : "assessment consistency and foundational revision";

  const excellingSample = formatNames(topExcellingNames);
  const supportSample = formatNames(topSupportNames);

  return {
    analysis_strengths: `Students show strongest outcomes in ${strengthsText}. ${excellingSample ? `${excellingSample} are currently leading with steady high performance and positive learning habits.` : "Several students are maintaining high and stable performance across the quarter."}`,
    analysis_weaknesses: `The main risk areas are ${weaknessesText}. ${supportSample ? `${supportSample} need focused support plans with short-cycle follow-up and parent communication.` : "A focused support group should receive weekly intervention and progress checks."}`,
    analysis_performance: `Overall trend: on-level rate moved from ${q1Rate}% in Q1 to ${q2Rate}% in Q2 (${rateDelta >= 0 ? "+" : ""}${rateDelta} points). ${q1Avg != null && q2Avg != null ? `Average total changed from ${q1Avg} to ${q2Avg}${avgDelta ? ` (${avgDelta >= 0 ? "+" : ""}${avgDelta})` : ""}.` : "Average total is still stabilizing as more scores are recorded."} ${trend.improved > 0 ? `${trend.improved} students show clear improvement over time.` : "Improvement is limited and needs tighter weekly monitoring."}`,
    analysis_standout_data: `${trend.improved > 0 ? `${trend.improved} students improved quarter-to-quarter` : "Few students showed strong quarter-to-quarter growth"}, ${trend.stable} remained stable, and ${trend.declined} declined. ${excelling.length} students are in the high-performance group while ${struggling.length} need targeted support.`,
    analysis_actions: "Run small-group intervention for weak areas twice weekly; assign differentiated practice by skill gap; review progress every week using quarter trend checks; contact families of students with repeated decline.",
    analysis_recommendations: "Maintain challenge tasks for top performers and create individualized recovery plans for support students. Use short formative checks, participation tracking, and monthly review meetings to keep growth measurable and sustainable.",
  };
}

export function buildAutoInsightsFromOverview(overview) {
  const q1 = overview?.quarter1 || {};
  const q2 = overview?.quarter2 || {};
  return buildCommonInsights({
    q1Rate: q1.on_level_rate,
    q2Rate: q2.on_level_rate,
    q1Avg: q1.avg_total,
    q2Avg: q2.avg_total,
    excelling: overview?.excelling_students || [],
    struggling: overview?.struggling_students || [],
  });
}

export function buildAutoInsightsFromReport(report) {
  const q1 = report?.quarter1 || {};
  const q2 = report?.quarter2 || {};
  return buildCommonInsights({
    q1Rate: q1.on_level_rate,
    q2Rate: q2.on_level_rate,
    q1Avg: q1.avg_total,
    q2Avg: q2.avg_total,
    excelling: report?.top_performers || [],
    struggling: report?.students_needing_support || [],
  });
}
