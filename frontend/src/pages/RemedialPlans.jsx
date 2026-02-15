import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useTranslations } from "@/lib/i18n";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

const emptyForm = {
  student_id: "",
  focus_areas: "",
  strategies: "",
  status: "active",
  step1: "",
  step2: "",
  step3: "",
};

export default function RemedialPlans() {
  const { language } = useOutletContext();
  const t = useTranslations(language);
  const [plans, setPlans] = useState([]);
  const [students, setStudents] = useState([]);
  const [summary, setSummary] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const loadData = async () => {
    try {
      const [plansRes, studentsRes, summaryRes] = await Promise.all([
        api.get("/remedial-plans"),
        api.get("/students"),
        api.get("/analytics/summary"),
      ]);
      setPlans(plansRes.data);
      setStudents(studentsRes.data);
      setSummary(summaryRes.data);
    } catch (error) {
      toast.error("Failed to load remedial plans");
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async () => {
    const student = students.find((item) => item.id === form.student_id);
    if (!student) {
      toast.error("Select a student");
      return;
    }
    const steps = [form.step1, form.step2, form.step3]
      .filter(Boolean)
      .map((title) => ({ title }));
    try {
      await api.post("/remedial-plans", {
        student_id: student.id,
        student_name: student.full_name,
        class_name: student.class_name,
        focus_areas: form.focus_areas
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        strategies: form.strategies
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        status: form.status,
        steps,
      });
      toast.success("Remedial plan created");
      setIsDialogOpen(false);
      setForm(emptyForm);
      loadData();
    } catch (error) {
      toast.error("Failed to create plan");
    }
  };

  const activePlans = plans.filter((plan) => plan.status === "active");
  const completedPlans = plans.filter((plan) => plan.status === "completed");
  const successRate = plans.length
    ? Math.round((completedPlans.length / plans.length) * 100)
    : 0;

  return (
    <div className="space-y-8" data-testid="remedial-page">
      <PageHeader
        title={t("remedial_plans")}
        subtitle={t("overview")}
        testIdPrefix="remedial"
        action={
          <Button onClick={() => setIsDialogOpen(true)} data-testid="remedial-create-button">
            {t("add_plan")}
          </Button>
        }
      />

      <section className="grid gap-4 md:grid-cols-4" data-testid="remedial-metrics">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">{t("need_support")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold" data-testid="remedial-need-support">
              {(summary?.counts?.approach || 0) + (summary?.counts?.below || 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">{t("active_plans")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold" data-testid="remedial-active-count">
              {activePlans.length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">{t("completed_plans")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold" data-testid="remedial-completed-count">
              {completedPlans.length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">{t("success_rate")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold" data-testid="remedial-success-rate">
              {successRate}%
            </div>
          </CardContent>
        </Card>
      </section>

      <Card data-testid="remedial-table-card">
        <CardHeader>
          <CardTitle data-testid="remedial-table-title">{t("remedial_plans")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table data-testid="remedial-table">
            <TableHeader>
              <TableRow>
                <TableHead>{t("student_name")}</TableHead>
                <TableHead>{t("class_name")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("steps")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.length ? (
                plans.map((plan) => (
                  <TableRow key={plan.id} data-testid={`remedial-row-${plan.id}`}>
                    <TableCell data-testid={`remedial-student-${plan.id}`}>{plan.student_name}</TableCell>
                    <TableCell data-testid={`remedial-class-${plan.id}`}>{plan.class_name}</TableCell>
                    <TableCell data-testid={`remedial-status-${plan.id}`}>{plan.status}</TableCell>
                    <TableCell data-testid={`remedial-steps-${plan.id}`}>{plan.steps?.length || 0}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} data-testid="remedial-empty">
                    {t("no_data")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent data-testid="remedial-dialog">
          <DialogHeader>
            <DialogTitle data-testid="remedial-dialog-title">{t("add_plan")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <Select
              value={form.student_id}
              onValueChange={(value) => setForm((prev) => ({ ...prev, student_id: value }))}
            >
              <SelectTrigger data-testid="remedial-student-select">
                <SelectValue placeholder={t("select_student")} />
              </SelectTrigger>
              <SelectContent>
                {students.map((student) => (
                  <SelectItem key={student.id} value={student.id} data-testid={`remedial-student-${student.id}`}>
                    {student.full_name} - {student.class_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder={t("focus_areas")}
              value={form.focus_areas}
              onChange={(event) => setForm((prev) => ({ ...prev, focus_areas: event.target.value }))}
              data-testid="remedial-focus-areas"
            />
            <Textarea
              placeholder={t("strategies")}
              value={form.strategies}
              onChange={(event) => setForm((prev) => ({ ...prev, strategies: event.target.value }))}
              data-testid="remedial-strategies"
            />
            <Select
              value={form.status}
              onValueChange={(value) => setForm((prev) => ({ ...prev, status: value }))}
            >
              <SelectTrigger data-testid="remedial-status-select">
                <SelectValue placeholder={t("status")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active" data-testid="remedial-status-active">Active</SelectItem>
                <SelectItem value="completed" data-testid="remedial-status-completed">Completed</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder={`${t("steps")} 1`}
              value={form.step1}
              onChange={(event) => setForm((prev) => ({ ...prev, step1: event.target.value }))}
              data-testid="remedial-step-1"
            />
            <Input
              placeholder={`${t("steps")} 2`}
              value={form.step2}
              onChange={(event) => setForm((prev) => ({ ...prev, step2: event.target.value }))}
              data-testid="remedial-step-2"
            />
            <Input
              placeholder={`${t("steps")} 3`}
              value={form.step3}
              onChange={(event) => setForm((prev) => ({ ...prev, step3: event.target.value }))}
              data-testid="remedial-step-3"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} data-testid="remedial-cancel">
              {t("cancel")}
            </Button>
            <Button variant="success" onClick={handleCreate} data-testid="remedial-submit">
              {t("create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
