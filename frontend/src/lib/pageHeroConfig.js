/**
 * Centralized page hero copy (i18n keys). Pages may override title, eyebrow, or description.
 */
export const PAGE_HERO_CONFIG = {
  dashboard: {
    eyebrowKey: "hero_eyebrow_overview",
    titleKey: "dashboard",
    descriptionKey: "hero_desc_dashboard",
  },
  analytics: {
    eyebrowKey: "hero_eyebrow_analysis_term",
    titleKey: "analytics",
    descriptionKey: "analytics_page_description",
  },
  reports: {
    eyebrowKey: "hero_eyebrow_report_center",
    titleKey: "reports",
    descriptionKey: "hero_desc_reports",
  },
  students: {
    eyebrowKey: "hero_eyebrow_student_records",
    titleKey: "assessment",
    descriptionKey: "hero_desc_students",
  },
  classes: {
    eyebrowKey: "hero_eyebrow_classes",
    titleKey: "classes",
    descriptionKey: "hero_desc_classes",
  },
  assessment_marks: {
    eyebrowKey: "hero_eyebrow_quiz_performance",
    titleKey: "nav_quizzes_chapter_test",
    descriptionKey: "hero_desc_quiz_results",
  },
  assessment_marks_q2: {
    eyebrowKey: "hero_eyebrow_quiz_performance",
    titleKey: "nav_quizzes_chapter_test",
    descriptionKey: "hero_desc_quiz_results",
  },
  final_exams: {
    eyebrowKey: "hero_eyebrow_practical_performance",
    titleKey: "nav_final_exams",
    descriptionKey: "hero_desc_final_practical",
  },
  final_exams_q2: {
    eyebrowKey: "hero_eyebrow_practical_performance",
    titleKey: "nav_final_exams",
    descriptionKey: "hero_desc_final_practical",
  },
  total_marks: {
    eyebrowKey: "hero_eyebrow_performance_levels",
    titleKey: "nav_total_marks",
    descriptionKey: "hero_desc_total_marks",
  },
  remedial_plans: {
    eyebrowKey: "hero_eyebrow_remedial",
    titleKey: "remedial_plans",
    descriptionKey: "hero_desc_remedial_plans",
  },
  rewards: {
    eyebrowKey: "hero_eyebrow_rewards",
    titleKey: "rewards",
    descriptionKey: "hero_desc_rewards",
  },
  lesson_plan: {
    eyebrowKey: "hero_eyebrow_lesson_plan",
    titleKey: "lesson_plan_generator",
    descriptionKey: "lesson_plan_generator_description",
  },
  teachers: {
    eyebrowKey: "hero_eyebrow_admin_management",
    titleKey: "teachers",
    descriptionKey: "hero_desc_teachers",
  },
  teacher_profile: {
    eyebrowKey: "hero_eyebrow_teacher_profile",
    titleKey: "teacher_profile",
    descriptionKey: "hero_desc_teacher_profile",
  },
  settings: {
    eyebrowKey: "hero_eyebrow_system_settings",
    titleKey: "settings",
    descriptionKey: "hero_desc_settings",
  },
  calendar: {
    eyebrowKey: "hero_eyebrow_calendar",
    titleKey: "calendar",
    descriptionKey: "hero_desc_calendar",
  },
  notifications: {
    eyebrowKey: "hero_eyebrow_notifications",
    titleKey: "notifications",
    descriptionKey: "hero_desc_notifications",
  },
};

/** Badges for semester / quarter / academic year from AppShell outlet context. */
export function buildAcademicBadges(t, { academicYear, semester, quarter, termScopeId, extra = [] } = {}) {
  const badges = [...extra].filter(Boolean);
  if (academicYear) {
    badges.push(`${t("academic_year")}: ${academicYear}`);
  }
  if (termScopeId && t(`term_${termScopeId}`)) {
    badges.push(t(`term_${termScopeId}`));
  } else if (semester) {
    badges.push(semester === "semester2" ? t("semester_two") : t("semester_one"));
    if (quarter) {
      badges.push(`${t("quarter")} ${quarter}`);
    }
  }
  return badges;
}

export function resolvePageHeroCopy(pageKey, t, overrides = {}) {
  const cfg = pageKey ? PAGE_HERO_CONFIG[pageKey] : null;
  if (!cfg) {
    return {
      eyebrow: overrides.eyebrow ?? overrides.subtitle ?? "",
      title: overrides.title ?? "",
      description: overrides.description ?? "",
    };
  }
  return {
    eyebrow: overrides.eyebrow ?? overrides.subtitle ?? t(cfg.eyebrowKey),
    title: overrides.title ?? t(cfg.titleKey),
    description: overrides.description ?? t(cfg.descriptionKey),
  };
}
