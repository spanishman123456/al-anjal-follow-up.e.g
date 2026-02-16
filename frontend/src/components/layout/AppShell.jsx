import { NavLink, Outlet, useNavigate, Link, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BarChart3,
  ClipboardList,
  Trophy,
  FileText,
  Settings,
  Bell,
  CalendarDays,
  UserRound,
  LogOut,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n";
import { api, BACKEND_ROOT_URL, isProductionBackendUrl } from "@/lib/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const AppShell = ({
  language,
  setLanguage,
  theme,
  setTheme,
  semester,
  setSemester,
  academicYear,
  classes = [],
  classesLoaded = false,
  loadClasses,
}) => {
  const t = useTranslations(language);
  const isRTL = language === "ar";
  const navigate = useNavigate();
  const location = useLocation();
  const [profile, setProfile] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const expandedNavKeyFromPath =
    location.pathname === "/students" || location.pathname === "/assessment-marks" || location.pathname === "/final-exams-assessment"
      ? "nav-quarter-marks"
      : location.pathname === "/assessment-marks-q2" || location.pathname === "/final-exams-assessment-q2"
        ? "nav-quarter-marks-q2"
        : null;
  const [expandedNavKey, setExpandedNavKey] = useState(expandedNavKeyFromPath);
  useEffect(() => {
    if (expandedNavKeyFromPath) setExpandedNavKey(expandedNavKeyFromPath);
  }, [expandedNavKeyFromPath]);

  const loadProfile = async () => {
    try {
      const response = await api.get("/users/profile");
      setProfile(response.data);
    } catch (error) {
      setProfile(null);
    }
  };

  useEffect(() => {
    loadProfile();
    const handler = () => loadProfile();
    window.addEventListener("profile-updated", handler);
    return () => window.removeEventListener("profile-updated", handler);
  }, []);

  const loadNotifications = async () => {
    try {
      const response = await api.get("/notifications");
      setNotifications(response.data.slice(0, 5));
    } catch (error) {
      setNotifications([]);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  // Keep backend awake on Render free tier: ping every 10 min while app is open so it doesn't spin down
  useEffect(() => {
    if (!isProductionBackendUrl || !BACKEND_ROOT_URL) return;
    const ping = () => {
      fetch(`${BACKEND_ROOT_URL}/health`, { method: "GET" }).catch(() => {});
    };
    ping();
    const intervalMs = 10 * 60 * 1000;
    const id = setInterval(ping, intervalMs);
    return () => clearInterval(id);
  }, []);

  const handleLogout = () => {
    setLogoutConfirmOpen(true);
  };

  const confirmLogout = () => {
    localStorage.removeItem("auth_token");
    window.location.href = "/login";
  };
  const allNavItems = [
    { to: "/", label: t("dashboard"), icon: LayoutDashboard, testId: "nav-dashboard-link", roles: ["Admin", "Teacher"] },
    {
      label: t("first_quarter_marks"),
      icon: FileText,
      testId: "nav-quarter-marks",
      roles: ["Admin", "Teacher"],
      children: [
        { to: "/students", label: t("assessment"), testId: "nav-students-link" },
        { to: "/assessment-marks", label: t("quizzes_chapter_test_marks"), testId: "nav-assessment-marks-link" },
        { to: "/final-exams-assessment", label: t("final_exams_assessment"), testId: "nav-final-exams-assessment-link" },
      ],
    },
    {
      label: t("second_quarter_marks"),
      icon: FileText,
      testId: "nav-quarter-marks-q2",
      roles: ["Admin", "Teacher"],
      children: [
        { to: "/students", label: t("assessment"), testId: "nav-students-q2-link" },
        { to: "/assessment-marks-q2", label: t("quizzes_chapter_test_marks"), testId: "nav-assessment-marks-q2-link" },
        { to: "/final-exams-assessment-q2", label: t("final_exams_assessment"), testId: "nav-final-exams-assessment-q2-link" },
      ],
    },
    { to: "/teachers", label: t("teachers"), icon: UserRound, testId: "nav-teachers-link", roles: ["Admin"] },
    { to: "/classes", label: t("classes"), icon: GraduationCap, testId: "nav-classes-link", roles: ["Admin", "Teacher"] },
    { to: "/analytics", label: t("analytics"), icon: BarChart3, testId: "nav-analytics-link", roles: ["Admin", "Teacher"] },
    { to: "/remedial-plans", label: t("remedial_plans"), icon: ClipboardList, testId: "nav-remedial-link", roles: ["Admin", "Teacher"] },
    { to: "/rewards", label: t("rewards"), icon: Trophy, testId: "nav-rewards-link", roles: ["Admin", "Teacher"] },
    { to: "/reports", label: t("reports"), icon: FileText, testId: "nav-reports-link", roles: ["Admin", "Teacher"] },
    { to: "/notifications", label: t("notifications"), icon: Bell, testId: "nav-notifications-link", roles: ["Admin"] },
    { to: "/calendar", label: t("calendar"), icon: CalendarDays, testId: "nav-calendar-link", roles: ["Admin"] },
    { to: "/settings", label: t("settings"), icon: Settings, testId: "nav-settings-link", roles: ["Admin"] },
    { to: "/settings", label: t("profile"), icon: UserRound, testId: "nav-profile-link", roles: ["Teacher"] },
  ];
  const navItems = allNavItems.filter(
    (item) => item.roles.includes(profile?.role_name || "Admin")
  );

  return (
    <div className="min-h-screen w-full bg-background text-foreground flex flex-row" dir="ltr" data-testid="app-shell">
      <aside
        className={`w-64 shrink-0 bg-slate-900 text-slate-100 flex flex-col justify-between ${
          isRTL ? "order-2" : "order-1"
        }`}
        data-testid="sidebar"
        dir={isRTL ? "rtl" : undefined}
      >
        <div>
          <div className="px-6 py-6 border-b border-slate-800">
            <div className="flex items-center gap-3" data-testid="brand-block">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 text-primary"
                data-testid="brand-icon"
              >
                ET
              </div>
              <div>
                <p
                  className="text-sm font-semibold text-white"
                  data-testid="brand-name"
                >
                  {t("app_name")}
                </p>
                <p
                  className="text-xs text-slate-400"
                  data-testid="brand-subtitle"
                >
                  {t("app_subtitle")}
                </p>
              </div>
            </div>
          </div>
          <nav className="px-4 py-6 space-y-2" data-testid="sidebar-nav">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isExpandableGroup = item.children;
              const isChildActive =
                item.children?.some((child) => child.to === location.pathname);

              if (isExpandableGroup) {
                const isOpen = expandedNavKey === item.testId;
                return (
                  <div key={item.testId || item.label} className="space-y-1">
                    <button
                      type="button"
                      data-testid={item.testId}
                      onClick={() => setExpandedNavKey((k) => (k === item.testId ? null : item.testId))}
                      className={`pointer-events-auto flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                        isChildActive
                          ? "bg-slate-800 text-white"
                          : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1 text-start">{item.label}</span>
                      {isOpen ? (
                        <ChevronDown className="h-4 w-4 shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0" />
                      )}
                    </button>
                    {isOpen && (
                      <div className="ms-4 space-y-1 border-s border-slate-700 ps-3" data-testid="quarter-marks-submenu">
                        {item.children.map((child) => (
                          <NavLink
                            key={child.to}
                            to={child.to}
                            data-testid={child.testId}
                            className={({ isActive }) =>
                              `flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                                isActive ? "bg-slate-800 text-white" : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
                              }`
                            }
                          >
                            {child.label}
                          </NavLink>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  data-testid={item.testId}
                  className={({ isActive }) =>
                    `pointer-events-auto flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-slate-800 text-white"
                        : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
                    }`
                  }
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>
        <div className="px-4 pb-6" data-testid="sidebar-footer">
          <div className="rounded-xl bg-slate-800/60 px-4 py-4">
            <p
              className="text-xs uppercase tracking-[0.2em] text-slate-400"
              data-testid="sidebar-login-label"
            >
              Logged in as
            </p>
            <p
              className="text-sm font-semibold text-white"
              data-testid="sidebar-login-name"
            >
              {profile?.name || "Administrator"}
            </p>
            <p
              className="text-xs text-slate-400" data-testid="sidebar-login-role">
              {profile?.role_name || "Admin"}
            </p>
          </div>
        </div>
      </aside>
      <div
        className={`flex min-h-screen flex-1 flex-col ${isRTL ? "order-1" : "order-2"}`}
        data-testid="main-panel"
        dir={isRTL ? "rtl" : undefined}
      >
        <header
          className="flex flex-col gap-4 border-b border-border/50 px-6 py-4 backdrop-blur"
          style={{ background: "hsl(var(--section-header))" }}
          data-testid="top-header"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4" data-testid="school-header">
              <div className="flex items-center justify-center rounded-lg bg-white p-2">
                <img
                  src={`${process.env.PUBLIC_URL || ""}/logo.png`}
                  alt="School Logo"
                  className="h-12 w-auto"
                  data-testid="school-logo"
                />
              </div>
              <div>
                <p
                  className="text-sm font-semibold text-foreground"
                  data-testid="school-name-ar"
                >
                  مدارس الأنجال الأهلية
                </p>
                <p
                  className="text-lg font-bold text-primary"
                  data-testid="school-name-en"
                >
                  ALANJAL NATIONAL SCHOOL
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3" data-testid="header-actions">
              <div className="flex items-center gap-2" data-testid="language-toggle">
                <Button
                  variant={language === "en" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setLanguage("en")}
                  data-testid="language-toggle-en"
                >
                  EN
                </Button>
                <Button
                  variant={language === "ar" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setLanguage("ar")}
                  data-testid="language-toggle-ar"
                >
                  AR
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                data-testid="theme-toggle-button"
              >
                {theme === "dark" ? t("theme_light") : t("theme_dark")}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    data-testid="notifications-button"
                  >
                    <Bell className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72" data-testid="notifications-dropdown">
                  {notifications.length ? (
                    notifications.map((item) => (
                      <DropdownMenuItem key={item.id} data-testid={`notification-item-${item.id}`}>
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-medium line-clamp-2">{item.message}</span>
                          <span className="text-xs text-muted-foreground">{item.created_at}</span>
                        </div>
                      </DropdownMenuItem>
                    ))
                  ) : (
                    <DropdownMenuItem data-testid="notification-empty">
                      {t("no_data")}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild data-testid="notification-view-all">
                    <Link to="/notifications">{t("notifications")}</Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="ghost"
                onClick={handleLogout}
                data-testid="logout-button"
              >
                <LogOut className="mr-2 h-4 w-4" />
                {t("logout")}
              </Button>
              <button
                type="button"
                className="flex items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-muted"
                data-testid="user-profile"
                onClick={() => navigate("/settings?section=profile")}
              >
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground overflow-hidden"
                  data-testid="user-avatar"
                >
                  {profile?.avatar_base64 ? (
                    <img
                      src={profile.avatar_base64}
                      alt="Avatar"
                      className="h-full w-full object-cover"
                      data-testid="user-avatar-image"
                    />
                  ) : (
                    <span data-testid="user-avatar-placeholder">
                      {(profile?.name || "A").charAt(0)}
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold" data-testid="user-name">
                    {profile?.name || "Administrator"}
                  </p>
                  <p className="text-xs text-muted-foreground" data-testid="user-role">
                    {profile?.role_name || "Admin"}
                  </p>
                </div>
              </button>
            </div>
          </div>
        </header>
        {/* Academic context bar: semester reminder on every page */}
        <div
          className="flex flex-wrap items-center justify-center gap-4 border-b border-border/50 px-6 py-3"
          style={{ background: "hsl(var(--section-context))" }}
          data-testid="academic-context-bar"
        >
          <div
            className="rounded-full border border-border/80 bg-muted px-4 py-2 text-sm font-medium text-foreground shadow-sm"
            data-testid="academic-year-display"
          >
            {t("academic_year")}: {academicYear}
          </div>
          <Select value={semester} onValueChange={setSemester}>
            <SelectTrigger
              className="w-[180px] rounded-full border border-border/80 bg-muted px-4 py-2 text-sm font-medium shadow-sm data-[state=open]:bg-muted"
              data-testid="semester-select"
            >
              <SelectValue placeholder={t("semesters")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="semester1" data-testid="semester-one-option">
                {t("semester_one")}
              </SelectItem>
              <SelectItem value="semester2" data-testid="semester-two-option">
                {t("semester_two")}
              </SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full border-border/80 bg-background px-4 py-2 text-sm font-medium shadow-sm hover:bg-muted/80"
            onClick={() => window.dispatchEvent(new CustomEvent("app-refresh-data"))}
            data-testid="academic-context-refresh"
          >
            {t("refresh_data")}
          </Button>
        </div>
        <main className="page-content-bg flex-1 px-6 py-8" data-testid="main-content">
          <Outlet
            context={{
              language,
              setLanguage,
              theme,
              setTheme,
              semester,
              setSemester,
              academicYear,
              profile,
              classes,
              classesLoaded,
              loadClasses: loadClasses || (() => {}),
            }}
          />
        </main>
        <Dialog open={logoutConfirmOpen} onOpenChange={setLogoutConfirmOpen}>
          <DialogContent data-testid="logout-dialog">
            <DialogHeader>
              <DialogTitle>{t("logout")}</DialogTitle>
              <DialogDescription>{t("confirm_logout")}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setLogoutConfirmOpen(false)} data-testid="logout-cancel">
                {t("cancel")}
              </Button>
              <Button variant="destructive" onClick={confirmLogout} data-testid="logout-confirm">
                {t("logout")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};
