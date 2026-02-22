import { useCallback, useEffect, useState, lazy, Suspense, Component } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { api, checkBackendHealth } from "@/lib/api";
import Login from "@/pages/Login";
import { Toaster } from "@/components/ui/sonner";

const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Students = lazy(() => import("@/pages/Students"));
const AssessmentMarks = lazy(() => import("@/pages/AssessmentMarks"));
const FinalExamsAssessment = lazy(() => import("@/pages/FinalExamsAssessment"));
const AssessmentMarksQ2 = lazy(() => import("@/pages/AssessmentMarksQ2"));
const FinalExamsAssessmentQ2 = lazy(() => import("@/pages/FinalExamsAssessmentQ2"));
const Teachers = lazy(() => import("@/pages/Teachers"));
const TeacherProfile = lazy(() => import("@/pages/TeacherProfile"));
const Classes = lazy(() => import("@/pages/Classes"));
const Analytics = lazy(() => import("@/pages/Analytics"));
const RemedialPlans = lazy(() => import("@/pages/RemedialPlans"));
const Rewards = lazy(() => import("@/pages/Rewards"));
const Reports = lazy(() => import("@/pages/Reports"));
const Settings = lazy(() => import("@/pages/Settings"));
const Calendar = lazy(() => import("@/pages/Calendar"));
const Notifications = lazy(() => import("@/pages/Notifications"));

const PageFallback = () => (
  <div className="flex min-h-[200px] items-center justify-center text-muted-foreground">
    <span className="animate-pulse">Loading…</span>
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
  const [theme, setTheme] = useState("light");
  const [token, setToken] = useState(() => sessionStorage.getItem("auth_token"));
  const [authReady, setAuthReady] = useState(() => (sessionStorage.getItem("auth_token") ? null : true));
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
    if (!token) return;
    let cancelled = false;
    api.get("/users/profile", { timeout: 10000 })
      .then(() => { if (!cancelled) setAuthReady(true); })
      .catch((err) => {
        if (cancelled) return;
        if (err?.response?.status === 401 || err?.code === "ECONNABORTED" || err?.message === "Network Error") {
          sessionStorage.removeItem("auth_token");
          setToken(null);
        }
        setAuthReady(true);
      });
    return () => { cancelled = true; };
  }, [token]);

  useEffect(() => {
    const handler = () => {
      setToken(null);
      setAuthReady(true);
    };
    window.addEventListener("auth-logout", handler);
    return () => window.removeEventListener("auth-logout", handler);
  }, []);

  useEffect(() => {
    if (token && authReady) loadClasses();
  }, [token, authReady, loadClasses]);

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
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("semester", semester);
  }, [semester]);
  useEffect(() => {
    localStorage.setItem("quarter", String(quarter));
  }, [quarter]);

  // Start backend health check as soon as app loads (when not logged in).
  // Short timeout so "Checking server" doesn't block for minutes; login can still be tried.
  const [backendOk, setBackendOk] = useState(null);
  useEffect(() => {
    if (token) return;
    let cancelled = false;
    checkBackendHealth().then((ok) => {
      if (!cancelled) setBackendOk(ok);
    });
    const safety = setTimeout(() => {
      if (!cancelled) setBackendOk((v) => (v === null ? false : v));
    }, 12000);
    const interval = setInterval(() => {
      checkBackendHealth().then((ok) => {
        if (!cancelled) setBackendOk(ok);
      });
    }, 3000);
    return () => {
      cancelled = true;
      clearTimeout(safety);
      clearInterval(interval);
    };
  }, [token]);

  const handleLogin = useCallback((newToken) => {
    setToken(newToken);
    setAuthReady(true);
  }, []);

  if (!token || (token && authReady === null)) {
    if (token && authReady === null) {
      return (
        <AppErrorBoundary>
          <div className="App flex min-h-screen items-center justify-center bg-background">
            <span className="text-muted-foreground animate-pulse">Checking session…</span>
            <Toaster richColors position="top-right" />
          </div>
        </AppErrorBoundary>
      );
    }
    return (
      <AppErrorBoundary>
        <div className="App">
          <BrowserRouter>
            <Login
              language={language}
              onLogin={handleLogin}
              onLanguageChange={setLanguage}
              serverStatus={backendOk}
            />
          </BrowserRouter>
          <Toaster richColors position="top-right" />
        </div>
      </AppErrorBoundary>
    );
  }

  return (
    <AppErrorBoundary>
      <div className="App">
        <BrowserRouter>
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
            <Route index element={<Suspense fallback={<PageFallback />}><Dashboard /></Suspense>} />
            <Route path="students" element={<Suspense fallback={<PageFallback />}><Students /></Suspense>} />
            <Route path="assessment-marks" element={<Suspense fallback={<PageFallback />}><AssessmentMarks /></Suspense>} />
            <Route path="final-exams-assessment" element={<Suspense fallback={<PageFallback />}><FinalExamsAssessment /></Suspense>} />
            <Route path="assessment-marks-q2" element={<Suspense fallback={<PageFallback />}><AssessmentMarksQ2 /></Suspense>} />
            <Route path="final-exams-assessment-q2" element={<Suspense fallback={<PageFallback />}><FinalExamsAssessmentQ2 /></Suspense>} />
            <Route path="teachers" element={<Suspense fallback={<PageFallback />}><Teachers /></Suspense>} />
            <Route path="teachers/:teacherId" element={<Suspense fallback={<PageFallback />}><TeacherProfile /></Suspense>} />
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
        </BrowserRouter>
        <Toaster richColors position="top-right" />
      </div>
    </AppErrorBoundary>
  );
}

export default App;
