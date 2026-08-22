import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function InternationalCompletionOverview({ t, testItems = [], classRows = [], testIdPrefix }) {
  const totals = testItems.length
    ? testItems.reduce(
        (acc, item) => ({ completed: acc.completed + item.completed, total: acc.total + item.completed + item.missing }),
        { completed: 0, total: 0 },
      )
    : classRows.reduce(
        (acc, item) => ({ completed: acc.completed + item.completed, total: acc.total + item.total }),
        { completed: 0, total: 0 },
      );
  const percentage = totals.total ? Math.round((totals.completed / totals.total) * 1000) / 10 : 0;

  return (
    <section className="grid gap-6 xl:grid-cols-[1fr_1.25fr]" data-testid={`${testIdPrefix}-completion-classes`}>
      <Card className="premium-active-card overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4">
            <CardTitle>{testItems.length ? t("test_completion") : t("assessment_completion")}</CardTitle>
            <span className="text-2xl font-bold text-cyan-700 dark:text-cyan-300">{percentage}%</span>
          </div>
        </CardHeader>
        <CardContent>
          <Progress value={percentage} className="mb-5 h-3" />
          <div className="space-y-3">
            {(testItems.length ? testItems : classRows).map((item) => {
              const completed = item.completed || 0;
              const missing = testItems.length ? item.missing || 0 : Math.max((item.total || 0) - completed, 0);
              const total = completed + missing;
              const itemPercentage = total ? Math.round((completed / total) * 100) : 0;
              return (
                <div key={item.id} className="rounded-xl border border-border/60 bg-muted/20 p-3 transition-colors hover:border-cyan-400/35 hover:bg-cyan-50/40 dark:hover:bg-cyan-950/10">
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-medium">{item.label || item.name}</span>
                    <span className="font-bold text-cyan-700 dark:text-cyan-300">{itemPercentage}%</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-4 text-xs">
                    <span className="text-emerald-600">{t("tested")}: {completed}</span>
                    <span className="text-rose-600">{t("not_tested")}: {missing}</span>
                  </div>
                </div>
              );
            })}
            {!testItems.length && !classRows.length && <p className="text-sm text-muted-foreground">{t("no_data")}</p>}
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader><CardTitle>{t("classes")}</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("class")}</TableHead>
                <TableHead className="text-center">{t("students")}</TableHead>
                <TableHead className="text-center">{t("assessed_students")}</TableHead>
                <TableHead className="text-center">{t("completion_percentage")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {classRows.map((item) => {
                const rowPercentage = item.total ? Math.round((item.completed / item.total) * 100) : 0;
                return (
                  <TableRow key={item.id}>
                    <TableCell className="font-semibold">{item.name}</TableCell>
                    <TableCell className="text-center tabular-nums">{item.total}</TableCell>
                    <TableCell className="text-center tabular-nums">{item.completed}</TableCell>
                    <TableCell className="text-center font-bold text-cyan-700 dark:text-cyan-300">{rowPercentage}%</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {!classRows.length && <p className="p-8 text-center text-sm text-muted-foreground">{t("no_data")}</p>}
        </CardContent>
      </Card>
    </section>
  );
}
