import { NavLink, Outlet, useNavigate, Link, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
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
  Menu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { clearStoredAuthToken } from "@/lib/api";
import { useTranslations } from "@/lib/i18n";
import { api, BACKEND_ROOT_URL, isProductionBackendUrl, warmBackendInBackground } from "@/lib/api";
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
import { cn } from "@/lib/utils";

/** Rotating gradient fills (reference: colorful path / CTA buttons) */
const SIDEBAR_NAV_GRADIENTS = [
  "from-violet-600 to-indigo-600",
  "from-fuchsia-500 to-pink-600",
  "from-sky-500 to-cyan-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-red-500",
  "from-blue-600 to-violet-600",
  "from-purple-500 to-fuchsia-600",
  "from-teal-500 to-green-600",
  "from-orange-500 to-rose-500",
  "from-indigo-500 to-blue-600",
  "from-pink-500 to-orange-400",
];

function sidebarNavButtonClass(isActive, index, collapsed = false) {
  const g = SIDEBAR_NAV_GRADIENTS[index % SIDEBAR_NAV_GRADIENTS.length];
  return cn(
    "pointer-events-auto flex w-full items-center rounded-xl text-sm font-semibold text-white shadow-md nav-item-pop bg-gradient-to-r hover:brightness-110 hover:shadow-lg transition-all duration-200",
    collapsed ? "justify-center px-2 py-3" : "gap-3 px-3 py-2.5",
    g,
    isActive &&
      "ring-2 ring-white ring-offset-2 ring-offset-zinc-100 dark:ring-offset-slate-950 brightness-110 scale-[1.02]",
  );
}

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
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsLoaded, setNotificationsLoaded] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [expandedNavKey, setExpandedNavKey] = useState(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem("app_sidebar_collapsed") === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("app_sidebar_collapsed", String(isSidebarCollapsed));
    } catch {
      // ignore storage errors
    }
  }, [isSidebarCollapsed]);

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
      setNotificationsLoaded(true);
    } catch (error) {
      setNotifications([]);
      setNotificationsLoaded(false);
    }
  };

  useEffect(() => {
    if (notificationsOpen && !notificationsLoaded) {
      loadNotifications();
    }
  }, [notificationsOpen, notificationsLoaded]);

  // Keep backend warm on hosted/free tiers: interval ping + quick wake on tab focus/visibility.
  useEffect(() => {
    if (!isProductionBackendUrl || !BACKEND_ROOT_URL) return;
    const INTERVAL_MS = 8 * 60 * 1000; // Stay below common 15m idle sleep thresholds.
    const MIN_GAP_MS = 60 * 1000; // Throttle burst events (focus/visibility/online).
    let lastPingAt = 0;

    const ping = (force = false) => {
      if (!navigator.onLine) return;
      const now = Date.now();
      if (!force && now - lastPingAt < MIN_GAP_MS) return;
      lastPingAt = now;
      warmBackendInBackground();
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") ping();
    };
    const onFocus = () => ping();
    const onOnline = () => ping(true);

    ping(true);
    const id = setInterval(() => ping(true), INTERVAL_MS);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  const handleLogout = () => {
    setLogoutConfirmOpen(true);
  };

  const confirmLogout = () => {
    clearStoredAuthToken();
    setLogoutConfirmOpen(false);
    window.dispatchEvent(new CustomEvent("auth-logout"));
    navigate("/", { replace: true });
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
    {
      to: "/total-marks",
      label: t("nav_total_marks"),
      icon: FileText,
      testId: "nav-total-marks",
      roles: ["Admin", "Teacher"],
    },
    { to: "/teachers", label: t("teachers"), icon: UserRound, testId: "nav-teachers-link", roles: ["Admin"] },
    {
      to: "/lesson-plan-generator",
      label: t("lesson_plan_generator"),
      icon: FileText,
      testId: "nav-lesson-plan-generator-link",
      roles: ["Admin", "Teacher"],
    },
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

  const heroSky = theme === "light";
  const sidebarExpanded = !isSidebarCollapsed;

  return (
    <div className="min-h-screen w-full bg-background text-foreground flex flex-row" dir="ltr" data-testid="app-shell">
      <aside
        className={cn(
          "relative shrink-0 overflow-hidden border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar-background))] text-[hsl(var(--sidebar-foreground))] shadow-sm transition-[width] duration-300 ease-out",
          sidebarExpanded ? "w-72" : "w-20",
          isRTL ? "order-2 border-s" : "order-1 border-e",
        )}
        data-testid="sidebar"
        dir={isRTL ? "rtl" : undefined}
      >
        <div className="flex min-h-screen flex-col">
          <div
            className={cn(
              "border-b border-[hsl(var(--sidebar-border))]",
              sidebarExpanded ? "px-5 py-5" : "px-3 py-5",
            )}
          >
            <div
              className={cn(
                "flex items-center",
                sidebarExpanded ? "justify-between gap-3" : "justify-center",
              )}
            >
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setIsSidebarCollapsed((prev) => !prev)}
                className="rounded-xl border border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-foreground))] shadow-sm hover:bg-[hsl(var(--sidebar-accent))]"
                aria-label={sidebarExpanded ? "Collapse navigation menu" : "Expand navigation menu"}
                data-testid="sidebar-toggle-button"
              >
                <Menu className="h-5 w-5" />
              </Button>
              {sidebarExpanded && (
                <div className="min-w-0 flex-1 animate-fade-in" data-testid="brand-block">
                  <p
                    className="truncate text-sm font-semibold text-[hsl(var(--sidebar-foreground))]"
                    data-testid="brand-name"
                  >
                    {t("app_name")}
                  </p>
                  <p
                    className="truncate text-xs text-muted-foreground"
                    data-testid="brand-subtitle"
                  >
                    {t("app_subtitle")}
                  </p>
                </div>
              )}
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col justify-between">
            <div className="min-h-0 overflow-y-auto">
              <nav
                className={cn("space-y-2.5 py-5", sidebarExpanded ? "px-3" : "px-2")}
                data-testid="sidebar-nav"
              >
                {navItems.map((item, navIndex) => {
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
                          title={item.label}
                          aria-label={item.label}
                          onClick={() => {
                            if (!sidebarExpanded) {
                              setIsSidebarCollapsed(false);
                              setExpandedNavKey(item.testId);
                              return;
                            }
                            setExpandedNavKey((k) => (k === item.testId ? null : item.testId));
                          }}
                          className={sidebarNavButtonClass(isChildActive, navIndex, !sidebarExpanded)}
                        >
                          <Icon className="h-4 w-4 shrink-0 opacity-95" />
                          {sidebarExpanded && <span className="flex-1 text-start">{item.label}</span>}
                          {sidebarExpanded && (
                            isOpen ? (
                              <ChevronDown className="h-4 w-4 shrink-0 opacity-90" />
                            ) : (
                              <ChevronRight className="h-4 w-4 shrink-0 opacity-90" />
                            )
                          )}
                        </button>
                        {sidebarExpanded && isOpen && (
                          <div className="ms-3 space-y-1.5 border-s border-white/20 ps-3 dark:border-white/10" data-testid="quarter-marks-submenu">
                            {item.children.map((child, ci) => (
                              <NavLink
                                key={child.to}
                                to={child.to}
                                data-testid={child.testId}
                                className={({ isActive }) =>
                                  cn(
                                    "flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold text-white shadow nav-item-pop bg-gradient-to-r",
                                    SIDEBAR_NAV_GRADIENTS[(navIndex + ci + 1) % SIDEBAR_NAV_GRADIENTS.length],
                                    "hover:brightness-110",
                                    isActive && "ring-2 ring-white/90 ring-offset-1 ring-offset-zinc-100 dark:ring-offset-slate-950",
                                  )
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
                      key={item.testId || `${item.to}-${item.label}`}
                      to={item.to}
                      data-testid={item.testId}
                      title={item.label}
                      aria-label={item.label}
                      className={({ isActive }) => sidebarNavButtonClass(isActive, navIndex, !sidebarExpanded)}
                    >
                      <Icon className="h-4 w-4 shrink-0 opacity-95" />
                      {sidebarExpanded && <span className="truncate">{item.label}</span>}
                    </NavLink>
                  );
                })}
              </nav>
            </div>
            <div
              className={cn("pb-6", sidebarExpanded ? "space-y-4 px-4" : "px-2")}
              data-testid="sidebar-footer"
            >
              {sidebarExpanded ? (
                <>
                  <div className="rounded-md bg-[hsl(var(--sidebar-accent))] px-4 py-4 border border-[hsl(var(--sidebar-border))] shadow-sm">
                    <p
                      className="text-xs uppercase tracking-[0.2em] text-muted-foreground"
                      data-testid="sidebar-login-label"
                    >
                      Logged in as
                    </p>
                    <p
                      className="text-sm font-semibold text-[hsl(var(--sidebar-foreground))]"
                      data-testid="sidebar-login-name"
                    >
                      {profile?.name || "Administrator"}
                    </p>
                    <p
                      className="text-xs text-muted-foreground" data-testid="sidebar-login-role">
                      {profile?.role_name || "Admin"}
                    </p>
                  </div>
                  <a
                    href="#contact"
                    className="flex items-center justify-center gap-2 w-full rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 text-white py-2.5 px-4 font-semibold text-sm shadow-md hover:brightness-110 transition-all duration-200 hover:translate-y-[-2px] hover:scale-[1.02] active:translate-y-0 active:scale-[0.98]"
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
                  <p className="text-xs text-muted-foreground text-center" data-testid="sidebar-copyright">
                    {t("sidebar_copyright")}
                  </p>
                </>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <button
                    type="button"
                    className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-primary text-primary-foreground shadow-sm"
                    data-testid="sidebar-collapsed-profile"
                    onClick={() => navigate("/settings?section=profile")}
                    title={profile?.name || "Administrator"}
                    aria-label={profile?.name || "Administrator"}
                  >
                    {profile?.avatar_base64 ? (
                      <img
                        src={profile.avatar_base64}
                        alt="Avatar"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span>{(profile?.name || "A").charAt(0)}</span>
                    )}
                  </button>
                  <div data-testid="sidebar-social-collapsed">
                    <SocialLinks layout="column" className="items-center" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>
      <div
        className={`flex min-h-screen flex-1 flex-col ${isRTL ? "order-1" : "order-2"}`}
        data-testid="main-panel"
        dir={isRTL ? "rtl" : undefined}
      >
        <div className={cn(heroSky && "main-hero-sky")}>
        <header
          className={cn(
            "relative z-10 flex flex-col gap-4 px-6 py-4 backdrop-blur-sm",
            heroSky
              ? "border-0 bg-transparent"
              : "border-b border-border/50 glass-panel dark:border-white/10",
          )}
          style={heroSky ? undefined : { background: "hsl(var(--section-header) / 0.92)" }}
          data-testid="top-header"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4" data-testid="school-header">
              <div
                className={cn(
                    "flex items-center justify-center",
                    heroSky ? "p-0" : "rounded-xl bg-white p-2.5 shadow-sm ring-1 ring-black/5 dark:bg-transparent dark:p-0 dark:shadow-none dark:ring-0",
                )}
              >
                <img
                    src="/logo-al-anjal.png"
                  alt="School Logo"
                    className="h-14 w-auto max-h-[3.5rem] object-contain [filter:none]"
                  data-testid="school-logo"
                />
              </div>
              <div>
                <p
                  className={cn("text-sm font-semibold", heroSky ? "text-white" : "text-foreground")}
                  data-testid="school-name-ar"
                >
                  مدارس الأنجال الأهلية
                </p>
                <p
                  className={cn(
                    "text-lg font-bold",
                    heroSky ? "text-cyan-300" : "text-primary dark:text-cyan-400",
                  )}
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
                  className={cn(
                    heroSky && language !== "en" && "border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white",
                  )}
                >
                  EN
                </Button>
                <Button
                  variant={language === "ar" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setLanguage("ar")}
                  data-testid="language-toggle-ar"
                  className={cn(
                    heroSky && language !== "ar" && "border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white",
                  )}
                >
                  AR
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                data-testid="theme-toggle-button"
                className={cn(
                  heroSky && "border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white",
                )}
              >
                {theme === "dark" ? t("theme_light") : t("theme_dark")}
              </Button>
              <DropdownMenu onOpenChange={setNotificationsOpen}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    data-testid="notifications-button"
                    className={cn(heroSky && "text-white hover:bg-white/15 hover:text-white")}
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
                className={cn(heroSky && "text-white hover:bg-white/15 hover:text-white")}
              >
                <LogOut className="mr-2 h-4 w-4" />
                {t("logout")}
              </Button>
              <button
                type="button"
                className={cn(
                  "flex items-center gap-2 rounded-lg px-2 py-1 transition-colors",
                  heroSky ? "hover:bg-white/10" : "hover:bg-muted",
                )}
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
                  <p
                    className={cn("text-sm font-semibold", heroSky && "text-white")}
                    data-testid="user-name"
                  >
                    {profile?.name || "Administrator"}
                  </p>
                  <p
                    className={cn("text-xs", heroSky ? "text-slate-300" : "text-muted-foreground")}
                    data-testid="user-role"
                  >
                    {profile?.role_name || "Admin"}
                  </p>
                </div>
              </button>
            </div>
          </div>
        </header>
        {/* Academic context bar: semester reminder on every page */}
        <div
          className={cn(
            "relative z-10 flex flex-wrap items-center justify-center gap-4 px-6 py-3",
            heroSky ? "border-0 bg-transparent" : "border-b border-border/50 dark:border-white/10",
          )}
          style={heroSky ? undefined : { background: "hsl(var(--section-context))" }}
          data-testid="academic-context-bar"
        >
          <div
            className={cn(
              "rounded-full border px-4 py-2 text-sm font-medium shadow-sm",
              heroSky
                ? "border-white/25 bg-white/10 text-white backdrop-blur-sm"
                : "border-border/80 bg-muted text-foreground",
            )}
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
              className={cn(
                "w-[220px] rounded-full border px-4 py-2 text-sm font-medium shadow-sm",
                heroSky
                  ? "border-white/25 bg-white/10 text-white backdrop-blur-sm data-[state=open]:bg-white/15 [&_svg]:opacity-80"
                  : "border-border/80 bg-muted data-[state=open]:bg-muted",
              )}
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
            className={cn(
              "rounded-full border px-4 py-2 text-sm font-medium shadow-sm",
              heroSky
                ? "border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                : "border-border/80 bg-background hover:bg-muted/80",
            )}
            onClick={() => window.dispatchEvent(new CustomEvent("app-refresh-data"))}
            data-testid="academic-context-refresh"
          >
            {t("refresh_data")}
          </Button>
        </div>
        </div>
        <main
          className="page-content-bg flex-1 px-6 py-8 page-enter"
          data-testid="main-content"
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
