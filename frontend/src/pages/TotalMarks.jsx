import { useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { toast } from "sonner";
import { api, getApiErrorMessage } from "@/lib/api";
import { useTranslations } from "@/lib/i18n";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { sortByClassOrder } from "@/lib/utils";

const formatScore = (value) => {
  if (value === null || value === undefined || value === "") return "—";
  return value;
};

const toNumberOrNull = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const sumOrNull = (...values) => {
  const parsed = values.map(toNumberOrNull);
  if (!parsed.some((value) => value !== null)) return null;
  const total = parsed.reduce((acc, value) => acc + (value ?? 0), 0);
  const rounded = Math.round(total * 100) / 100;
  return Number.isInteger(rounded) ? rounded : rounded;
};

const maxOrNull = (...values) => {
  const parsed = values.map(toNumberOrNull).filter((value) => value !== null);
  if (!parsed.length) return null;
  return Math.max(...parsed);
};

const capScore = (value, max) => {
  const parsed = toNumberOrNull(value);
  if (parsed === null) return null;
  const capped = Math.min(max, Math.max(0, parsed));
  const rounded = Math.round(capped * 100) / 100;
  return Number.isInteger(rounded) ? rounded : rounded;
};

export default function TotalMarks() {
  const { language, semester, quarter, classes: contextClasses, classesLoaded } = useOutletContext();
  const t = useTranslations(language);
  const semesterNumber = semester === "semester2" ? 2 : 1;
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [weeks, setWeeks] = useState([]);
  const [activeWeekId, setActiveWeekId] = useState("");
  const [filterClass, setFilterClass] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const latestLoadRequestIdRef = useRef(0);

  const loadData = async (weekId = activeWeekId) => {
    const requestId = ++latestLoadRequestIdRef.current;
    try {
      const needClassesFromApi = !(classesLoaded && contextClasses?.length);
      const [studentRes, classRes] = await Promise.all([
        api.get("/students", { params: weekId ? { week_id: weekId } : {} }),
        needClassesFromApi
          ? api.get("/classes").catch(() => ({ data: null }))
          : Promise.resolve({ data: null }),
      ]);
      if (latestLoadRequestIdRef.current !== requestId) return;
      setStudents(studentRes.data || []);
      if (needClassesFromApi) {
        const classesFromApi = classRes?.data;
        if (classesFromApi?.length) setClasses(classesFromApi);
        else setClasses(contextClasses || []);
      } else {
        setClasses(contextClasses || []);
      }
    } catch (error) {
      if (latestLoadRequestIdRef.current !== requestId) return;
      toast.error(getApiErrorMessage(error) || "Failed to load data");
    }
  };

  const loadWeeks = async () => {
    try {
      const response = await api.get("/weeks", {
        params: { semester: semesterNumber, quarter },
      });
      setWeeks(response.data || []);
    } catch (error) {
      toast.error(getApiErrorMessage(error) || "Failed to load weeks");
    }
  };

  useEffect(() => {
    loadWeeks();
  }, [semesterNumber, quarter]);

  useEffect(() => {
    if (!activeWeekId || !weeks.length) return;
    if (!weeks.some((w) => w.id === activeWeekId)) return;
    loadData(activeWeekId);
  }, [activeWeekId, weeks]);

  useEffect(() => {
    if (!weeks.length) return;
    if (weeks.find((w) => w.id === activeWeekId)) return;
    const key = `app_selected_week_id_s${semesterNumber}_q${quarter}`;
    const saved = sessionStorage.getItem(key);
    if (saved && weeks.some((w) => w.id === saved)) setActiveWeekId(saved);
    else setActiveWeekId(weeks[0]?.id || "");
  }, [weeks, semesterNumber, quarter, activeWeekId]);

  useEffect(() => {
    if (!classes?.length) return;
    const key = `app_selected_class_id_s${semesterNumber}_q${quarter}`;
    const saved = sessionStorage.getItem(key);
    if (saved === "all" || classes.some((c) => c.id === saved)) setFilterClass(saved || "all");
  }, [classes, semesterNumber, quarter]);

  const rows = useMemo(() => {
    return students
      .filter((student) => {
        if (filterClass !== "all" && student.class_id !== filterClass) return false;
        if (searchTerm && !student.full_name?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        return true;
      })
      .map((student) => {
        const attendanceParticipation = capScore(
          sumOrNull(student.attendance, student.participation),
          5
        );
        const project = capScore(student.behavior, 5);
        const homework = capScore(student.homework, 5);
        const quiz = capScore(
          student.total_marks_best_quiz ??
            (quarter === 2 ? maxOrNull(student.quiz3, student.quiz4) : maxOrNull(student.quiz1, student.quiz2)),
          5
        );
        const chapterTest = capScore(
          student.total_marks_chapter_test ??
            (quarter === 2 ? student.chapter_test2_practical : student.chapter_test1_practical),
          10
        );
        const quarterExams = capScore(
          student.total_marks_quarter_exams_total ??
            sumOrNull(
              quarter === 2 ? student.quarter2_practical : student.quarter1_practical,
              quarter === 2 ? student.quarter2_theory : student.quarter1_theory
            ),
          20
        );
        const total = capScore(
          sumOrNull(attendanceParticipation, project, homework, quiz, chapterTest, quarterExams),
          50
        );

        return {
          ...student,
          attendanceParticipation,
          project,
          homework,
          quiz,
          chapterTest,
          quarterExams,
          total,
        };
      });
  }, [students, filterClass, searchTerm, quarter]);

  const resetFilters = () => {
    sessionStorage.setItem(`app_selected_class_id_s${semesterNumber}_q${quarter}`, "all");
    setFilterClass("all");
    setSearchTerm("");
  };

  return (
    <div className="space-y-8" data-testid="total-marks-page">
      <PageHeader
        title={t("nav_total_marks")}
        subtitle={t("overview")}
        testIdPrefix="total-marks"
      />

      <p className="text-xs text-muted-foreground" data-testid="total-marks-hint">
        {t("total_marks_hint")}
      </p>

      <Card data-testid="total-marks-filter-card">
        <CardContent className="grid gap-4 pt-6 md:grid-cols-2 xl:grid-cols-4">
          <Input
            placeholder={t("search_students")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Select
            value={filterClass}
            onValueChange={(value) => {
              sessionStorage.setItem(`app_selected_class_id_s${semesterNumber}_q${quarter}`, value);
              setFilterClass(value);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("select_class")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("all_classes")}</SelectItem>
              {sortByClassOrder(classes).map((cls) => (
                <SelectItem key={cls.id} value={cls.id}>
                  {cls.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
            {weeks.find((week) => week.id === activeWeekId)?.label || t("no_data")}
          </div>
          <Button variant="outline" onClick={resetFilters}>
            {t("reset_filters")}
          </Button>
        </CardContent>
      </Card>

      <Card data-testid="total-marks-table-card">
        <CardContent className="pt-6">
          <Table data-testid="total-marks-table">
            <TableHeader>
              <TableRow>
                <TableHead>{t("student_name")}</TableHead>
                <TableHead>{t("class_name")}</TableHead>
                <TableHead className="text-center">{t("total_marks_quizzes")} (5)</TableHead>
                <TableHead className="text-center">{t("total_marks_chapter_test")} (10)</TableHead>
                <TableHead className="text-center">{t("homework")} (5)</TableHead>
                <TableHead className="text-center">{t("total_marks_participation_attendance")} (5)</TableHead>
                <TableHead className="text-center">{t("behavior")} (5)</TableHead>
                <TableHead className="text-center">{t("quarter_exams_total")} (20)</TableHead>
                <TableHead className="text-center">{t("total_marks_overall")} (50)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length ? (
                rows.map((student) => (
                  <TableRow key={student.id} data-testid={`total-marks-row-${student.id}`}>
                    <TableCell>{student.full_name}</TableCell>
                    <TableCell>{student.class_name}</TableCell>
                    <TableCell className="text-center">{formatScore(student.quiz)}</TableCell>
                    <TableCell className="text-center">{formatScore(student.chapterTest)}</TableCell>
                    <TableCell className="text-center">{formatScore(student.homework)}</TableCell>
                    <TableCell className="text-center">{formatScore(student.attendanceParticipation)}</TableCell>
                    <TableCell className="text-center">{formatScore(student.project)}</TableCell>
                    <TableCell className="text-center">{formatScore(student.quarterExams)}</TableCell>
                    <TableCell className="text-center font-semibold">{formatScore(student.total)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground">
                    {t("no_data")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
