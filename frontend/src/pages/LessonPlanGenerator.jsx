import { useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Download, FileText, Loader2, Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";
import { api, getApiErrorMessage } from "@/lib/api";
import { useTranslations } from "@/lib/i18n";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes)) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function LessonPlanGenerator() {
  const { language, schoolSection } = useOutletContext();
  const t = useTranslations(language);
  const wordInputRef = useRef(null);
  const pdfInputRef = useRef(null);
  const [wordFile, setWordFile] = useState(null);
  const [pdfFile, setPdfFile] = useState(null);
  const [wordPreview, setWordPreview] = useState(null);
  const [pdfPreview, setPdfPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState({ word: false, pdf: false });
  const [generating, setGenerating] = useState(false);
  const [generatedResult, setGeneratedResult] = useState(null);

  const pdfObjectUrl = useMemo(() => (pdfFile ? URL.createObjectURL(pdfFile) : null), [pdfFile]);

  useEffect(() => () => {
    if (pdfObjectUrl) {
      URL.revokeObjectURL(pdfObjectUrl);
    }
  }, [pdfObjectUrl]);

  const resetGeneratedResult = () => setGeneratedResult(null);

  const handleWordSelected = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setWordFile(file);
    setWordPreview(null);
    resetGeneratedResult();
    setPreviewLoading((prev) => ({ ...prev, word: true }));
    try {
      const formData = new FormData();
      formData.append("word_file", file);
      const response = await api.post("/lesson-plan/preview-word", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setWordPreview(response.data);
    } catch (error) {
      setWordFile(null);
      toast.error(getApiErrorMessage(error) || t("lesson_plan_preview_failed"));
    } finally {
      setPreviewLoading((prev) => ({ ...prev, word: false }));
    }
  };

  const handlePdfSelected = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setPdfFile(file);
    setPdfPreview(null);
    resetGeneratedResult();
    setPreviewLoading((prev) => ({ ...prev, pdf: true }));
    try {
      const formData = new FormData();
      formData.append("pdf_file", file);
      const response = await api.post("/lesson-plan/preview-pdf", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setPdfPreview(response.data);
    } catch (error) {
      setPdfFile(null);
      toast.error(getApiErrorMessage(error) || t("lesson_plan_preview_failed"));
    } finally {
      setPreviewLoading((prev) => ({ ...prev, pdf: false }));
    }
  };

  const handleGenerate = async () => {
    if (!wordFile || !pdfFile) {
      toast.error(t("lesson_plan_choose_both"));
      return;
    }
    setGenerating(true);
    resetGeneratedResult();
    try {
      const formData = new FormData();
      formData.append("word_file", wordFile);
      formData.append("pdf_file", pdfFile);
      const response = await api.post("/lesson-plan/generate", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setGeneratedResult(response.data);
      toast.success(t("lesson_plan_generate_success"));
    } catch (error) {
      toast.error(getApiErrorMessage(error) || t("lesson_plan_generate_failed"));
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async () => {
    if (!generatedResult?.generated_document_id) return;
    try {
      const response = await api.get(`/lesson-plan/generated/${generatedResult.generated_document_id}`, {
        responseType: "blob",
      });
      const blobUrl = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = generatedResult.generated_filename || "generated-lesson-plan.docx";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      toast.error(getApiErrorMessage(error) || t("download_fail"));
    }
  };

  const canGenerate = Boolean(wordFile && pdfFile && !previewLoading.word && !previewLoading.pdf && !generating);

  return (
    <div className="space-y-8" data-testid="lesson-plan-generator-page">
      <PageHeader
        pageKey="lesson_plan"
        testIdPrefix="lesson-plan"
        action={
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="outline" data-testid="lesson-plan-model-badge">
              {t("lesson_plan_generation_mode")}: {t("lesson_plan_rule_based_mode")}
            </Badge>
            <Button
              onClick={handleGenerate}
              disabled={!canGenerate}
              data-testid="lesson-plan-generate-button"
            >
              {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              {generating ? t("lesson_plan_generating") : t("lesson_plan_generate")}
            </Button>
          </div>
        }
      />

      <Card data-testid="lesson-plan-intro-card">
        <CardHeader>
          <CardTitle>{t("lesson_plan_generator")}</CardTitle>
          <CardDescription>{t("lesson_plan_generator_description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{t("lesson_plan_preserve_layout_note")}</p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{t("lesson_plan_docx_only")}</Badge>
            <Badge variant="secondary">{t("lesson_plan_text_pdf_only")}</Badge>
          </div>
          <p className="rounded-lg border border-cyan-500/25 bg-cyan-500/10 p-3 text-sm text-foreground" data-testid="lesson-plan-section-note">
            {schoolSection === "arabic" ? t("lesson_plan_arabic_template_note") : t("lesson_plan_international_template_note")}
          </p>
        </CardContent>
      </Card>

      <section className="grid gap-6 lg:grid-cols-2" data-testid="lesson-plan-upload-grid">
        <Card data-testid="lesson-plan-word-upload-card">
          <CardHeader>
            <CardTitle>{t("upload_word")}</CardTitle>
            <CardDescription>{t("lesson_plan_word_help")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <input
              ref={wordInputRef}
              type="file"
              accept=".docx"
              className="hidden"
              onChange={handleWordSelected}
              data-testid="lesson-plan-word-input"
            />
            <Button onClick={() => wordInputRef.current?.click()} data-testid="lesson-plan-word-upload-button">
              <Upload className="mr-2 h-4 w-4" />
              {t("upload_word")}
            </Button>
            {previewLoading.word ? (
              <p className="text-sm text-muted-foreground">{t("lesson_plan_loading_preview")}</p>
            ) : wordFile ? (
              <div className="space-y-2 rounded-lg border border-border/60 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{t("lesson_plan_word_template")}</Badge>
                  <span className="text-sm font-medium">{wordFile.name}</span>
                  <span className="text-xs text-muted-foreground">{formatFileSize(wordFile.size)}</span>
                </div>
                {wordPreview && (
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>{t("lesson_plan_editable_blocks")}: {wordPreview.editable_block_count}</span>
                    <span>{t("lesson_plan_tables")}: {wordPreview.table_count}</span>
                    <span>{t("lesson_plan_paragraphs")}: {wordPreview.paragraph_count}</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t("lesson_plan_select_word")}</p>
            )}
          </CardContent>
        </Card>

        <Card data-testid="lesson-plan-pdf-upload-card">
          <CardHeader>
            <CardTitle>{t("upload_pdf")}</CardTitle>
            <CardDescription>{t("lesson_plan_pdf_help")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <input
              ref={pdfInputRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={handlePdfSelected}
              data-testid="lesson-plan-pdf-input"
            />
            <Button onClick={() => pdfInputRef.current?.click()} data-testid="lesson-plan-pdf-upload-button">
              <Upload className="mr-2 h-4 w-4" />
              {t("upload_pdf")}
            </Button>
            {previewLoading.pdf ? (
              <p className="text-sm text-muted-foreground">{t("lesson_plan_loading_preview")}</p>
            ) : pdfFile ? (
              <div className="space-y-2 rounded-lg border border-border/60 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{t("lesson_plan_source_pdf")}</Badge>
                  <span className="text-sm font-medium">{pdfFile.name}</span>
                  <span className="text-xs text-muted-foreground">{formatFileSize(pdfFile.size)}</span>
                </div>
                {pdfPreview && (
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>{t("lesson_plan_pages")}: {pdfPreview.page_count}</span>
                    <span>{t("lesson_plan_text_length")}: {pdfPreview.text_length}</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t("lesson_plan_select_pdf")}</p>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2" data-testid="lesson-plan-preview-grid">
        <Card data-testid="lesson-plan-word-preview-card">
          <CardHeader>
            <CardTitle>{t("lesson_plan_word_preview")}</CardTitle>
            <CardDescription>{t("lesson_plan_preview_before_generate")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="visual" className="space-y-4">
              <TabsList>
                <TabsTrigger value="visual">{t("lesson_plan_visual_preview")}</TabsTrigger>
                <TabsTrigger value="text">{t("lesson_plan_extracted_text")}</TabsTrigger>
              </TabsList>
              <TabsContent value="visual">
                <ScrollArea className="h-[480px] rounded-lg border border-border/60 bg-background p-4">
                  {wordPreview?.preview_html ? (
                    <div
                      className="prose prose-sm max-w-none dark:prose-invert lesson-plan-preview-html"
                      dangerouslySetInnerHTML={{ __html: wordPreview.preview_html }}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">{t("lesson_plan_no_preview")}</p>
                  )}
                </ScrollArea>
              </TabsContent>
              <TabsContent value="text">
                <ScrollArea className="h-[480px] rounded-lg border border-border/60 bg-background p-4">
                  <pre className="whitespace-pre-wrap text-sm text-foreground">
                    {wordPreview?.preview_text || t("lesson_plan_no_preview")}
                  </pre>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card data-testid="lesson-plan-pdf-preview-card">
          <CardHeader>
            <CardTitle>{t("lesson_plan_pdf_preview")}</CardTitle>
            <CardDescription>{t("lesson_plan_preview_before_generate")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-hidden rounded-lg border border-border/60 bg-white">
              {pdfObjectUrl ? (
                <iframe
                  title="lesson-plan-pdf-preview"
                  src={pdfObjectUrl}
                  className="h-[360px] w-full"
                />
              ) : (
                <div className="flex h-[360px] items-center justify-center text-sm text-muted-foreground">
                  {t("lesson_plan_no_preview")}
                </div>
              )}
            </div>
            <Separator />
            <ScrollArea className="h-[180px] rounded-lg border border-border/60 bg-background p-4">
              <pre className="whitespace-pre-wrap text-sm text-foreground">
                {pdfPreview?.preview_text || t("lesson_plan_no_preview")}
              </pre>
            </ScrollArea>
          </CardContent>
        </Card>
      </section>

      <Card data-testid="lesson-plan-result-card">
        <CardHeader>
          <CardTitle>{t("lesson_plan_generated")}</CardTitle>
          <CardDescription>
            {generatedResult ? t("lesson_plan_download_ready") : t("lesson_plan_waiting_files")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {generatedResult ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{generatedResult.generated_filename}</Badge>
                <Badge variant="outline">{t("lesson_plan_rule_based_mode")}</Badge>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-lg border border-border/60 p-3">
                  <p className="text-xs text-muted-foreground">{t("lesson_plan_updated_blocks")}</p>
                  <p className="text-xl font-semibold">{generatedResult.updated_blocks}</p>
                </div>
                <div className="rounded-lg border border-border/60 p-3">
                  <p className="text-xs text-muted-foreground">{t("lesson_plan_pages")}</p>
                  <p className="text-xl font-semibold">{generatedResult.source_pdf_pages}</p>
                </div>
                <div className="rounded-lg border border-border/60 p-3">
                  <p className="text-xs text-muted-foreground">{t("lesson_plan_editable_blocks")}</p>
                  <p className="text-xl font-semibold">{generatedResult.template_blocks}</p>
                </div>
              </div>
              <ScrollArea className="h-[160px] rounded-lg border border-border/60 bg-background p-4">
                <pre className="whitespace-pre-wrap text-sm text-foreground">
                  {generatedResult.summary || t("lesson_plan_no_summary")}
                </pre>
              </ScrollArea>
              <div className="flex flex-wrap gap-3">
                <Button onClick={handleDownload} data-testid="lesson-plan-download-button">
                  <Download className="mr-2 h-4 w-4" />
                  {t("lesson_plan_download_docx")}
                </Button>
                <Button variant="outline" onClick={handleGenerate} disabled={generating}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  {t("lesson_plan_generate_again")}
                </Button>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-3 rounded-lg border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
              <FileText className="h-5 w-5 shrink-0" />
              <span>{t("lesson_plan_ready_to_generate")}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
