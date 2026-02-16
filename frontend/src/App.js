import { useCallback, useEffect, useState } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { api } from "@/lib/api";
import Dashboard from "@/pages/Dashboard";
import Students from "@/pages/Students";
import AssessmentMarks from "@/pages/AssessmentMarks";
import FinalExamsAssessment from "@/pages/FinalExamsAssessment";
import AssessmentMarksQ2 from "@/pages/AssessmentMarksQ2";
import FinalExamsAssessmentQ2 from "@/pages/FinalExamsAssessmentQ2";
import Teachers from "@/pages/Teachers";
import TeacherProfile from "@/pages/TeacherProfile";
import Classes from "@/pages/Classes";
import Analytics from "@/pages/Analytics";
import RemedialPlans from "@/pages/RemedialPlans";
import Rewards from "@/pages/Rewards";
import Reports from "@/pages/Reports";
import Settings from "@/pages/Settings";
import Calendar from "@/pages/Calendar";
import Notifications from "@/pages/Notifications";
import Login from "@/pages/Login";
import { Toaster } from "@/components/ui/sonner";

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
  const [token, setToken] = useState(localStorage.getItem("auth_token"));
  const [semester, setSemester] = useState(
    () => localStorage.getItem("semester") || "semester1",
  );
  const academicYear = (() => {
    const now = new Date();
    const startYear = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
    return `${startYear}-${startYear + 1}`;
  })();

  const [classes, setClasses] = useState([]);
  const [classesLoaded, setClassesLoaded] = useState(false);
  const loadClasses = useCallback(async () => {
    try {
      const r = await api.get("/classes");
      setClasses(r.data || []);
    } catch {
      setClasses([]);
    } finally {
      setClassesLoaded(true);
    }
  }, []);
  useEffect(() => {
    loadClasses();
  }, [loadClasses]);

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

  if (!token) {
    return (
      <div className="App">
        <BrowserRouter>
        <Login language={language} onLogin={setToken} onLanguageChange={setLanguage} />
        </BrowserRouter>
        <Toaster richColors position="top-right" />
      </div>
    );
  }

  return (
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
                academicYear={academicYear}
                classes={classes}
                classesLoaded={classesLoaded}
                loadClasses={loadClasses}
              />
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="students" element={<Students />} />
            <Route path="assessment-marks" element={<AssessmentMarks />} />
            <Route path="final-exams-assessment" element={<FinalExamsAssessment />} />
            <Route path="assessment-marks-q2" element={<AssessmentMarksQ2 />} />
            <Route path="final-exams-assessment-q2" element={<FinalExamsAssessmentQ2 />} />
            <Route path="teachers" element={<Teachers />} />
            <Route path="teachers/:teacherId" element={<TeacherProfile />} />
            <Route path="classes" element={<Classes />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="remedial-plans" element={<RemedialPlans />} />
            <Route path="rewards" element={<Rewards />} />
            <Route path="reports" element={<Reports />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="calendar" element={<Calendar />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster richColors position="top-right" />
    </div>
  );
}

export default App;
