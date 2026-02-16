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
  MessageCircle,
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
import { SocialLinks } from "@/components/SocialLinks";

export const AppShell = ({
  language,
  setLanguage,
  theme,
  setTheme,
  semester,
  setSemester,
  quarter,
  setQuarter,
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

  // Keep URL in sync with header semester/quarter when on quarter-specific pages
  useEffect(() => {
    const path = location.pathname;
    if (quarter === 2 && path === "/assessment-marks") navigate("/assessment-marks-q2", { replace: true });
    else if (quarter === 2 && path === "/final-exams-assessment") navigate("/final-exams-assessment-q2", { replace: true });
    else if (quarter === 1 && path === "/assessment-marks-q2") navigate("/assessment-marks", { replace: true });
    else if (quarter === 1 && path === "/final-exams-assessment-q2") navigate("/final-exams-assessment", { replace: true });
  }, [quarter, location.pathname, navigate]);

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
    sessionStorage.removeItem("auth_token");
    window.location.href = "/login";
  };
  const allNavItems = [
    { to: "/", label: t("dashboard"), icon: LayoutDashboard, testId: "nav-dashboard-link", roles: ["Admin", "Teacher"] },
    { to: "/students", label: t("assessment"), icon: FileText, testId: "nav-students", roles: ["Admin", "Teacher"] },
    {
      to: quarter === 2 ? "/assessment-marks-q2" : "/assessment-marks",
      label: t("nav_quizzes_chapter_test"),
      icon: FileText,
      testId: "nav-assessment-marks",
      roles: ["Admin", "Teacher"],
    },
    {
      to: quarter === 2 ? "/final-exams-assessment-q2" : "/final-exams-assessment",
      label: t("nav_final_exams"),
      icon: FileText,
      testId: "nav-final-exams",
      roles: ["Admin", "Teacher"],
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
        className={`w-64 shrink-0 text-white flex flex-col justify-between bg-gradient-to-b from-[hsl(166,76%,28%)] via-[hsl(166,76%,24%)] to-[hsl(172,66%,22%)] shadow-xl ${
          isRTL ? "order-2" : "order-1"
        }`}
        data-testid="sidebar"
        dir={isRTL ? "rtl" : undefined}
      >
        <div>
          <div className="px-6 py-6 border-b border-white/15">
            <div className="flex items-center animate-fade-in" data-testid="brand-block">
              <div>
                <p
                  className="text-sm font-semibold text-white"
                  data-testid="brand-name"
                >
                  {t("app_name")}
                </p>
                <p
                  className="text-xs text-white/70"
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
                      className={                  `pointer-events-auto flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium nav-item-pop ${
                        isChildActive
                          ? "bg-white/20 text-white"
                          : "text-white/85 hover:bg-white/15 hover:text-white"
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
                              `flex items-center gap-2 rounded-md px-2 py-1.5 text-sm nav-item-pop ${
                                isActive ? "bg-white/20 text-white" : "text-white/75 hover:bg-white/15 hover:text-white"
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
                    `pointer-events-auto flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium nav-item-pop ${
                      isActive
                        ? "bg-white/20 text-white"
                        : "text-white/85 hover:bg-white/15 hover:text-white"
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
        <div className="px-4 pb-6 space-y-4" data-testid="sidebar-footer">
          <div className="rounded-xl bg-white/10 px-4 py-4 backdrop-blur-sm border border-white/15 shadow-lg">
            <p
              className="text-xs uppercase tracking-[0.2em] text-white/70"
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
              className="text-xs text-white/70" data-testid="sidebar-login-role">
              {profile?.role_name || "Admin"}
            </p>
          </div>
          <a
            href="#contact"
            className="flex items-center justify-center gap-2 w-full rounded-xl bg-primary text-white py-2.5 px-4 font-medium text-sm hover:bg-primary/90 transition-all duration-200 hover:translate-y-[-2px] hover:scale-[1.02] hover:shadow-md active:translate-y-0 active:scale-[0.98] shadow-lg"
            data-testid="sidebar-contact-us"
          >
            <span className="relative flex items-center">
              <MessageCircle className="h-4 w-4 shrink-0" />
              <MessageCircle className="h-4 w-4 shrink-0 -ml-2.5 opacity-90" aria-hidden />
            </span>
            <span>{t("contact_us")}</span>
          </a>
          <div data-testid="sidebar-social">
            <SocialLinks layout="row" className="flex-wrap" />
          </div>
          <p className="text-xs text-white/60 text-center" data-testid="sidebar-copyright">
            {t("sidebar_copyright")}
          </p>
        </div>
      </aside>
      <div
        className={`flex min-h-screen flex-1 flex-col ${isRTL ? "order-1" : "order-2"}`}
        data-testid="main-panel"
        dir={isRTL ? "rtl" : undefined}
      >
        <header
          className="flex flex-col gap-4 border-b border-border/50 px-6 py-4 backdrop-blur-md glass-panel"
          style={{ background: "hsl(var(--section-header) / 0.92)" }}
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
          <Select
            value={`${semester}-${quarter}`}
            onValueChange={(value) => {
              const [s, q] = value.split("-");
              if (s) setSemester(s === "semester2" ? "semester2" : "semester1");
              if (q) setQuarter(parseInt(q, 10) === 2 ? 2 : 1);
            }}
            data-testid="semester-quarter-select"
          >
            <SelectTrigger
              className="w-[220px] rounded-full border border-border/80 bg-muted px-4 py-2 text-sm font-medium shadow-sm data-[state=open]:bg-muted"
              data-testid="semester-quarter-trigger"
            >
              <SelectValue placeholder={t("select_semester_quarter")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="semester1-1" data-testid="option-s1-q1">
                {t("semester_one_quarter_one")}
              </SelectItem>
              <SelectItem value="semester1-2" data-testid="option-s1-q2">
                {t("semester_one_quarter_two")}
              </SelectItem>
              <SelectItem value="semester2-1" data-testid="option-s2-q1">
                {t("semester_two_quarter_one")}
              </SelectItem>
              <SelectItem value="semester2-2" data-testid="option-s2-q2">
                {t("semester_two_quarter_two")}
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
        <main
          className="page-content-bg flex-1 px-6 py-8 page-enter"
          data-testid="main-content"
          style={theme === "dark" ? undefined : { background: "#f1f1f2" }}
        >
          <Outlet
            context={{
              language,
              setLanguage,
              theme,
              setTheme,
              semester,
              setSemester,
              quarter,
              setQuarter,
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
