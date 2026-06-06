import { useCallback, useEffect, useState, lazy, Suspense, Component } from "react";
import "@/App.css";
import { HashRouter as BrowserRouter, Routes, Route } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import {
  api,
  AUTH_TOKEN_KEY,
  checkBackendLive,
  clearStoredAuthToken,
  getStoredAuthToken,
  isProductionBackendUrl,
  setStoredAuthToken,
  warmBackendInBackground,
} from "@/lib/api";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
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
  loadTeacherProfilePage,
  loadTotalMarksPage,
} from "@/lib/routePreloaders";

// Dashboard is eager-loaded so first paint after login does not flash Suspense fallback (major flicker source).
const Students = lazy(loadStudentsPage);
const AssessmentMarks = lazy(loadAssessmentMarksPage);
const FinalExamsAssessment = lazy(loadFinalExamsAssessmentPage);
const TotalMarks = lazy(loadTotalMarksPage);
const AssessmentMarksQ2 = lazy(loadAssessmentMarksQ2Page);
const FinalExamsAssessmentQ2 = lazy(loadFinalExamsAssessmentQ2Page);
const Teachers = lazy(loadTeachersPage);
const TeacherProfile = lazy(loadTeacherProfilePage);
const LessonPlanGenerator = lazy(loadLessonPlanGeneratorPage);
const Classes = lazy(loadClassesPage);
const Analytics = lazy(loadAnalyticsPage);
const RemedialPlans = lazy(loadRemedialPlansPage);
const Rewards = lazy(loadRewardsPage);
const Reports = lazy(loadReportsPage);
const Settings = lazy(loadSettingsPage);
const Calendar = lazy(loadCalendarPage);
const Notifications = lazy(loadNotificationsPage);

const PageFallback = () => (
  <div className="route-fallback-panel flex min-h-[46vh] w-full flex-col justify-center rounded-[28px] border border-border/60 bg-card/70 p-6 text-muted-foreground shadow-sm">
    <div className="route-fallback-line h-4 w-32 rounded-full bg-muted/90" />
    <div className="route-fallback-line mt-5 h-24 rounded-3xl bg-muted/80" />
    <div className="route-fallback-line mt-4 h-24 rounded-3xl bg-muted/70" />
  </div>
);

class AppErrorBoundary extends Component {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-4 text-center">
          <p className="text-muted-foreground">Something went wrong.</p>
          <button
            type="button"
            className="rounded bg-primary px-4 py-2 text-primary-foreground"
            onClick={() => window.location.reload()}
          >
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  const [language, setLanguage] = useState(() => {
    const stored = localStorage.getItem("language") || "en";
    const isAr = stored === "ar";
    if (typeof document !== "undefined") {
      document.documentElement.dir = isAr ? "rtl" : "ltr";
      document.documentElement.lang = isAr ? "ar" : "en";
    }
    return stored;
  });
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "light");
  const [token, setToken] = useState(() => getStoredAuthToken());
  const [authReady, setAuthReady] = useState(() => (getStoredAuthToken() ? null : true));
  const [logoutReason, setLogoutReason] = useState(null);
  const [semester, setSemester] = useState(
    () => localStorage.getItem("semester") || "semester1",
  );
  const [quarter, setQuarter] = useState(
    () => parseInt(localStorage.getItem("quarter") || "1", 10),
  );
  const academicYear = (() => {
    const now = new Date();
    const startYear = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
    return `${startYear}-${startYear + 1}`;
  })();

  const CLASSES_CACHE_KEY = "app_classes_cache";
  const CLASSES_CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes
  const [classes, setClasses] = useState(() => {
    try {
      const raw = sessionStorage.getItem(CLASSES_CACHE_KEY);
      if (!raw) return [];
      const { data, at } = JSON.parse(raw);
      if (Date.now() - at < CLASSES_CACHE_TTL_MS && Array.isArray(data)) return data;
    } catch { /* ignore */ }
    return [];
  });
  const [classesLoaded, setClassesLoaded] = useState(() => {
    try {
      const raw = sessionStorage.getItem(CLASSES_CACHE_KEY);
      if (!raw) return false;
      const { data, at } = JSON.parse(raw);
      return Date.now() - at < CLASSES_CACHE_TTL_MS && Array.isArray(data);
    } catch { return false; }
  });
  const loadClasses = useCallback(async () => {
    try {
      const r = await api.get("/classes");
      const list = r.data || [];
      setClasses(list);
      try {
        sessionStorage.setItem(CLASSES_CACHE_KEY, JSON.stringify({ data: list, at: Date.now() }));
      } catch { /* ignore */ }
    } catch {
      setClasses([]);
    } finally {
      setClassesLoaded(true);
    }
  }, []);
  useEffect(() => {
    setClasses([]);
    setClassesLoaded(false);
    try {
      sessionStorage.removeItem(CLASSES_CACHE_KEY);
    } catch { /* ignore */ }
  }, [token]);
  const waitForBackendReady = useCallback(async ({ timeoutMs = 120000, intervalMs = 1500 } = {}) => {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const ok = await checkBackendLive();
      if (ok) return true;
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
    return false;
  }, []);
  useEffect(() => {
    const storedToken = getStoredAuthToken();
    if (storedToken) {
      // Migrate existing single-tab sessions so copied URLs open authenticated in new tabs.
      setStoredAuthToken(storedToken);
    }
  }, []);
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const failSession = () => {
      if (cancelled) return;
      clearStoredAuthToken();
      setToken(null);
      setAuthReady(true);
    };
    const loadProfile = async () => {
      if (isProductionBackendUrl) {
        warmBackendInBackground();
      }
      try {
        await api.get("/users/profile", { timeout: isProductionBackendUrl ? 30000 : 10000 });
        if (!cancelled) setAuthReady(true);
      } catch (err) {
        if (cancelled) return;
        if (err?.response?.status === 401) {
          failSession();
          return;
        }
        const isNetwork = !err?.response || err?.code === "ECONNABORTED" || err?.message === "Network Error";
        if (isNetwork && isProductionBackendUrl) {
          const isReady = await waitForBackendReady();
          if (cancelled) return;
          if (isReady) {
            try {
              await api.get("/users/profile", { timeout: 30000 });
              if (!cancelled) setAuthReady(true);
              return;
            } catch (retryErr) {
              if (cancelled) return;
              if (retryErr?.response?.status === 401) {
                failSession();
                return;
              }
            }
          }
        }
        // Never enter the app with an unvalidated token — avoids login ↔ dashboard flicker.
        failSession();
      }
    };
    loadProfile();
    return () => { cancelled = true; };
  }, [token, waitForBackendReady]);

  useEffect(() => {
    const handler = (event) => {
      const reason = event?.detail?.reason || "unauthorized";
      setLogoutReason(reason);
      setToken(null);
      setAuthReady(true);
      if (reason === "session_replaced") {
        toast.error(
          language === "ar"
            ? "تم تسجيل خروجك لأن هذا الحساب تم استخدامه لتسجيل الدخول من مكان آخر."
            : "You were signed out because this account was used to log in somewhere else."
        );
      }
    };
    window.addEventListener("auth-logout", handler);
    return () => window.removeEventListener("auth-logout", handler);
  }, [language]);
  useEffect(() => {
    const onStorage = (event) => {
      if (event.key !== AUTH_TOKEN_KEY) return;
      const nextToken = event.newValue || null;
      setToken(nextToken);
      setAuthReady(nextToken ? null : true);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    // Avoid refetching classes immediately if we already have a fresh session cache.
    if (token && authReady && !classesLoaded) loadClasses();
  }, [token, authReady, classesLoaded, loadClasses]);

  useEffect(() => {
    const isArabic = language === "ar";
    document.documentElement.dir = isArabic ? "rtl" : "ltr";
    document.documentElement.lang = isArabic ? "ar" : "en";
    document.body.classList.toggle("font-ar", isArabic);
    localStorage.setItem("language", language);
  }, [language]);

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("semester", semester);
  }, [semester]);
  useEffect(() => {
    localStorage.setItem("quarter", String(quarter));
  }, [quarter]);

  const handleLogin = useCallback((newToken) => {
    setLogoutReason(null);
    setStoredAuthToken(newToken);
    setToken(newToken);
    // Login API already authenticated the user — skip a second "Checking session…" gate.
    setAuthReady(true);
  }, []);

  // Single BrowserRouter for the whole app — avoids tearing down/remounting the router on login.
  const isAuthenticated = Boolean(token && authReady);
  const sessionChecking = Boolean(token && authReady === null);
  const showLogin = !sessionChecking && !isAuthenticated;

  const authenticatedRoutes = (
    <Routes>
      <Route
        path="/"
        element={
          <AppShell
            key={language}
            language={language}
            setLanguage={setLanguage}
            theme={theme}
            setTheme={setTheme}
            semester={semester}
            setSemester={setSemester}
            quarter={quarter}
            setQuarter={setQuarter}
            academicYear={academicYear}
            classes={classes}
            classesLoaded={classesLoaded}
            loadClasses={loadClasses}
          />
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="students" element={<Suspense fallback={<PageFallback />}><Students /></Suspense>} />
        <Route path="assessment-marks" element={<Suspense fallback={<PageFallback />}><AssessmentMarks /></Suspense>} />
        <Route path="final-exams-assessment" element={<Suspense fallback={<PageFallback />}><FinalExamsAssessment /></Suspense>} />
        <Route path="total-marks" element={<Suspense fallback={<PageFallback />}><TotalMarks /></Suspense>} />
        <Route path="assessment-marks-q2" element={<Suspense fallback={<PageFallback />}><AssessmentMarksQ2 /></Suspense>} />
        <Route path="final-exams-assessment-q2" element={<Suspense fallback={<PageFallback />}><FinalExamsAssessmentQ2 /></Suspense>} />
        <Route path="teachers" element={<Suspense fallback={<PageFallback />}><Teachers /></Suspense>} />
        <Route path="teachers/:teacherId" element={<Suspense fallback={<PageFallback />}><TeacherProfile /></Suspense>} />
        <Route path="lesson-plan-generator" element={<Suspense fallback={<PageFallback />}><LessonPlanGenerator /></Suspense>} />
        <Route path="classes" element={<Suspense fallback={<PageFallback />}><Classes /></Suspense>} />
        <Route path="analytics" element={<Suspense fallback={<PageFallback />}><Analytics /></Suspense>} />
        <Route path="remedial-plans" element={<Suspense fallback={<PageFallback />}><RemedialPlans /></Suspense>} />
        <Route path="rewards" element={<Suspense fallback={<PageFallback />}><Rewards /></Suspense>} />
        <Route path="reports" element={<Suspense fallback={<PageFallback />}><Reports /></Suspense>} />
        <Route path="notifications" element={<Suspense fallback={<PageFallback />}><Notifications /></Suspense>} />
        <Route path="calendar" element={<Suspense fallback={<PageFallback />}><Calendar /></Suspense>} />
        <Route path="settings" element={<Suspense fallback={<PageFallback />}><Settings /></Suspense>} />
      </Route>
    </Routes>
  );

  return (
    <AppErrorBoundary>
      <div className="App">
        <BrowserRouter>
          {isAuthenticated ? (
            authenticatedRoutes
          ) : sessionChecking ? (
            <div className="flex min-h-screen items-center justify-center bg-background">
              <span className="text-muted-foreground">Checking session…</span>
            </div>
          ) : showLogin ? (
            <Login
              language={language}
              theme={theme}
              onLogin={handleLogin}
              onLanguageChange={setLanguage}
              logoutReason={logoutReason}
            />
          ) : null}
        </BrowserRouter>
        <Toaster richColors position="top-right" />
      </div>
    </AppErrorBoundary>
  );
}

export default App;
