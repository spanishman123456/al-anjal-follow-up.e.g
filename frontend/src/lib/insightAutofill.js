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

function formatNames(names, language = "en") {
  if (!names.length) return "";
  if (language === "ar") {
    if (names.length === 1) return names[0];
    if (names.length === 2) return `${names[0]} و${names[1]}`;
    return `${names[0]}، ${names[1]}، و${names[2]}`;
  }
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names[0]}, ${names[1]}, and ${names[2]}`;
}

function toNumber(value) {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function translateInsightLabel(label, language = "en") {
  if (language !== "ar") return label;
  const map = {
    Attendance: "الحضور",
    Participation: "المشاركة",
    Project: "المشروع",
    Homework: "الواجبات",
    Quizzes: "الاختبارات القصيرة",
    "Chapter tests": "اختبارات الفصول",
    "Quarter exams": "اختبارات الربع",
  };
  return map[label] || label;
}

function joinLabels(labels, language = "en") {
  const translated = (labels || []).map((label) => translateInsightLabel(label, language));
  if (language === "ar") {
    return translated.join("، ");
  }
  return translated.join(", ");
}

function buildCommonInsights(payload, language = "en") {
  const excelling = payload?.excelling || [];
  const struggling = payload?.struggling || [];

  const strengths = topLabels(excelling, "strengths");
  const weaknesses = topLabels(struggling, "weak_areas");
  const topExcellingNames = topNames(excelling);
  const topSupportNames = topNames(struggling);

  const focusRate = toNumber(payload?.focusRate) ?? 0;
  const focusAvg = toNumber(payload?.focusAvg);

  const strengthsText = strengths.length
    ? joinLabels(strengths, language)
    : language === "ar"
      ? "الاستمرار الجيد في إنجاز التقييمات الأساسية"
      : "consistent completion of core assessments";
  const weaknessesText = weaknesses.length
    ? joinLabels(weaknesses, language)
    : language === "ar"
      ? "الانتظام في التقييم والمراجعة التأسيسية"
      : "assessment consistency and foundational revision";

  const excellingSample = formatNames(topExcellingNames, language);
  const supportSample = formatNames(topSupportNames, language);

  const perfLine =
    language === "ar"
      ? focusAvg != null
        ? `نسبة الطلاب على المستوى في الفترة المحددة هي ${focusRate}%، ومتوسط مجموع الربع هو ${focusAvg}.`
        : `نسبة الطلاب على المستوى في الفترة المحددة هي ${focusRate}%. وما زال متوسط مجموع الربع يتضح مع إدخال درجات إضافية.`
      : focusAvg != null
        ? `Cohort on-level rate is ${focusRate}% for the selected term, with an average quarter total of ${focusAvg}.`
        : `Cohort on-level rate is ${focusRate}% for the selected term. Average quarter total is still stabilizing as more scores are recorded.`;

  if (language === "ar") {
    return {
      analysis_strengths: `يظهر الطلاب أفضل نتائجهم في ${strengthsText}. ${excellingSample ? `ويُعد ${excellingSample} من أبرز المتقدمين حاليًا بفضل الأداء المرتفع والثابت وعادات التعلم الإيجابية.` : "ويحافظ عدد من الطلاب على أداء مرتفع ومستقر خلال الربع."}`,
      analysis_weaknesses: `تتمثل أبرز جوانب الضعف في ${weaknessesText}. ${supportSample ? `ويحتاج ${supportSample} إلى خطط دعم مركزة مع متابعة قصيرة المدى وتواصل مستمر مع الأسرة.` : "وتحتاج مجموعة الدعم الحالية إلى تدخل أسبوعي ومتابعة منتظمة للتقدم."}`,
      analysis_performance: perfLine,
      analysis_standout_data: `يوجد ${excelling.length} من الطلاب ضمن مجموعة الأداء المرتفع، بينما يحتاج ${struggling.length} إلى دعم موجه. استخدم تفاصيل الفصل والمهارات لتحديد أولويات المتابعة.`,
      analysis_actions:
        "نفذ تدخلات في مجموعات صغيرة لمجالات الضعف مرتين أسبوعيًا، ووزع تدريبات متفاوتة حسب فجوة المهارة، وراجع التقدم كل أسبوع، وتواصل مع أسر الطلاب الذين يظلون دون المستوى المتوقع.",
      analysis_recommendations:
        "حافظ على مهام إثرائية للطلاب المتفوقين، وأنشئ خطط علاج فردية للطلاب المحتاجين للدعم. استخدم تقويمات تكوينية قصيرة، ومتابعة المشاركة، واجتماعات مراجعة شهرية للحفاظ على نمو واضح ومستدام.",
    };
  }

  return {
    analysis_strengths: `Students show strongest outcomes in ${strengthsText}. ${excellingSample ? `${excellingSample} are currently leading with steady high performance and positive learning habits.` : "Several students are maintaining high and stable performance across the quarter."}`,
    analysis_weaknesses: `The main risk areas are ${weaknessesText}. ${supportSample ? `${supportSample} need focused support plans with short-cycle follow-up and parent communication.` : "A focused support group should receive weekly intervention and progress checks."}`,
    analysis_performance: perfLine,
    analysis_standout_data: `${excelling.length} students are in the high-performance group while ${struggling.length} need targeted support. Use class and strand detail to prioritize follow-up.`,
    analysis_actions:
      "Run small-group intervention for weak areas twice weekly; assign differentiated practice by skill gap; review progress every week; contact families of students who remain below expectations.",
    analysis_recommendations:
      "Maintain challenge tasks for top performers and create individualized recovery plans for support students. Use short formative checks, participation tracking, and monthly review meetings to keep growth measurable and sustainable.",
  };
}

/** @param {number} [selectedQuarter] 1 or 2 — which quarter in the semester is in focus */
export function buildAutoInsightsFromOverview(overview, selectedQuarter = 1, language = "en") {
  const q =
    selectedQuarter === 2 ? overview?.quarter2 || {} : overview?.quarter1 || {};
  return buildCommonInsights({
    focusRate: q.on_level_rate ?? overview?.exceeding_rate,
    focusAvg: q.avg_total,
    excelling: overview?.excelling_students || [],
    struggling: overview?.struggling_students || [],
  }, language);
}

export function buildAutoInsightsFromReport(report, language = "en") {
  return buildCommonInsights({
    focusRate: report?.exceeding_rate,
    focusAvg: report?.avg_total_score,
    excelling: report?.top_performers || [],
    struggling: report?.students_needing_support || [],
  }, language);
}
