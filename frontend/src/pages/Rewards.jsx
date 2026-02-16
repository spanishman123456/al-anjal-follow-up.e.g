import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useTranslations } from "@/lib/i18n";
import { getRewardSetsFromStorage, setStudentReward } from "@/lib/studentRewardsStorage";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Award, FileText, MessageCircle, PartyPopper } from "lucide-react";

/** Certificate dialog for a rewarded student */
function CertificateDialog({ reward, open, onOpenChange }) {
  if (!reward) return null;
  const { language } = useOutletContext();
  const isRTL = language === "ar";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg p-0 overflow-hidden"
        data-testid="rewards-certificate-dialog"
      >
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
          <h2 className="text-amber-900 dark:text-amber-100 text-xl font-bold mb-4">
            This is to certify that
          </h2>
          <p className="text-2xl font-bold text-foreground mb-2 border-b-2 border-amber-500/50 pb-2 inline-block">
            {reward.student_name}
          </p>
          <p className="text-sm text-muted-foreground mb-4">{reward.class_name}</p>
          <p className="text-amber-800 dark:text-amber-200 font-medium mb-2">
            has demonstrated outstanding effort and achievement.
          </p>
          <p className="text-sm text-muted-foreground italic">
            We are proud of your dedication. Keep reaching for the stars!
          </p>
          <p className="text-xs text-muted-foreground mt-6">
            Presented with appreciation
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Rewards() {
  const { language } = useOutletContext();
  const t = useTranslations(language);
  const [students, setStudents] = useState([]);
  const [badgeRewardIds, setBadgeRewardIds] = useState(() => getRewardSetsFromStorage().badge);
  const [certificateRewardIds, setCertificateRewardIds] = useState(() => getRewardSetsFromStorage().certificate);
  const [commentRewardIds, setCommentRewardIds] = useState(() => getRewardSetsFromStorage().comment);
  const [certificateFor, setCertificateFor] = useState(null);

  const loadData = async () => {
    try {
      const studentsRes = await api.get("/students");
      setStudents(studentsRes.data);
    } catch (error) {
      toast.error("Failed to load students");
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const rewardedStudents = students.filter(
    (s) =>
      badgeRewardIds.has(String(s.id)) ||
      certificateRewardIds.has(String(s.id)) ||
      commentRewardIds.has(String(s.id))
  );

  const handleBadge = (student) => {
    const key = String(student.id);
    const adding = !badgeRewardIds.has(key);
    setStudentReward(student.id, "badge", adding);
    setBadgeRewardIds((prev) => {
      const next = new Set(prev);
      if (adding) {
        next.add(key);
        toast.success(`${student.full_name} ${t("rewarded") || "rewarded"}!`);
      } else next.delete(key);
      return next;
    });
  };

  const handleComment = (student) => {
    const key = String(student.id);
    const adding = !commentRewardIds.has(key);
    setStudentReward(student.id, "comment", adding);
    setCommentRewardIds((prev) => {
      const next = new Set(prev);
      if (adding) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const handleCertificate = (student) => {
    const key = String(student.id);
    const adding = !certificateRewardIds.has(key);
    setStudentReward(student.id, "certificate", adding);
    setCertificateRewardIds((prev) => {
      const next = new Set(prev);
      if (adding) {
        next.add(key);
        setCertificateFor({
          student_name: student.full_name,
          class_name: student.class_name || "",
        });
      } else {
        next.delete(key);
        if (certificateFor?.student_name === student.full_name) setCertificateFor(null);
      }
      return next;
    });
  };

  return (
    <div className="space-y-8" data-testid="rewards-page">
      <PageHeader
        title={t("rewards")}
        subtitle={t("overview")}
        testIdPrefix="rewards"
      />

      <section className="grid gap-4 md:grid-cols-3" data-testid="rewards-metrics">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Rewarded Students</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold" data-testid="rewards-total">
              {rewardedStudents.length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Badges</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold" data-testid="rewards-badges">
              {badgeRewardIds.size}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Certificates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold" data-testid="rewards-certificates">
              {certificateRewardIds.size}
            </div>
          </CardContent>
        </Card>
      </section>

      <Card data-testid="rewards-table-card">
        <CardHeader>
          <CardTitle data-testid="rewards-table-title">{t("rewards")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table data-testid="rewards-table">
            <TableHeader>
              <TableRow>
                <TableHead>{t("student_name")}</TableHead>
                <TableHead>{t("class_name")}</TableHead>
                <TableHead>{t("criteria")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead className="w-[70px]">{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rewardedStudents.length ? (
                rewardedStudents.map((student) => (
                  <TableRow key={student.id} data-testid={`reward-row-${student.id}`}>
                    <TableCell data-testid={`reward-student-${student.id}`}>
                      <span className="inline-flex flex-wrap items-center gap-2 font-medium">
                        {student.full_name}
                        {badgeRewardIds.has(String(student.id)) && (
                          <span
                            className="badge-party-popper group inline-flex items-center gap-1.5 rounded-full border-2 border-amber-400/60 bg-gradient-to-r from-amber-200 via-amber-100 to-rose-200 px-2.5 py-1 text-sm font-semibold text-amber-900 shadow-sm transition-all duration-200 hover:scale-105 hover:shadow-md hover:border-amber-500/80 dark:from-amber-700/40 dark:via-amber-600/30 dark:to-rose-700/40 dark:text-amber-100 dark:border-amber-500/50"
                            title={t("badge") || "Badge"}
                          >
                            <PartyPopper className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:animate-wiggle" />
                            <span>{t("badge") || "Badge"}</span>
                          </span>
                        )}
                        {certificateRewardIds.has(String(student.id)) && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 px-2 py-0.5 text-sm font-medium">
                            <FileText className="h-3.5 w-3.5" />
                            {t("certificate") || "Certificate"}
                          </span>
                        )}
                        {commentRewardIds.has(String(student.id)) && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 text-sm font-medium">
                            <MessageCircle className="h-3.5 w-3.5" />
                            Excellent
                          </span>
                        )}
                      </span>
                    </TableCell>
                    <TableCell data-testid={`reward-class-${student.id}`}>{student.class_name || "—"}</TableCell>
                    <TableCell data-testid={`reward-criteria-${student.id}`}>—</TableCell>
                    <TableCell data-testid={`reward-status-${student.id}`}>{t("given") || "Given"}</TableCell>
                    <TableCell className="text-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            data-testid={`reward-actions-${student.id}`}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem
                            onClick={() => handleBadge(student)}
                            data-testid={`reward-action-badge-${student.id}`}
                            className="flex items-center gap-2"
                          >
                            <Award className="h-4 w-4" />
                            {badgeRewardIds.has(String(student.id))
                              ? (t("remove_badge") || "Remove badge")
                              : (t("badge") || "Badge")}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleCertificate(student)}
                            data-testid={`reward-action-certificate-${student.id}`}
                            className="flex items-center gap-2"
                          >
                            <FileText className="h-4 w-4" />
                            {certificateRewardIds.has(String(student.id))
                              ? (t("remove_certificate") || "Remove certificate")
                              : (t("certificate") || "Certificate")}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleComment(student)}
                            data-testid={`reward-action-comment-${student.id}`}
                            className="flex items-center gap-2"
                          >
                            <MessageCircle className="h-4 w-4" />
                            {commentRewardIds.has(String(student.id))
                              ? (t("remove_comment") || "Remove comment")
                              : (t("comment") || "Comment")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} data-testid="rewards-empty">
                    {t("no_data")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <CertificateDialog
        reward={certificateFor}
        open={!!certificateFor}
        onOpenChange={(open) => !open && setCertificateFor(null)}
      />
    </div>
  );
}
