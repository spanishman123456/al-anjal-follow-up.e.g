import { Outlet, useNavigate, Link, useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import {
  LogOut,
  Bell,
  MessageCircle,
} from "lucide-react";
import { TopNavigation } from "@/components/layout/TopNavigation";
import { buildNavigationGroups } from "@/lib/navigationConfig";
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
import {
  applySemesterQuarterSelectValue,
  semesterQuarterSelectValue,
} from "@/lib/academicScope";
import {
  loadAnalyticsPage,
  loadAssessmentMarksPage,
  loadAssessmentMarksQ2Page,
  loadCalendarPage,
  loadClassesPage,
  loadFinalExamsAssessmentPage,
  loadFinalExamsAssessmentQ2Page,
  loadLessonPlanGeneratorPage,
  loadNotificationsPage,
  loadRemedialPlansPage,
  loadReportsPage,
  loadRewardsPage,
  loadSettingsPage,
  loadStudentsPage,
  loadTeachersPage,
  loadTotalMarksPage,
} from "@/lib/routePreloaders";

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
  const prefetchedRoutesRef = useRef(new Set());

  const routePreloaders = {
    "/students": loadStudentsPage,
    "/assessment-marks": loadAssessmentMarksPage,
    "/assessment-marks-q2": loadAssessmentMarksQ2Page,
    "/final-exams-assessment": loadFinalExamsAssessmentPage,
    "/final-exams-assessment-q2": loadFinalExamsAssessmentQ2Page,
    "/total-marks": loadTotalMarksPage,
    "/teachers": loadTeachersPage,
    "/lesson-plan-generator": loadLessonPlanGeneratorPage,
    "/classes": loadClassesPage,
    "/analytics": loadAnalyticsPage,
    "/remedial-plans": loadRemedialPlansPage,
    "/rewards": loadRewardsPage,
    "/reports": loadReportsPage,
    "/notifications": loadNotificationsPage,
    "/calendar": loadCalendarPage,
    "/settings": loadSettingsPage,
  };

  const prefetchRoute = (path) => {
    const normalizedPath = (path || "").split("?")[0];
    if (!normalizedPath || prefetchedRoutesRef.current.has(normalizedPath)) return;
    const loader = routePreloaders[normalizedPath];
    if (!loader) return;
    prefetchedRoutesRef.current.add(normalizedPath);
    loader().catch(() => {
      prefetchedRoutesRef.current.delete(normalizedPath);
    });
  };

  // Keep URL in sync with header semester/quarter when on quarter-specific pages
  useEffect(() => {
    const path = location.pathname;
    if (quarter === 2 && path === "/assessment-marks") navigate("/assessment-marks-q2", { replace: true });
    else if (quarter === 2 && path === "/final-exams-assessment") navigate("/final-exams-assessment-q2", { replace: true });
    else if (quarter === 1 && path === "/assessment-marks-q2") navigate("/assessment-marks", { replace: true });
    else if (quarter === 1 && path === "/final-exams-assessment-q2") navigate("/final-exams-assessment", { replace: true });
  }, [quarter, location.pathname, navigate]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [location.pathname, location.search]);

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
  const navGroups = buildNavigationGroups({
    t,
    quarter,
    roleName: profile?.role_name || "Admin",
  });

  const chromeControlsClass =
    "border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white";

  return (
    <div
      className="flex min-h-screen w-full flex-col bg-page text-foreground"
      dir={isRTL ? "rtl" : "ltr"}
      data-testid="app-shell"
    >
      <div className="app-chrome main-hero-sky shrink-0" data-testid="app-chrome">
        <header
          className="relative z-10 flex flex-col gap-4 border-0 bg-transparent px-4 py-4 backdrop-blur-sm sm:px-6"
          data-testid="top-header"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4" data-testid="school-header">
              <div className="flex shrink-0 items-center justify-center p-0">
                <img
                  src="/logo-al-anjal.png"
                  alt="School Logo"
                  className="h-14 w-auto max-h-[3.5rem] object-contain [filter:none]"
                  data-testid="school-logo"
                />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white" data-testid="school-name-ar">
                  مدارس الأنجال الأهلية
                </p>
                <p className="truncate text-lg font-bold text-[#7ED7F7]" data-testid="school-name-en">
                  ALANJAL NATIONAL SCHOOL
                </p>
                <p className="hidden text-xs text-[#A8B0C3] sm:block" data-testid="brand-subtitle">
                  {t("app_subtitle")}
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
                  className={cn(language !== "en" && chromeControlsClass)}
                >
                  EN
                </Button>
                <Button
                  variant={language === "ar" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setLanguage("ar")}
                  data-testid="language-toggle-ar"
                  className={cn(language !== "ar" && chromeControlsClass)}
                >
                  AR
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                data-testid="theme-toggle-button"
                className={chromeControlsClass}
              >
                {theme === "dark" ? t("theme_light") : t("theme_dark")}
              </Button>
              <DropdownMenu onOpenChange={setNotificationsOpen}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    data-testid="notifications-button"
                    className="text-white hover:bg-white/15 hover:text-white"
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
                className="text-white hover:bg-white/15 hover:text-white"
              >
                <LogOut className={cn("h-4 w-4", isRTL ? "ms-2" : "me-2")} />
                {t("logout")}
              </Button>
              <button
                type="button"
                className="flex items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-white/10"
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
                <div className="hidden text-start sm:block">
                  <p className="text-sm font-semibold text-white" data-testid="user-name">
                    {profile?.name || "Administrator"}
                  </p>
                  <p className="text-xs text-[#A8B0C3]" data-testid="user-role">
                    {profile?.role_name || "Admin"}
                  </p>
                </div>
              </button>
            </div>
          </div>
        </header>

        <TopNavigation groups={navGroups} isRTL={isRTL} t={t} prefetchRoute={prefetchRoute} />

        <div
          className="relative z-10 flex flex-wrap items-center justify-center gap-3 border-t border-white/10 px-4 py-3 sm:gap-4 sm:px-6"
          data-testid="academic-context-bar"
        >
          <div
            className="rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm font-medium text-white shadow-sm backdrop-blur-sm"
            data-testid="academic-year-display"
          >
            <span className="text-[#7ED7F7]">{t("academic_year")}:</span> {academicYear}
          </div>
          <Select
            value={semesterQuarterSelectValue(semester, quarter)}
            onValueChange={(value) =>
              applySemesterQuarterSelectValue(value, setSemester, setQuarter)
            }
            data-testid="semester-quarter-select"
          >
            <SelectTrigger
              className="w-[min(100%,240px)] rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm font-medium text-white shadow-sm backdrop-blur-sm data-[state=open]:bg-white/15 [&_svg]:opacity-80 sm:w-[240px]"
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
            className={cn("rounded-full px-4 py-2 text-sm font-medium shadow-sm", chromeControlsClass)}
            onClick={() => window.dispatchEvent(new CustomEvent("app-refresh-data"))}
            data-testid="academic-context-refresh"
          >
            {t("refresh_data")}
          </Button>
        </div>
      </div>
        <main
          className="page-content-bg flex-1 px-4 py-6 sm:px-6 sm:py-8"
          data-testid="main-content"
        >
          <div key={`${location.pathname}${location.search}`} className="page-enter">
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
          </div>
        </main>

        <footer
          className="app-site-footer shrink-0 px-4 py-6 sm:px-6"
          data-testid="site-footer"
        >
          <div className="mx-auto flex max-w-[1600px] flex-col items-center gap-4 sm:flex-row sm:justify-between">
            <a
              href="#contact"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#8B2BEC] to-[#E91E8F] px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:brightness-110"
              data-testid="footer-contact-us"
            >
              <MessageCircle className="h-4 w-4 shrink-0" />
              {t("contact_us")}
            </a>
            <div data-testid="footer-social">
              <SocialLinks layout="row" className="flex-wrap justify-center" />
            </div>
            <p className="text-center text-xs text-muted-foreground" data-testid="footer-copyright">
              {t("sidebar_copyright")}
            </p>
          </div>
        </footer>

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
  );
};
