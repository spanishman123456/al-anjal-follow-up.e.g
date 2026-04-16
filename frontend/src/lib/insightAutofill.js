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

function translatePerformanceLevel(level, language = "en") {
  if (language !== "ar") {
    const map = {
      on_level: "On Level",
      approach: "Approach",
      below: "Below",
      no_data: "No Data",
    };
    return map[level] || level || "No Data";
  }
  const map = {
    on_level: "على المستوى",
    approach: "بحاجة إلى تعزيز",
    below: "دون المستوى",
    no_data: "لا توجد بيانات",
  };
  return map[level] || level || "لا توجد بيانات";
}

function joinLabels(labels, language = "en") {
  const translated = (labels || []).map((label) => translateInsightLabel(label, language));
  if (language === "ar") {
    return translated.join("، ");
  }
  return translated.join(", ");
}

function distributionCounts(distribution = []) {
  const lookup = new Map((distribution || []).map((item) => [item?.level, Number(item?.count ?? 0)]));
  return {
    onLevel: lookup.get("on_level") || 0,
    approach: lookup.get("approach") || 0,
    below: lookup.get("below") || 0,
    noData: lookup.get("no_data") || 0,
  };
}

function formatScore(value) {
  const num = toNumber(value);
  if (num == null) return null;
  return Number.isInteger(num) ? String(num) : String(Math.round(num * 100) / 100);
}

function buildStudentComponentRows(student, selectedQuarter = 1, language = "en") {
  const defs = selectedQuarter === 2
    ? [
        { label: language === "ar" ? "التقييم" : "Assessment", value: student?.focus_assessment, max: 15 },
        { label: language === "ar" ? "الاختبار القصير 3" : "Quiz 3", value: student?.focus_quiz_primary, max: 5 },
        { label: language === "ar" ? "الاختبار القصير 4" : "Quiz 4", value: student?.focus_quiz_secondary, max: 5 },
        { label: language === "ar" ? "اختبار الفصل 2" : "Chapter Test 2", value: student?.focus_chapter_test, max: 10 },
        { label: language === "ar" ? "النهائي العملي" : "Final Practical", value: student?.focus_final_practical, max: 10 },
        { label: language === "ar" ? "النهائي النظري" : "Final Theory", value: student?.focus_final_theory, max: 10 },
      ]
    : [
        { label: language === "ar" ? "التقييم" : "Assessment", value: student?.focus_assessment, max: 15 },
        { label: language === "ar" ? "الاختبار القصير 1" : "Quiz 1", value: student?.focus_quiz_primary, max: 5 },
        { label: language === "ar" ? "الاختبار القصير 2" : "Quiz 2", value: student?.focus_quiz_secondary, max: 5 },
        { label: language === "ar" ? "اختبار الفصل 1" : "Chapter Test 1", value: student?.focus_chapter_test, max: 10 },
        { label: language === "ar" ? "النهائي العملي" : "Final Practical", value: student?.focus_final_practical, max: 10 },
        { label: language === "ar" ? "النهائي النظري" : "Final Theory", value: student?.focus_final_theory, max: 10 },
      ];

  return defs
    .map((item) => {
      const score = toNumber(item.value);
      if (score == null) return null;
      return {
        ...item,
        score,
        gap: Math.max(0, item.max - score),
        pct: item.max > 0 ? score / item.max : 0,
      };
    })
    .filter(Boolean);
}

function buildComponentWeaknessText(student, selectedQuarter = 1, language = "en") {
  const rows = buildStudentComponentRows(student, selectedQuarter, language)
    .filter((row) => row.gap > 0)
    .sort((a, b) => {
      if (a.pct !== b.pct) return a.pct - b.pct;
      return b.gap - a.gap;
    })
    .slice(0, 2);

  if (!rows.length) return null;

  const parts = rows.map((row) =>
    language === "ar"
      ? `${row.label} (${formatScore(row.score)}/${row.max})`
      : `${row.label} (${formatScore(row.score)}/${row.max})`
  );

  if (language === "ar") {
    return `ويظهر أكبر فقد في الدرجات في ${parts.join(" و")}، وهو ما خفّض المجموع الإجمالي.`;
  }
  return `The largest mark losses came in ${parts.join(" and ")}, which held the overall total back.`;
}

function buildStudentInsights(payload, language = "en") {
  const student = payload?.selectedStudent || {};
  const name = String(student?.full_name || "").trim() || (language === "ar" ? "الطالب المحدد" : "The selected student");
  const className = String(student?.class_name || "").trim();
  const total = toNumber(payload?.focusAvg);
  const performanceLevel = payload?.performanceLevel || "no_data";
  const selectedQuarter = payload?.selectedQuarter === 2 ? 2 : 1;
  const performanceText = translatePerformanceLevel(performanceLevel, language);
  const targetThreshold = performanceLevel === "approach" ? 46 : performanceLevel === "below" ? 43 : null;
  const thresholdGap = total != null && targetThreshold != null ? Math.max(0, Math.round((targetThreshold - total) * 100) / 100) : null;
  const strengthsText = student?.strengths?.length
    ? joinLabels(student.strengths, language)
    : language === "ar"
      ? "الاستمرار في إنجاز المهام الأساسية بثبات"
      : "consistent completion of core learning tasks";
  const weaknessesText = student?.weak_areas?.length
    ? joinLabels(student.weak_areas, language)
    : language === "ar"
      ? "لا تظهر نقاط ضعف رئيسية في البيانات الحالية"
      : "no major weakness is currently indicated in the recorded data";
  const needsSupport = performanceLevel === "below" || performanceLevel === "approach";
  const hasRecordedWeakAreas = (student?.weak_areas?.length || 0) > 0;
  const fallbackWeaknessText =
    !hasRecordedWeakAreas && needsSupport && total != null && thresholdGap != null
      ? language === "ar"
        ? `لا تظهر البيانات المسجلة مجال ضعف محددًا بعينه، لكن مجموع الربع الحالي ما زال أقل من الحد المطلوب بمقدار ${formatScore(thresholdGap)} درجة.`
        : `No single weak strand is currently flagged in the recorded components, but the current quarter total is still ${formatScore(thresholdGap)} points below the required threshold.`
      : null;
  const standoutGapText =
    !hasRecordedWeakAreas && needsSupport && total != null && thresholdGap != null
      ? language === "ar"
        ? `ولا تزال النتيجة الحالية أقل من الحد المطلوب بمقدار ${formatScore(thresholdGap)} درجة.`
        : `The current total still sits ${formatScore(thresholdGap)} points below the required threshold.`
      : "";
  const componentWeaknessText = buildComponentWeaknessText(student, selectedQuarter, language);
  const actionsText =
    needsSupport && !hasRecordedWeakAreas && total != null
      ? language === "ar"
        ? `ركز على رفع مجموع ${name} الفصلي من خلال مراجعة موجهة قصيرة المدى، وتدريبات علاجية منتظمة، ومتابعة أسبوعية حتى يتجاوز الحد المطلوب.`
        : `Focus on raising ${name}'s quarter total through short-cycle review, targeted recovery practice, and weekly monitoring until the score moves above the required threshold.`
      : needsSupport
        ? language === "ar"
          ? `ركز على دعم ${name} في ${student?.weak_areas?.length ? weaknessesText : "المهارات الأساسية"} من خلال متابعة قصيرة المدى وتدريب موجه ومراجعة أسبوعية للتقدم.`
          : `Provide focused support for ${name} in ${student?.weak_areas?.length ? weaknessesText : "core skills"} through short-cycle follow-up, targeted practice, and weekly review of progress.`
        : language === "ar"
          ? `استمر في تقديم مهام إثرائية وتحديات مناسبة لـ ${name} مع متابعة دورية للحفاظ على مستوى الأداء الحالي.`
          : `Maintain enrichment and challenge tasks for ${name}, with periodic review to keep the current level of performance stable.`;
  const recommendationsText =
    needsSupport && !hasRecordedWeakAreas && total != null
      ? language === "ar"
        ? `يوصى بخطة دعم فردية تركز على رفع مجموع ${name} فوق الحد المطلوب، مع أهداف قصيرة المدى وتقويمات تكوينية متكررة وتواصل منتظم مع الأسرة.`
        : `Create an individualized support plan for ${name} focused on lifting the quarter total above the required threshold, with short-term targets, frequent formative checks, and regular family communication.`
      : needsSupport
        ? language === "ar"
          ? `يوصى بوضع خطة دعم فردية لـ ${name} تشمل أهدافًا قصيرة المدى، وتقويمات تكوينية متكررة، وتواصلًا منتظمًا مع الأسرة.`
          : `Create an individualized support plan for ${name} with short-term targets, frequent formative checks, and regular family communication.`
        : language === "ar"
          ? `يوصى بالحفاظ على مستوى ${name} من خلال أنشطة إثرائية، ومهام تطبيقية، ومتابعة دورية لضمان استمرار التقدم.`
          : `Continue extending ${name} with enrichment work, applied tasks, and regular check-ins to sustain growth.`;

  if (language === "ar") {
    return {
      analysis_strengths: `تظهر أفضل نقاط قوة ${name} في ${strengthsText}.${className ? ` وينتمي الطالب إلى فصل ${className}.` : ""}`,
      analysis_weaknesses: hasRecordedWeakAreas
        ? `تحتاج الجوانب التالية إلى متابعة عند ${name}: ${weaknessesText}.`
        : fallbackWeaknessText
          ? `${fallbackWeaknessText}${componentWeaknessText ? ` ${componentWeaknessText}` : ""}`
          : `لا تظهر البيانات الحالية نقاط ضعف رئيسية عند ${name}، مع ضرورة الاستمرار في المتابعة المنتظمة للحفاظ على هذا المستوى.`,
      analysis_performance:
        total != null
          ? `${name} مستواه الحالي هو ${performanceText} في الفترة المحددة، ومجموعه الفصلي الحالي هو ${total} من 50.`
          : `${name} مستواه الحالي هو ${performanceText}، لكن لا توجد درجات كافية حتى الآن لحساب مجموع فصلي دقيق.`,
      analysis_standout_data: `عدد مجالات القوة المسجلة: ${student?.strengths?.length || 0}. وعدد مجالات الضعف المسجلة: ${student?.weak_areas?.length || 0}.${standoutGapText ? ` ${standoutGapText}` : ""}`,
      analysis_actions: actionsText,
      analysis_recommendations: recommendationsText,
    };
  }

  return {
    analysis_strengths: `${name} shows strongest outcomes in ${strengthsText}.${className ? ` The student belongs to class ${className}.` : ""}`,
    analysis_weaknesses: hasRecordedWeakAreas
      ? `The main areas that need follow-up for ${name} are ${weaknessesText}.`
      : fallbackWeaknessText
        ? `${fallbackWeaknessText}${componentWeaknessText ? ` ${componentWeaknessText}` : ""}`
        : `No major weakness is currently indicated for ${name}, but regular monitoring is still recommended to maintain progress.`,
    analysis_performance:
      total != null
        ? `${name} is currently ${performanceText} for the selected term, with a current quarter total of ${total} out of 50.`
        : `${name} is currently ${performanceText}, but there is not enough scored data yet to compute a reliable quarter total.`,
    analysis_standout_data: `Recorded strengths: ${student?.strengths?.length || 0}. Recorded weak areas: ${student?.weak_areas?.length || 0}.${standoutGapText ? ` ${standoutGapText}` : ""}`,
    analysis_actions: actionsText,
    analysis_recommendations: recommendationsText,
  };
}

function buildCommonInsights(payload, language = "en") {
  if (payload?.selectedStudent) {
    return buildStudentInsights(payload, language);
  }

  const excelling = payload?.excelling || [];
  const struggling = payload?.struggling || [];
  const counts = distributionCounts(payload?.distribution || []);
  const totalStudents = counts.onLevel + counts.approach + counts.below + counts.noData;

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
        ? `نسبة الطلاب على المستوى في الفترة المحددة هي ${focusRate}%، ومتوسط مجموع الربع هو ${focusAvg}. ويوجد ${counts.onLevel} على المستوى، و${counts.approach} بحاجة إلى تعزيز، و${counts.below} دون المستوى.${counts.noData ? ` كما أن ${counts.noData} لا توجد لهم بيانات كافية.` : ""}`
        : `نسبة الطلاب على المستوى في الفترة المحددة هي ${focusRate}%. وما زال متوسط مجموع الربع يتضح مع إدخال درجات إضافية.${counts.noData ? ` ويوجد ${counts.noData} من الطلاب دون بيانات كافية.` : ""}`
      : focusAvg != null
        ? `Cohort on-level rate is ${focusRate}% for the selected term, with an average quarter total of ${focusAvg}. The current distribution is ${counts.onLevel} on level, ${counts.approach} approaching, and ${counts.below} below level.${counts.noData ? ` ${counts.noData} students still have no data.` : ""}`
        : `Cohort on-level rate is ${focusRate}% for the selected term. Average quarter total is still stabilizing as more scores are recorded.${counts.noData ? ` ${counts.noData} students still have no data.` : ""}`;

  if (language === "ar") {
    return {
      analysis_strengths: `يظهر الطلاب أفضل نتائجهم في ${strengthsText}. ${excellingSample ? `ويُعد ${excellingSample} من أبرز المتقدمين حاليًا بفضل الأداء المرتفع والثابت وعادات التعلم الإيجابية.` : "ويحافظ عدد من الطلاب على أداء مرتفع ومستقر خلال الربع."}`,
      analysis_weaknesses: `تتمثل أبرز جوانب الضعف في ${weaknessesText}. ${supportSample ? `ويحتاج ${supportSample} إلى خطط دعم مركزة مع متابعة قصيرة المدى وتواصل مستمر مع الأسرة.` : "وتحتاج مجموعة الدعم الحالية إلى تدخل أسبوعي ومتابعة منتظمة للتقدم."}`,
      analysis_performance: perfLine,
      analysis_standout_data: `إجمالي الطلاب في النطاق الحالي هو ${totalStudents}. ويوجد ${excelling.length} ضمن مجموعة الأداء المرتفع، بينما يحتاج ${struggling.length} إلى دعم موجه. استخدم تفاصيل الفصل والمهارات لتحديد أولويات المتابعة.`,
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
    analysis_standout_data: `${totalStudents} students are in the current scope. ${excelling.length} students are in the high-performance group while ${struggling.length} need targeted support. Use class and strand detail to prioritize follow-up.`,
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
  const selectedStudent = overview?.selected_student || null;
  const performanceLevel =
    selectedQuarter === 2
      ? selectedStudent?.performance_level_q2
      : selectedStudent?.performance_level_q1;
  const focusTotal =
    selectedQuarter === 2
      ? selectedStudent?.quarter2_total
      : selectedStudent?.quarter1_total;
  return buildCommonInsights({
    focusRate: q.on_level_rate ?? overview?.exceeding_rate,
    focusAvg: selectedStudent ? focusTotal : q.avg_total,
    excelling: overview?.excelling_students || [],
    struggling: overview?.struggling_students || [],
    distribution: q.distribution || [],
    selectedStudent,
    performanceLevel,
    selectedQuarter,
  }, language);
}

export function buildAutoInsightsFromReport(report, language = "en") {
  return buildCommonInsights({
    focusRate: report?.exceeding_rate,
    focusAvg: report?.avg_total_score,
    excelling: report?.top_performers || [],
    struggling: report?.students_needing_support || [],
    distribution: report?.distribution || [],
  }, language);
}
