import { useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { toast } from "sonner";
import { api, getApiErrorMessage, BULK_SAVE_TIMEOUT_MS } from "@/lib/api";
import { useTranslations } from "@/lib/i18n";
import { getRewardSetsFromStorage, setStudentReward } from "@/lib/studentRewardsStorage";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Award, FileText, MessageCircle, PartyPopper } from "lucide-react";
import { AssessmentPageFooter } from "@/components/AssessmentPageFooter";

const levelStyles = {
  on_level: "bg-emerald-100 text-emerald-700",
  approach: "bg-amber-100 text-amber-700",
  below: "bg-rose-100 text-rose-700",
  no_data: "bg-slate-100 text-slate-600",
};

const formatScore = (value, suffix = "") => {
  if (value === null || value === undefined) {
    return "—";
  }
  return `${value}${suffix}`;
};

const parseScore = (value) => {
  if (value === "" || value === null || value === undefined) {
    return null;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

// Total Score = attendance (2.5) + participation (2.5) + behavior (5) + homework (5), max 15.
const TOTAL_SCORE_MAX = 15;
function computeTotalScore(student) {
  const a = Number(student?.attendance) || 0;
  const p = Number(student?.participation) || 0;
  const b = Number(student?.behavior) || 0;
  const h = Number(student?.homework) || 0;
  return Math.min(TOTAL_SCORE_MAX, Math.round((a + p + b + h) * 100) / 100);
}
function computePerformanceLevel(student) {
  const total = computeTotalScore(student);
  const hasAny = [student?.attendance, student?.participation, student?.behavior, student?.homework].some(
    (v) => v != null && v !== "" && !Number.isNaN(Number(v))
  );
  if (!hasAny) return "no_data";
  if (total >= 13) return "on_level";
  if (total >= 10) return "approach";
  return "below";
}

const emptyForm = {
  full_name: "",
  class_id: "",
  attendance: "",
  participation: "",
  behavior: "",
  homework: "",
  quiz1: "",
  quiz2: "",
  quiz3: "",
  quiz4: "",
  chapter_test1_practical: "",
  chapter_test2_practical: "",
  quarter1_practical: "",
  quarter1_theory: "",
  quarter2_practical: "",
  quarter2_theory: "",
};

/** Celebration overlay: realistic UHD-style confetti explosion blast on vibrant blue */
function CelebrationOverlay({ studentName, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4500);
    return () => clearTimeout(t);
  }, [onClose]);

  const directions = [
    { name: "n" }, { name: "ne" }, { name: "e" }, { name: "se" },
    { name: "s" }, { name: "sw" }, { name: "w" }, { name: "nw" },
  ];
  const colors = [
    "#dc2626", "#ef4444", "#eab308", "#fbbf24", "#84cc16", "#22c55e",
    "#ec4899", "#d946ef", "#f472b6", "#f97316", "#ffffff", "#fef08a",
  ];
  const shapes = ["circle", "strip", "square", "triangle", "plus", "strip", "square", "circle", "triangle"];
  const confetti = Array.from({ length: 220 }, (_, i) => {
    const d = directions[i % 8];
    const dist = 45 + (i % 14) * 6 + (i % 3) * 4;
    const delay = (i % 30) * 0.015;
    const shape = shapes[i % shapes.length];
    const rot = 360 + (i % 5) * 360;
    let size;
    if (shape === "strip") size = { w: 8 + (i % 5) * 3, h: 2 };
    else if (shape === "square") size = 5 + (i % 3);
    else if (shape === "triangle") size = 6 + (i % 3);
    else if (shape === "plus") size = 6 + (i % 2) * 2;
    else size = 4 + (i % 3);
    return { ...d, dist, delay, color: colors[i % colors.length], shape, rot, size };
  });

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700 animate-in fade-in duration-300"
      data-testid="rewards-celebration-overlay"
      aria-modal="true"
      role="dialog"
    >
      {/* Confetti explosion: squares, triangles, plus signs, circles, strips */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
        {confetti.map((p, i) => {
          const isCircle = p.shape === "circle";
          const isStrip = p.shape === "strip";
          const isTriangle = p.shape === "triangle";
          const isPlus = p.shape === "plus";
          const w = isStrip ? p.size.w : (isCircle ? p.size : isTriangle || isPlus ? p.size : p.size);
          const h = isStrip ? p.size.h : (isCircle ? p.size : isTriangle || isPlus ? p.size : p.size);
          const baseStyle = {
            left: "50%",
            top: "50%",
            marginLeft: -w / 2,
            marginTop: -h / 2,
            width: w,
            height: h,
            ["--dist"]: `${p.dist}vh`,
            ["--rot"]: `${p.rot}deg`,
            animation: `rewards-confetti-${p.name} 2.1s ease-out ${p.delay}s forwards`,
          };
          if (isPlus) {
            return (
              <div key={i} className="absolute confetti-blast-particle flex items-center justify-center" style={baseStyle}>
                <span style={{ position: "absolute", width: 2, height: h, background: p.color, borderRadius: 1 }} />
                <span style={{ position: "absolute", width: w, height: 2, background: p.color, borderRadius: 1 }} />
              </div>
            );
          }
          return (
            <div
              key={i}
              className="absolute confetti-blast-particle"
              style={{
                ...baseStyle,
                borderRadius: isCircle ? "50%" : isStrip ? "1px" : "1px",
                background: p.color,
                clipPath: isTriangle ? "polygon(50% 0%, 0% 100%, 100% 100%)" : undefined,
                boxShadow: "0 0 1px rgba(0,0,0,0.15)",
              }}
            />
          );
        })}
      </div>
      {/* Center card */}
      <div className="relative z-10 text-center px-8 py-10 bg-white/95 backdrop-blur rounded-2xl shadow-2xl border-2 border-amber-300/80 animate-in zoom-in-95 duration-500">
        <div className="flex justify-center mb-4">
          <PartyPopper className="h-20 w-20 text-amber-500 drop-shadow-md" strokeWidth={1.5} />
        </div>
        <p className="text-slate-500 text-sm uppercase tracking-wider mb-1 font-medium">Congratulations!</p>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">{studentName}</h2>
        <p className="text-amber-600 font-medium">Great job! Keep up the excellent work.</p>
      </div>
    </div>
  );
}

/** Certificate dialog for rewarded student */
function CertificateDialog({ reward, open, onOpenChange }) {
  const { language } = useOutletContext();
  const isRTL = language === "ar";
  if (!reward) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 overflow-hidden" data-testid="rewards-certificate-dialog">
        <div
          className="relative bg-gradient-to-b from-amber-50 to-amber-100/50 dark:from-amber-950/30 dark:to-amber-900/20 border-2 border-amber-400/60 rounded-lg p-8 text-center"
          dir={isRTL ? "rtl" : "ltr"}
        >
          <div className="absolute top-4 left-4 right-4 flex justify-between items-start">
            <div className="w-12 h-12 rounded-full border-2 border-amber-500/60 flex items-center justify-center">
              <Award className="w-6 h-6 text-amber-600" />
            </div>
            <div className="w-12 h-12 rounded-full border-2 border-amber-500/60 flex items-center justify-center">
              <Award className="w-6 h-6 text-amber-600" />
            </div>
          </div>
          <p className="text-amber-700/80 dark:text-amber-400/80 text-xs uppercase tracking-[0.3em] mt-6 mb-2">
            Certificate of Achievement
          </p>
          <h2 className="text-amber-900 dark:text-amber-100 text-xl font-bold mb-4">This is to certify that</h2>
          <p className="text-2xl font-bold text-foreground mb-2 border-b-2 border-amber-500/50 pb-2 inline-block">
            {reward.student_name}
          </p>
          <p className="text-sm text-muted-foreground mb-4">{reward.class_name}</p>
          <p className="text-amber-800 dark:text-amber-200 font-medium mb-2">
            has demonstrated outstanding effort and achievement.
          </p>
          <p className="text-sm text-muted-foreground italic">We are proud of your dedication. Keep reaching for the stars!</p>
          <p className="text-xs text-muted-foreground mt-6">Presented with appreciation</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Students() {
  const { language, semester, profile, classes: contextClasses, classesLoaded } = useOutletContext();
  const t = useTranslations(language);
  const isTeacher = profile?.role_name === "Teacher";
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [weeks, setWeeks] = useState([]);
  const [activeWeekId, setActiveWeekId] = useState("");
  const [filterClass, setFilterClass] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [performanceFilter, setPerformanceFilter] = useState("all");
  const [scoreMin, setScoreMin] = useState("");
  const [scoreMax, setScoreMax] = useState("");
  const [bulkFile, setBulkFile] = useState(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [bulkEditMode, setBulkEditMode] = useState(false);
  const [bulkScores, setBulkScores] = useState({});
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [clearScoresOpen, setClearScoresOpen] = useState(false);
  const [deleteWeekOpen, setDeleteWeekOpen] = useState(false);
  const [promotionEnabled, setPromotionEnabled] = useState(false);
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [promoteFrom, setPromoteFrom] = useState("");
  const [promoteTo, setPromoteTo] = useState("");
  const [transferStudent, setTransferStudent] = useState(null);
  const [transferClass, setTransferClass] = useState("");
  const [deleteStudent, setDeleteStudent] = useState(null);
  const [celebrationFor, setCelebrationFor] = useState(null);
  const [certificateFor, setCertificateFor] = useState(null);
  const [badgeStudentIds, setBadgeStudentIds] = useState(() => getRewardSetsFromStorage().badge);
  const [certificateStudentIds, setCertificateStudentIds] = useState(() => getRewardSetsFromStorage().certificate);
  const [commentStudentIds, setCommentStudentIds] = useState(() => getRewardSetsFromStorage().comment);

  const loadData = async (weekId = activeWeekId) => {
    try {
      const requests = [
        api.get("/students", { params: weekId ? { week_id: weekId } : {} }),
        api.get("/settings/promotion"),
      ];
      if (!classesLoaded) requests.push(api.get("/classes"));
      const results = await Promise.all(requests);
      setStudents(results[0].data);
      setPromotionEnabled(Boolean(results[1].data?.enabled));
      if (classesLoaded) setClasses(contextClasses || []); else if (results[2]) setClasses(results[2].data || []);
    } catch (error) {
      toast.error(getApiErrorMessage(error) || "Failed to load students");
    }
  };

  const loadWeeks = async () => {
    try {
      const response = await api.get("/weeks", {
        params: { quarter: semester === "semester2" ? 2 : 1 },
      });
      setWeeks(response.data || []);
      // Do not set activeWeekId here; let useEffect([weeks]) restore from sessionStorage so both pages stay in sync
    } catch (error) {
      toast.error(getApiErrorMessage(error) || "Failed to load weeks");
    }
  };

  const handleAddWeek = async () => {
    try {
      const response = await api.post("/weeks", {
        semester: semester === "semester2" ? 2 : 1,
      });
      setWeeks((prev) => [...prev, response.data]);
      setActiveWeekId(response.data.id);
      toast.success(t("week_added"));
    } catch (error) {
      toast.error(t("week_add_failed"));
    }
  };

  const handleDeleteWeek = async () => {
    try {
      await api.delete(`/weeks/${activeWeekId}`);
      toast.success(t("week_deleted"));
      setDeleteWeekOpen(false);
      const response = await api.get("/weeks", {
        params: { quarter: semester === "semester2" ? 2 : 1 },
      });
      setWeeks(response.data || []);
      setActiveWeekId((response.data || [])[0]?.id || "");
    } catch (error) {
      toast.error(t("week_delete_failed"));
    }
  };

  useEffect(() => {
    loadWeeks();
  }, [semester]);

  useEffect(() => {
    if (classesLoaded && contextClasses) setClasses(contextClasses);
  }, [classesLoaded, contextClasses]);

  useEffect(() => {
    if (activeWeekId) {
      setBulkEditMode(false);
      setBulkScores({});
      loadData(activeWeekId);
    }
  }, [activeWeekId]);

  const filteredStudents = useMemo(() => {
    const minValue = scoreMin ? Number(scoreMin) : null;
    const maxValue = scoreMax ? Number(scoreMax) : null;
    return students.filter((student) => {
      if (filterClass !== "all" && student.class_id !== filterClass) {
        return false;
      }
      if (searchTerm && !student.full_name.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      const totalScore = computeTotalScore(student);
      const perfLevel = computePerformanceLevel(student);
      if (performanceFilter !== "all" && perfLevel !== performanceFilter) {
        return false;
      }
      if (minValue !== null && totalScore < minValue) {
        return false;
      }
      if (maxValue !== null && totalScore > maxValue) {
        return false;
      }
      return true;
    });
  }, [students, filterClass, searchTerm, performanceFilter, scoreMin, scoreMax]);

  const visibleWeeks = weeks;
  const activeWeek = weeks.find((week) => week.id === activeWeekId);
  const isWeek4 = activeWeek?.number === 4;
  const isWeek16 = activeWeek?.number === 16;
  const isWeek9 = activeWeek?.number === 9;
  const isWeek10 = activeWeek?.number === 10;
  const isWeek17 = activeWeek?.number === 17;
  const isWeek18 = activeWeek?.number === 18;

  useEffect(() => {
    if (!visibleWeeks.length) return;
    if (visibleWeeks.find((week) => week.id === activeWeekId)) return;
    const saved = sessionStorage.getItem("app_selected_week_id");
    if (saved && visibleWeeks.some((w) => w.id === saved)) setActiveWeekId(saved);
    else setActiveWeekId(visibleWeeks[0].id);
  }, [weeks]);

  useEffect(() => {
    if (!classes?.length) return;
    const saved = sessionStorage.getItem("app_selected_class_id");
    if (saved === "all" || classes.some((c) => c.id === saved)) setFilterClass(saved || "all");
  }, [classes]);

  const resetFilters = () => {
    sessionStorage.setItem("app_selected_class_id", "all");
    setFilterClass("all");
    setSearchTerm("");
    setPerformanceFilter("all");
    setScoreMin("");
    setScoreMax("");
  };

  const bulkFileInputRef = useRef(null);

  const handleBulkImport = async (fileOverride) => {
    const fileToUse = fileOverride ?? bulkFile;
    if (!fileToUse) {
      toast.error("Please select a file first");
      return;
    }
    if (!activeWeekId) {
      toast.error(t("select_week_before_import") || "Please select a week before importing marks so they are saved correctly.");
      return;
    }
    const formData = new FormData();
    formData.append("file", fileToUse);
    try {
      await api.post("/import/excel", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        params: { week_id: activeWeekId },
      });
      toast.success(t("marks_import_success"));
      sessionStorage.setItem("app_selected_week_id", activeWeekId);
      setBulkFile(null);
      if (bulkFileInputRef.current) bulkFileInputRef.current.value = "";
      loadData(activeWeekId);
    } catch (error) {
      toast.error(getApiErrorMessage(error) || t("marks_import_failed"));
    }
  };

  const openTransferDialog = (student) => {
    setTransferStudent(student);
    setTransferClass(student.class_id);
  };

  const handleTransfer = async () => {
    if (!transferStudent || !transferClass) return;
    try {
      await api.post(`/students/${transferStudent.id}/transfer`, {
        class_id: transferClass,
      });
      toast.success(t("student_transferred"));
      setTransferStudent(null);
      loadData(activeWeekId);
    } catch (error) {
      toast.error(t("transfer_failed"));
    }
  };

  const confirmDelete = (student) => {
    setDeleteStudent(student);
  };

  const handleDelete = async () => {
    if (!deleteStudent) return;
    try {
      await api.delete(`/students/${deleteStudent.id}`);
      toast.success(t("student_deleted"));
      setDeleteStudent(null);
      loadData(activeWeekId);
    } catch (error) {
      toast.error(t("delete_failed"));
    }
  };

  const handlePromote = async () => {
    if (!promoteFrom || !promoteTo) return;
    try {
      await api.post("/students/promote", {
        from_class_id: promoteFrom,
        to_class_id: promoteTo,
      });
      toast.success(t("promotion_success"));
      setPromoteOpen(false);
      setPromoteFrom("");
      setPromoteTo("");
      loadData(activeWeekId);
    } catch (error) {
      toast.error(t("promotion_fail"));
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await api.get("/students/import-template", {
        params: {
          week_id: activeWeekId || undefined,
          class_id: filterClass !== "all" ? filterClass : undefined,
        },
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "student_score_sheet_template.xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(t("export_success"));
    } catch (error) {
      toast.error(error?.response?.data?.detail || t("export_failed"));
    }
  };

  const handleExportMarks = async () => {
    try {
      const response = await api.get("/students/export", {
        params: {
          week_id: activeWeekId || undefined,
          class_id: filterClass !== "all" ? filterClass : undefined,
        },
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `students-marks-week-${activeWeek?.number || ""}.xlsx`,
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success(t("export_success"));
    } catch (error) {
      toast.error(error?.response?.data?.detail || t("export_failed"));
    }
  };

  const handleCreate = async () => {
    try {
      await api.post("/students", {
        full_name: form.full_name,
        class_id: form.class_id,
        attendance: parseScore(form.attendance),
        participation: parseScore(form.participation),
        behavior: parseScore(form.behavior),
        homework: parseScore(form.homework),
        quiz1: parseScore(form.quiz1),
        quiz2: parseScore(form.quiz2),
        quiz3: parseScore(form.quiz3),
        quiz4: parseScore(form.quiz4),
        chapter_test1_practical: parseScore(form.chapter_test1_practical),
        chapter_test2_practical: parseScore(form.chapter_test2_practical),
        quarter1_practical: parseScore(form.quarter1_practical),
        quarter1_theory: parseScore(form.quarter1_theory),
        quarter2_practical: parseScore(form.quarter2_practical),
        quarter2_theory: parseScore(form.quarter2_theory),
        week_id: activeWeekId || undefined,
      });
      toast.success("Student added");
      setIsAddOpen(false);
      setForm(emptyForm);
      loadData(activeWeekId);
    } catch (error) {
      toast.error("Failed to add student");
    }
  };

  const startBulkEdit = () => {
    const initialScores = filteredStudents.reduce((acc, student) => {
      acc[student.id] = {
        attendance: student.attendance ?? "",
        participation: student.participation ?? "",
        behavior: student.behavior ?? "",
        homework: student.homework ?? "",
        quiz1: student.quiz1 ?? "",
        quiz2: student.quiz2 ?? "",
        quiz3: student.quiz3 ?? "",
        quiz4: student.quiz4 ?? "",
        chapter_test1_practical: student.chapter_test1_practical ?? "",
        chapter_test2_practical: student.chapter_test2_practical ?? "",
        quarter1_practical: student.quarter1_practical ?? "",
        quarter1_theory: student.quarter1_theory ?? "",
        quarter2_practical: student.quarter2_practical ?? "",
        quarter2_theory: student.quarter2_theory ?? "",
      };
      return acc;
    }, {});
    setBulkScores(initialScores);
    setBulkEditMode(true);
  };

  const updateBulkScore = (studentId, field, value) => {
    setBulkScores((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: value,
      },
    }));
  };

  const MARKS_MAX = {
    attendance: 2.5,
    participation: 2.5,
    behavior: 5,
    homework: 5,
    quiz1: 5,
    quiz2: 5,
    quiz3: 5,
    quiz4: 5,
    chapter_test1_practical: 10,
    chapter_test2_practical: 10,
    quarter1_practical: 10,
    quarter1_theory: 10,
    quarter2_practical: 10,
    quarter2_theory: 10,
  };

  const handleScoreChange = (studentId, field, value) => {
    const max = MARKS_MAX[field];
    if (max == null) {
      updateBulkScore(studentId, field, value);
      return;
    }
    if (value === "" || value === null || value === undefined) {
      updateBulkScore(studentId, field, value);
      return;
    }
    const num = Number(value);
    if (!Number.isNaN(num) && num > max) {
      updateBulkScore(studentId, field, String(max));
      toast.warning(t("marks_exceeded").replace(/{max}/g, String(max)));
      return;
    }
    updateBulkScore(studentId, field, value);
  };

  const [fillValues, setFillValues] = useState({
    attendance: "",
    participation: "",
    behavior: "",
    homework: "",
  });

  const handleFillColumn = (field) => {
    const max = MARKS_MAX[field];
    const raw = fillValues[field];
    if (raw === "" || raw === null || raw === undefined) {
      toast.error(t("enter_value_to_fill") || "Enter a value to fill");
      return;
    }
    const num = Number(raw);
    if (Number.isNaN(num) || num < 0) {
      toast.error(t("enter_valid_value") || "Enter a valid number");
      return;
    }
    const value = max != null && num > max ? String(max) : raw;
    if (max != null && num > max) toast.warning(t("marks_exceeded").replace(/{max}/g, String(max)));
    setBulkEditMode(true);
    setBulkScores((prev) => {
      const next = { ...prev };
      filteredStudents.forEach((s) => {
        next[s.id] = { ...next[s.id], [field]: value };
      });
      return next;
    });
    toast.success(t("fill_applied") || "Value applied to all students in this column");
  };

  const handleBulkSave = async () => {
    try {
      const updates = Object.entries(bulkScores).map(([id, scores]) => ({
        id,
        attendance: parseScore(scores.attendance),
        participation: parseScore(scores.participation),
        behavior: parseScore(scores.behavior),
        homework: parseScore(scores.homework),
        quiz1: parseScore(scores.quiz1),
        quiz2: parseScore(scores.quiz2),
        quiz3: parseScore(scores.quiz3),
        quiz4: parseScore(scores.quiz4),
        chapter_test1_practical: parseScore(scores.chapter_test1_practical),
        chapter_test2_practical: parseScore(scores.chapter_test2_practical),
        quarter1_practical: parseScore(scores.quarter1_practical),
        quarter1_theory: parseScore(scores.quarter1_theory),
        quarter2_practical: parseScore(scores.quarter2_practical),
        quarter2_theory: parseScore(scores.quarter2_theory),
      }));
      await api.post("/students/bulk-scores", { updates, week_id: activeWeekId || undefined }, { timeout: BULK_SAVE_TIMEOUT_MS });
      toast.success(t("student_updated"));
      setBulkEditMode(false);
      setBulkConfirmOpen(false);
      loadData(activeWeekId);
    } catch (error) {
      toast.error(getApiErrorMessage(error) || t("student_update_failed"));
    }
  };

  const handleClearScores = async () => {
    setClearScoresOpen(false);
    // Clear only Students-page fields (follow-up scores); do not clear assessment marks.
    const updates = students.map((student) => ({
      id: student.id,
      attendance: null,
      participation: null,
      behavior: null,
      homework: null,
    }));
    try {
      await api.post("/students/bulk-scores", {
        updates,
        week_id: activeWeekId || undefined,
      }, { timeout: BULK_SAVE_TIMEOUT_MS });
      await loadData(activeWeekId);
      toast.success(t("scores_cleared"));
    } catch (error) {
      toast.error(getApiErrorMessage(error) || t("student_update_failed"));
    }
  };

  return (
    <div className="space-y-8" data-testid="students-page">
      <PageHeader
        title={t("students")}
        subtitle={t("overview")}
        testIdPrefix="students"
        action={
          isTeacher ? (
            <div className="flex flex-wrap gap-2">
              {bulkEditMode ? (
                <>
                  <Button
                    onClick={() => setBulkConfirmOpen(true)}
                    data-testid="bulk-save-scores"
                  >
                    {t("save_all_scores")}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setBulkEditMode(false)}
                    data-testid="bulk-cancel-scores"
                  >
                    {t("cancel")}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={startBulkEdit}
                    data-testid="bulk-edit-scores"
                  >
                    {t("edit_scores")}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setClearScoresOpen(true)}
                    data-testid="clear-scores-button"
                  >
                    {t("clear_scores")}
                  </Button>
                </>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {bulkEditMode ? (
                <>
                  <Button
                    onClick={() => setBulkConfirmOpen(true)}
                    data-testid="bulk-save-scores"
                  >
                    {t("save_all_scores")}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setBulkEditMode(false)}
                    data-testid="bulk-cancel-scores"
                  >
                    {t("cancel")}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={startBulkEdit}
                    data-testid="bulk-edit-scores"
                  >
                    {t("edit_scores")}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setClearScoresOpen(true)}
                    data-testid="clear-scores-button"
                  >
                    {t("clear_scores")}
                  </Button>
                  <Button
                    onClick={() => setIsAddOpen(true)}
                    data-testid="add-student-button"
                  >
                    {t("add_student")}
                  </Button>
                </>
              )}
            </div>
          )
        }
      />

      <Card data-testid="week-selector">
        <CardContent className="flex flex-wrap items-center gap-3 pt-6">
          <div className="flex flex-1 flex-wrap items-center gap-2" data-testid="week-tabs">
            <span className="text-sm text-muted-foreground">{t("week")}</span>
            <Select
              value={activeWeekId}
              onValueChange={(value) => {
                sessionStorage.setItem("app_selected_week_id", value);
                setActiveWeekId(value);
                setBulkEditMode(false);
              }}
            >
              <SelectTrigger className="w-44" data-testid="week-select">
                <SelectValue placeholder={t("week")} />
              </SelectTrigger>
              <SelectContent>
                {visibleWeeks.map((week) => (
                  <SelectItem
                    key={week.id}
                    value={week.id}
                    data-testid={`week-option-${week.number}`}
                  >
                    {t("week")} {week.number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {!isTeacher && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={handleAddWeek} data-testid="add-week-button">
                {t("add_week")}
              </Button>
              <Button
                variant="outline"
                onClick={() => setDeleteWeekOpen(true)}
                data-testid="delete-week-button"
                disabled={!activeWeekId}
              >
                {t("delete_week")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card data-testid="students-filter-card">
        <CardContent className="grid gap-4 pt-6 md:grid-cols-2 xl:grid-cols-6">
          <Input
            placeholder={t("search_students")}
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            data-testid="students-search-input"
          />
          <Select
            value={filterClass}
            onValueChange={(value) => {
              sessionStorage.setItem("app_selected_class_id", value);
              setFilterClass(value);
            }}
            data-testid="students-class-filter"
          >
            <SelectTrigger data-testid="students-class-filter-trigger">
              <SelectValue placeholder={t("select_class")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" data-testid="students-filter-all">
                {t("all_classes")}
              </SelectItem>
              {classes.map((cls) => (
                <SelectItem
                  key={cls.id}
                  value={cls.id}
                  data-testid={`students-filter-${cls.id}`}
                >
                  {cls.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={performanceFilter}
            onValueChange={setPerformanceFilter}
            data-testid="students-performance-filter"
          >
            <SelectTrigger data-testid="students-performance-filter-trigger">
              <SelectValue placeholder={t("performance_filter")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" data-testid="students-performance-all">
                {t("performance_filter")}
              </SelectItem>
              <SelectItem value="on_level" data-testid="students-performance-on-level">
                {t("on_level")}
              </SelectItem>
              <SelectItem value="approach" data-testid="students-performance-approach">
                {t("approach")}
              </SelectItem>
              <SelectItem value="below" data-testid="students-performance-below">
                {t("below")}
              </SelectItem>
            </SelectContent>
          </Select>
          <Input
            placeholder={t("min_score")}
            value={scoreMin}
            onChange={(event) => setScoreMin(event.target.value)}
            data-testid="students-score-min"
          />
          <Input
            placeholder={t("max_score")}
            value={scoreMax}
            onChange={(event) => setScoreMax(event.target.value)}
            data-testid="students-score-max"
          />
          <Button
            variant="outline"
            onClick={resetFilters}
            data-testid="students-reset-filters"
          >
            {t("reset_filters")}
          </Button>
          {!isTeacher && (
            <Button
              onClick={() => setPromoteOpen(true)}
              disabled={!promotionEnabled}
              data-testid="students-promote-button"
            >
              {t("promote_students")}
            </Button>
          )}
        </CardContent>
      </Card>

      <Card data-testid="students-bulk-import-card">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
          <div className="space-y-2">
            <p className="text-sm font-semibold" data-testid="bulk-import-title">
              {t("bulk_import_tools")}
            </p>
            <p className="text-xs text-muted-foreground" data-testid="bulk-import-subtitle">
              {t(isTeacher ? "bulk_import_description_teacher" : "bulk_import_description")}
            </p>
          </div>
          <input
            ref={bulkFileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) handleBulkImport(file);
              event.target.value = "";
            }}
            data-testid="bulk-import-file"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              onClick={handleDownloadTemplate}
              data-testid="bulk-import-template"
            >
              {t("download_template")}
            </Button>
            <Button
              variant="secondary"
              onClick={handleExportMarks}
              data-testid="bulk-import-download-marks"
            >
              {t("download_marks")}
            </Button>
            <Button
              onClick={() => bulkFileInputRef.current?.click()}
              data-testid="bulk-import-submit"
            >
              {t("import_marks")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card data-testid="students-table-card">
        <CardContent className="pt-6">
          <Table data-testid="students-table">
            <TableHeader>
              <TableRow>
                <TableHead data-testid="students-col-name">{t("student_name")}</TableHead>
                <TableHead data-testid="students-col-class">{t("class_name")}</TableHead>
                <TableHead data-testid="students-col-attendance" className="text-center">{t("attendance")} (2.5)</TableHead>
                <TableHead data-testid="students-col-participation" className="text-center">{t("participation")} (2.5)</TableHead>
                <TableHead data-testid="students-col-behavior" className="text-center">{t("behavior")} (5)</TableHead>
                <TableHead data-testid="students-col-homework" className="text-center">{t("homework")} (5)</TableHead>
                <TableHead data-testid="students-col-total" className="text-center">{t("total_score")}</TableHead>
                <TableHead data-testid="students-col-performance" className="text-center">{t("performance_level")}</TableHead>
                <TableHead data-testid="students-col-actions">{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="bg-muted/50" data-testid="students-fill-row">
                <TableCell colSpan={2} className="text-muted-foreground text-sm py-2">
                  {t("fill_column")}:
                </TableCell>
                <TableCell className="text-center py-2">
                  <div className="flex items-center justify-center gap-1">
                    <Input
                      type="number"
                      min={0}
                      max={2.5}
                      step={0.5}
                      className="w-14 h-8 text-center text-sm"
                      placeholder="0–2.5"
                      value={fillValues.attendance}
                      onChange={(e) => setFillValues((prev) => ({ ...prev, attendance: e.target.value }))}
                      data-testid="students-fill-attendance"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 shrink-0"
                      onClick={() => handleFillColumn("attendance")}
                      data-testid="students-fill-attendance-btn"
                    >
                      {t("fill_column")}
                    </Button>
                  </div>
                </TableCell>
                <TableCell className="text-center py-2">
                  <div className="flex items-center justify-center gap-1">
                    <Input
                      type="number"
                      min={0}
                      max={2.5}
                      step={0.5}
                      className="w-14 h-8 text-center text-sm"
                      placeholder="0–2.5"
                      value={fillValues.participation}
                      onChange={(e) => setFillValues((prev) => ({ ...prev, participation: e.target.value }))}
                      data-testid="students-fill-participation"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 shrink-0"
                      onClick={() => handleFillColumn("participation")}
                      data-testid="students-fill-participation-btn"
                    >
                      {t("fill_column")}
                    </Button>
                  </div>
                </TableCell>
                <TableCell className="text-center py-2">
                  <div className="flex items-center justify-center gap-1">
                    <Input
                      type="number"
                      min={0}
                      max={5}
                      step={0.5}
                      className="w-14 h-8 text-center text-sm"
                      placeholder="0–5"
                      value={fillValues.behavior}
                      onChange={(e) => setFillValues((prev) => ({ ...prev, behavior: e.target.value }))}
                      data-testid="students-fill-behavior"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 shrink-0"
                      onClick={() => handleFillColumn("behavior")}
                      data-testid="students-fill-behavior-btn"
                    >
                      {t("fill_column")}
                    </Button>
                  </div>
                </TableCell>
                <TableCell className="text-center py-2">
                  <div className="flex items-center justify-center gap-1">
                    <Input
                      type="number"
                      min={0}
                      max={5}
                      step={0.5}
                      className="w-14 h-8 text-center text-sm"
                      placeholder="0–5"
                      value={fillValues.homework}
                      onChange={(e) => setFillValues((prev) => ({ ...prev, homework: e.target.value }))}
                      data-testid="students-fill-homework"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 shrink-0"
                      onClick={() => handleFillColumn("homework")}
                      data-testid="students-fill-homework-btn"
                    >
                      {t("fill_column")}
                    </Button>
                  </div>
                </TableCell>
                <TableCell colSpan={20} />
              </TableRow>
              {filteredStudents.length ? (
                filteredStudents.map((student) => {
                  const currentScores = bulkScores[student.id] || student;
                  return (
                    <TableRow key={student.id} data-testid={`student-row-${student.id}`}>
                      <TableCell data-testid={`student-name-${student.id}`}>
                        <span className="inline-flex flex-wrap items-center gap-2">
                          {student.full_name}
                          {badgeStudentIds.has(String(student.id)) && (
                            <span
                              className="badge-party-popper group inline-flex items-center gap-1.5 rounded-full border-2 border-amber-400/60 bg-gradient-to-r from-amber-200 via-amber-100 to-rose-200 px-2.5 py-1 text-xs font-semibold text-amber-900 shadow-sm transition-all duration-200 hover:scale-105 hover:shadow-md hover:border-amber-500/80 dark:from-amber-700/40 dark:via-amber-600/30 dark:to-rose-700/40 dark:text-amber-100 dark:border-amber-500/50"
                              title={t("badge") || "Badge"}
                            >
                              <PartyPopper className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:animate-wiggle" />
                              <span>{t("badge") || "Badge"}</span>
                            </span>
                          )}
                          {certificateStudentIds.has(String(student.id)) && (
                            <span className="inline-flex items-center gap-1 rounded bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700 dark:bg-sky-900/50 dark:text-sky-300">
                              <FileText className="h-3.5 w-3.5" />
                              {t("certificate") || "Certificate"}
                            </span>
                          )}
                          {commentStudentIds.has(String(student.id)) && (
                            <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                              <MessageCircle className="h-3.5 w-3.5" />
                              Excellent
                            </span>
                          )}
                        </span>
                      </TableCell>
                      <TableCell data-testid={`student-class-${student.id}`}>
                        {student.class_name}
                      </TableCell>
                      <TableCell data-testid={`student-attendance-${student.id}`} className="text-center">
                        {bulkEditMode ? (
                          <Input
                            type="number"
                            min={0}
                            max={2.5}
                            step={0.5}
                            className="text-center"
                            value={currentScores.attendance}
                            onChange={(event) => handleScoreChange(student.id, "attendance", event.target.value)}
                            data-testid={`student-bulk-attendance-${student.id}`}
                          />
                        ) : (
                          formatScore(student.attendance)
                        )}
                      </TableCell>
                      <TableCell data-testid={`student-participation-${student.id}`} className="text-center">
                        {bulkEditMode ? (
                          <Input
                            type="number"
                            min={0}
                            max={2.5}
                            step={0.5}
                            className="text-center"
                            value={currentScores.participation}
                            onChange={(event) => handleScoreChange(student.id, "participation", event.target.value)}
                            data-testid={`student-bulk-participation-${student.id}`}
                          />
                        ) : (
                          formatScore(student.participation)
                        )}
                      </TableCell>
                      <TableCell data-testid={`student-behavior-${student.id}`} className="text-center">
                        {bulkEditMode ? (
                          <Input
                            type="number"
                            min={0}
                            max={5}
                            step={0.5}
                            className="text-center"
                            value={currentScores.behavior}
                            onChange={(event) => handleScoreChange(student.id, "behavior", event.target.value)}
                            data-testid={`student-bulk-behavior-${student.id}`}
                          />
                        ) : (
                          formatScore(student.behavior)
                        )}
                      </TableCell>
                      <TableCell data-testid={`student-homework-${student.id}`} className="text-center">
                        {bulkEditMode ? (
                          <Input
                            type="number"
                            min={0}
                            max={5}
                            step={0.5}
                            className="text-center"
                            value={currentScores.homework}
                            onChange={(event) => handleScoreChange(student.id, "homework", event.target.value)}
                            data-testid={`student-bulk-homework-${student.id}`}
                          />
                        ) : (
                          formatScore(student.homework)
                        )}
                      </TableCell>
                      <TableCell data-testid={`student-total-${student.id}`} className="text-center">
                        {formatScore(computeTotalScore(bulkScores[student.id] || student), "/15")}
                      </TableCell>
                      <TableCell data-testid={`student-performance-${student.id}`} className="text-center">
                        <Badge
                          className={levelStyles[computePerformanceLevel(bulkScores[student.id] || student)]}
                          data-testid={`student-performance-badge-${student.id}`}
                        >
                          {t(computePerformanceLevel(bulkScores[student.id] || student))}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              size="icon"
                              data-testid={`student-actions-${student.id}`}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                const key = String(student.id);
                                const adding = !badgeStudentIds.has(key);
                                setStudentReward(student.id, "badge", adding);
                                setBadgeStudentIds((prev) => {
                                  const next = new Set(prev);
                                  if (adding) {
                                    next.add(key);
                                    setCelebrationFor(student.full_name);
                                  } else next.delete(key);
                                  return next;
                                });
                              }}
                              data-testid={`student-action-badge-${student.id}`}
                            >
                              <Award className="mr-2 h-4 w-4" />
                              {badgeStudentIds.has(String(student.id))
                                ? (t("remove_badge") || "Remove badge")
                                : (t("badge") || "Badge")}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                const key = String(student.id);
                                const adding = !certificateStudentIds.has(key);
                                setStudentReward(student.id, "certificate", adding);
                                setCertificateStudentIds((prev) => {
                                  const next = new Set(prev);
                                  if (adding) {
                                    next.add(key);
                                    setCertificateFor({
                                      student_name: student.full_name,
                                      class_name: student.class_name || "",
                                    });
                                  } else {
                                    next.delete(key);
                                    if (certificateFor?.student_name === student.full_name)
                                      setCertificateFor(null);
                                  }
                                  return next;
                                });
                              }}
                              data-testid={`student-action-certificate-${student.id}`}
                            >
                              <FileText className="mr-2 h-4 w-4" />
                              {certificateStudentIds.has(String(student.id))
                                ? (t("remove_certificate") || "Remove certificate")
                                : (t("certificate") || "Certificate")}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                const key = String(student.id);
                                const adding = !commentStudentIds.has(key);
                                setStudentReward(student.id, "comment", adding);
                                setCommentStudentIds((prev) => {
                                  const next = new Set(prev);
                                  if (adding) next.add(key);
                                  else next.delete(key);
                                  return next;
                                });
                              }}
                              data-testid={`student-action-comment-${student.id}`}
                            >
                              <MessageCircle className="mr-2 h-4 w-4" />
                              {commentStudentIds.has(String(student.id))
                                ? (t("remove_comment") || "Remove comment")
                                : (t("comment") || "Comment")}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => openTransferDialog(student)}
                              data-testid={`student-action-transfer-${student.id}`}
                            >
                              {t("transfer_student")}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => confirmDelete(student)}
                              data-testid={`student-action-delete-${student.id}`}
                            >
                              {t("delete_student")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    data-testid="students-empty"
                  >
                    {t("no_data")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent data-testid="add-student-dialog">
          <DialogHeader>
            <DialogTitle data-testid="add-student-title">{t("add_student")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <Input
              placeholder={t("student_name")}
              value={form.full_name}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, full_name: event.target.value }))
              }
              data-testid="add-student-name"
            />
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              value={form.class_id}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, class_id: event.target.value }))
              }
              data-testid="add-student-class"
            >
              <option value="" data-testid="add-student-class-placeholder">
                {t("select_class")}
              </option>
              {classes.map((cls) => (
                <option
                  key={cls.id}
                  value={cls.id}
                  data-testid={`add-student-class-${cls.id}`}
                >
                  {cls.name}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-3">
              <Input
                placeholder={t("attendance")}
                value={form.attendance}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, attendance: event.target.value }))
                }
                data-testid="add-student-attendance"
              />
              <Input
                placeholder={t("participation")}
                value={form.participation}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, participation: event.target.value }))
                }
                data-testid="add-student-participation"
              />
              <Input
                placeholder={t("behavior")}
                value={form.behavior}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, behavior: event.target.value }))
                }
                data-testid="add-student-behavior"
              />
              <Input
                placeholder={t("homework")}
                value={form.homework}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, homework: event.target.value }))
                }
                data-testid="add-student-homework"
              />
              {isWeek4 && (
                <>
                  <Input
                    placeholder={t("quiz1")}
                    value={form.quiz1}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, quiz1: event.target.value }))
                    }
                    data-testid="add-student-quiz1"
                  />
                  <Input
                    placeholder={t("quiz2")}
                    value={form.quiz2}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, quiz2: event.target.value }))
                    }
                    data-testid="add-student-quiz2"
                  />
                  <Input
                    placeholder={t("chapter_test1_practical")}
                    value={form.chapter_test1_practical}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, chapter_test1_practical: event.target.value }))
                    }
                    data-testid="add-student-chapter1-practical"
                  />
                </>
              )}
              {isWeek16 && (
                <>
                  <Input
                    placeholder={t("quiz3")}
                    value={form.quiz3}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, quiz3: event.target.value }))
                    }
                    data-testid="add-student-quiz3"
                  />
                  <Input
                    placeholder={t("quiz4")}
                    value={form.quiz4}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, quiz4: event.target.value }))
                    }
                    data-testid="add-student-quiz4"
                  />
                  <Input
                    placeholder={t("chapter_test2_practical")}
                    value={form.chapter_test2_practical}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, chapter_test2_practical: event.target.value }))
                    }
                    data-testid="add-student-chapter2-practical"
                  />
                </>
              )}
              {isWeek9 && (
                <Input
                  placeholder={t("quarter1_practical")}
                  value={form.quarter1_practical}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, quarter1_practical: event.target.value }))
                  }
                  data-testid="add-student-quarter1-practical"
                />
              )}
              {isWeek10 && (
                <Input
                  placeholder={t("quarter1_theory")}
                  value={form.quarter1_theory}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, quarter1_theory: event.target.value }))
                  }
                  data-testid="add-student-quarter1-theory"
                />
              )}
              {isWeek17 && (
                <Input
                  placeholder={t("quarter2_practical")}
                  value={form.quarter2_practical}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, quarter2_practical: event.target.value }))
                  }
                  data-testid="add-student-quarter2-practical"
                />
              )}
              {isWeek18 && (
                <Input
                  placeholder={t("quarter2_theory")}
                  value={form.quarter2_theory}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, quarter2_theory: event.target.value }))
                  }
                  data-testid="add-student-quarter2-theory"
                />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsAddOpen(false)}
              data-testid="add-student-cancel"
            >
              {t("cancel")}
            </Button>
            <Button variant="success" onClick={handleCreate} data-testid="add-student-submit">
              {t("create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(transferStudent)} onOpenChange={() => setTransferStudent(null)}>
        <DialogContent data-testid="transfer-student-dialog">
          <DialogHeader>
            <DialogTitle data-testid="transfer-student-title">{t("transfer_student")}</DialogTitle>
            <DialogDescription data-testid="transfer-student-description">
              {t("select_class")}
            </DialogDescription>
          </DialogHeader>
          <Select value={transferClass} onValueChange={setTransferClass}>
            <SelectTrigger data-testid="transfer-student-class">
              <SelectValue placeholder={t("select_class")} />
            </SelectTrigger>
            <SelectContent>
              {classes.map((cls) => (
                <SelectItem
                  key={cls.id}
                  value={cls.id}
                  data-testid={`transfer-class-${cls.id}`}
                >
                  {cls.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setTransferStudent(null)}
              data-testid="transfer-student-cancel"
            >
              {t("cancel")}
            </Button>
            <Button variant="success" onClick={handleTransfer} data-testid="transfer-student-submit">
              {t("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteStudent)} onOpenChange={() => setDeleteStudent(null)}>
        <DialogContent data-testid="delete-student-dialog">
          <DialogHeader>
            <DialogTitle data-testid="delete-student-title">{t("delete_student")}</DialogTitle>
            <DialogDescription data-testid="delete-student-description">
              {t("confirm_delete")}
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground" data-testid="delete-student-message">
            {t("confirm_delete")}
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteStudent(null)}
              data-testid="delete-student-cancel"
            >
              {t("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              data-testid="delete-student-confirm"
            >
              {t("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={promoteOpen} onOpenChange={setPromoteOpen}>
        <DialogContent data-testid="promote-dialog">
          <DialogHeader>
            <DialogTitle data-testid="promote-title">{t("promote_students")}</DialogTitle>
            <DialogDescription data-testid="promote-description">
              {t("select_class")}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <Select value={promoteFrom} onValueChange={setPromoteFrom}>
              <SelectTrigger data-testid="promote-from-class">
                <SelectValue placeholder={t("select_class")} />
              </SelectTrigger>
              <SelectContent>
                {classes.map((cls) => (
                  <SelectItem
                    key={cls.id}
                    value={cls.id}
                    data-testid={`promote-from-${cls.id}`}
                  >
                    {cls.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={promoteTo} onValueChange={setPromoteTo}>
              <SelectTrigger data-testid="promote-to-class">
                <SelectValue placeholder={t("select_class")} />
              </SelectTrigger>
              <SelectContent>
                {classes.map((cls) => (
                  <SelectItem
                    key={cls.id}
                    value={cls.id}
                    data-testid={`promote-to-${cls.id}`}
                  >
                    {cls.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPromoteOpen(false)}
              data-testid="promote-cancel"
            >
              {t("cancel")}
            </Button>
            <Button variant="success" onClick={handlePromote} data-testid="promote-submit">
              {t("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkConfirmOpen} onOpenChange={setBulkConfirmOpen}>
        <DialogContent data-testid="bulk-confirm-dialog">
          <DialogHeader>
            <DialogTitle data-testid="bulk-confirm-title">{t("save_all_scores")}</DialogTitle>
            <DialogDescription data-testid="bulk-confirm-description">
              {t("confirm")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBulkConfirmOpen(false)}
              data-testid="bulk-confirm-cancel"
            >
              {t("cancel")}
            </Button>
            <Button variant="success" onClick={handleBulkSave} data-testid="bulk-confirm-save">
              {t("save_changes")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={clearScoresOpen} onOpenChange={setClearScoresOpen}>
        <DialogContent data-testid="clear-scores-dialog">
          <DialogHeader>
            <DialogTitle>{t("clear_scores")}</DialogTitle>
            <DialogDescription>{t("clear_scores_confirm")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClearScoresOpen(false)} data-testid="clear-scores-cancel">
              {t("cancel")}
            </Button>
            <Button variant="destructive" onClick={handleClearScores} data-testid="clear-scores-confirm">
              {t("clear_scores")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteWeekOpen} onOpenChange={setDeleteWeekOpen}>
        <DialogContent data-testid="delete-week-dialog">
          <DialogHeader>
            <DialogTitle>{t("delete_week")}</DialogTitle>
            <DialogDescription>{t("confirm")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteWeekOpen(false)} data-testid="delete-week-cancel">
              {t("cancel")}
            </Button>
            <Button variant="destructive" onClick={handleDeleteWeek} data-testid="delete-week-confirm">
              {t("delete_week")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {celebrationFor && (
        <CelebrationOverlay
          studentName={celebrationFor}
          onClose={() => setCelebrationFor(null)}
        />
      )}
      <CertificateDialog
        reward={certificateFor}
        open={!!certificateFor}
        onOpenChange={(open) => !open && setCertificateFor(null)}
      />
      <style>{`
        .confetti-blast-particle { transform: translate(-50%, -50%); will-change: transform, opacity; }
        @keyframes rewards-confetti-n {
          0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          to { transform: translate(-50%, calc(-50% - var(--dist, 80vh))) rotate(var(--rot, 0deg)); opacity: 0.7; }
        }
        @keyframes rewards-confetti-ne {
          0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          to { transform: translate(calc(-50% + var(--dist, 80vh) * 0.7), calc(-50% - var(--dist, 80vh) * 0.7)) rotate(var(--rot, 0deg)); opacity: 0.7; }
        }
        @keyframes rewards-confetti-e {
          0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          to { transform: translate(calc(-50% + var(--dist, 80vh)), -50%) rotate(var(--rot, 0deg)); opacity: 0.7; }
        }
        @keyframes rewards-confetti-se {
          0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          to { transform: translate(calc(-50% + var(--dist, 80vh) * 0.7), calc(-50% + var(--dist, 80vh) * 0.7)) rotate(var(--rot, 0deg)); opacity: 0.7; }
        }
        @keyframes rewards-confetti-s {
          0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          to { transform: translate(-50%, calc(-50% + var(--dist, 80vh))) rotate(var(--rot, 0deg)); opacity: 0.7; }
        }
        @keyframes rewards-confetti-sw {
          0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          to { transform: translate(calc(-50% - var(--dist, 80vh) * 0.7), calc(-50% + var(--dist, 80vh) * 0.7)) rotate(var(--rot, 0deg)); opacity: 0.7; }
        }
        @keyframes rewards-confetti-w {
          0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          to { transform: translate(calc(-50% - var(--dist, 80vh)), -50%) rotate(var(--rot, 0deg)); opacity: 0.7; }
        }
        @keyframes rewards-confetti-nw {
          0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          to { transform: translate(calc(-50% - var(--dist, 80vh) * 0.7), calc(-50% - var(--dist, 80vh) * 0.7)) rotate(var(--rot, 0deg)); opacity: 0.7; }
        }
      `}</style>
      <AssessmentPageFooter language={language} />
    </div>
  );
}
