/**
 * Grouped top navigation — maps all former sidebar routes into logical tabs.
 * Quarter-dependent assessment paths stay in sync with AppShell semester/quarter state.
 */
export function buildNavigationGroups({ t, quarter, schoolSection = "international", roleName = "Admin" }) {
  const assessmentMarksPath = quarter === 2 ? "/assessment-marks-q2" : "/assessment-marks";
  const finalExamsPath = quarter === 2 ? "/final-exams-assessment-q2" : "/final-exams-assessment";
  const isAdmin = roleName === "Admin";

  const isArabicSection = schoolSection === "arabic";
  const groups = [
    {
      id: "dashboard",
      type: "link",
      label: t("dashboard"),
      to: "/",
      testId: "nav-dashboard-link",
    },
    {
      id: "students",
      type: "dropdown",
      label: t("nav_group_students"),
      testId: "nav-students-group",
      items: [
        { to: "/students", label: isArabicSection ? t("student_management") : t("assessment"), testId: "nav-students" },
        { to: "/classes", label: t("classes"), testId: "nav-classes-link" },
      ],
    },
    {
      id: "assessments",
      type: "dropdown",
      label: t("nav_group_assessments"),
      testId: "nav-assessments-group",
      items: isArabicSection
        ? [{ to: "/arabic-grades", label: t("arabic_quarter_grades"), testId: "nav-arabic-grades" }]
        : [
            { to: assessmentMarksPath, label: t("nav_quizzes_chapter_test"), testId: "nav-assessment-marks" },
            { to: finalExamsPath, label: t("nav_final_exams"), testId: "nav-final-exams" },
            { to: "/total-marks", label: t("nav_total_marks"), testId: "nav-total-marks" },
          ],
    },
    {
      id: "insights",
      type: "dropdown",
      label: t("nav_group_insights"),
      testId: "nav-insights-group",
      items: [
        { to: "/analytics", label: t("analytics"), testId: "nav-analytics-link" },
        { to: "/reports", label: t("reports"), testId: "nav-reports-link" },
      ],
    },
    ...(!isArabicSection ? [{
      id: "programs",
      type: "dropdown",
      label: t("nav_group_programs"),
      testId: "nav-programs-group",
      items: [
        { to: "/remedial-plans", label: t("remedial_plans"), testId: "nav-remedial-link" },
        { to: "/rewards", label: t("rewards"), testId: "nav-rewards-link" },
        { to: "/lesson-plan-generator", label: t("lesson_plan_generator"), testId: "nav-lesson-plan-generator-link" },
      ],
    }] : []),
  ];

  if (isAdmin) {
    groups.push({
      id: "admin",
      type: "dropdown",
      label: t("nav_group_admin"),
      testId: "nav-admin-group",
      items: [
        { to: "/teachers", label: t("teachers"), testId: "nav-teachers-link" },
        { to: "/notifications", label: t("notifications"), testId: "nav-notifications-link" },
        { to: "/calendar", label: t("calendar"), testId: "nav-calendar-link" },
        { to: "/settings", label: t("settings"), testId: "nav-settings-link" },
      ],
    });
  } else {
    groups.push({
      id: "profile",
      type: "link",
      label: t("profile"),
      to: "/settings",
      testId: "nav-profile-link",
    });
  }

  return groups;
}

/** True when pathname matches a nav item (including nested routes like /teachers/:id). */
export function isNavItemActive(pathname, to) {
  if (!to) return false;
  if (to === "/") return pathname === "/";
  return pathname === to || pathname.startsWith(`${to}/`);
}

export function isNavGroupActive(pathname, group) {
  if (group.type === "link") {
    return isNavItemActive(pathname, group.to);
  }
  return (group.items || []).some((item) => isNavItemActive(pathname, item.to));
}
