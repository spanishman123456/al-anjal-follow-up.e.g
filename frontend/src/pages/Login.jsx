import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api, checkBackendHealth, isProductionBackendUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Globe, MessageCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslations } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { SocialLinks } from "@/components/SocialLinks";

export default function Login({
  language = "en",
  onLogin,
  onLanguageChange,
  serverStatus: serverStatusProp,
}) {
  const t = useTranslations(language);
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "", password: "" });
  // Use app-level server status when provided (check starts as soon as you open the site); otherwise check when Login mounts
  const [localBackendOk, setLocalBackendOk] = useState(null);
  const backendOk = serverStatusProp !== undefined ? serverStatusProp : localBackendOk;

  useEffect(() => {
    if (serverStatusProp !== undefined) return; // App is doing the health check
    let cancelled = false;
    checkBackendHealth().then((ok) => {
      if (!cancelled) setLocalBackendOk(ok);
    });
    const safety = setTimeout(() => {
      if (!cancelled) setLocalBackendOk((v) => (v === null ? false : v));
    }, 12000);
    const interval = setInterval(() => {
      checkBackendHealth().then((ok) => {
        if (!cancelled) setLocalBackendOk(ok);
      });
    }, 8000);
    return () => {
      cancelled = true;
      clearTimeout(safety);
      clearInterval(interval);
    };
  }, [serverStatusProp]);

  const handleLogin = async (event) => {
    event.preventDefault();
    try {
      const response = await api.post("/auth/login", form);
      sessionStorage.setItem("auth_token", response.data.access_token);
      onLogin?.(response.data.access_token);
      navigate("/");
    } catch (error) {
      const status = error?.response?.status;
      const detail = error?.response?.data?.detail;
      const isNetwork = !error.response;
      let msg = t("login_failed");
      if (isNetwork) {
        if (isProductionBackendUrl) {
          msg = "Server is waking up (free hosting). Please wait up to a minute and try again.";
        } else {
          msg = backendOk
            ? "Login request failed. Keep the Start_App.bat window open and try again in a moment."
            : "Cannot reach backend. Run Start_App.bat (keep its window open), then try again.";
        }
      } else if (status === 503 && detail) {
        msg = typeof detail === "string" ? detail : "Server temporarily unavailable. Try again in a moment.";
      } else if (detail && typeof detail === "string") {
        msg = detail;
      }
      toast.error(msg);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden bg-gradient-to-b from-slate-50 to-white"
      data-testid="login-page"
    >
      {/* Background image – clearer visibility (reduced transparency) */}
      <div
        className="absolute inset-0 opacity-50"
        aria-hidden="true"
        style={{
          backgroundImage: "url('/login-bg.png')",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center",
          backgroundSize: "cover",
          backgroundColor: "#e8e8e8",
        }}
      />
      {/* Left column: logos top, social + Contact Us bottom, same horizontal center */}
      <div className="absolute left-0 top-0 bottom-0 z-10 flex flex-col items-center pt-5 pb-6 px-6 w-56 sm:w-60" data-testid="login-left-column">
        <div className="flex flex-col items-center gap-2">
          <img
            src="/logo-al-anjal.png"
            alt="Al-Anjal"
            className="h-20 sm:h-24 w-auto object-contain"
            data-testid="login-logo-school"
          />
          <img
            src="/logo-cognia.png"
            alt="Cognia"
            className="h-14 sm:h-16 w-auto object-contain"
            data-testid="login-logo-cognia"
          />
        </div>
        <div className="mt-auto flex flex-col items-center gap-3" data-testid="login-social-contact">
          <SocialLinks layout="column" iconSize="h-10 w-10" />
          <a
            href="#contact"
            className="flex items-center justify-center gap-2 rounded-xl bg-primary text-white py-2.5 px-4 font-medium text-sm hover:bg-primary/90 transition-all duration-200 hover:translate-y-[-2px] hover:scale-[1.02] hover:shadow-md active:translate-y-0 active:scale-[0.98] shadow-lg whitespace-nowrap"
            data-testid="login-contact-us"
          >
            <span className="relative flex items-center">
              <MessageCircle className="h-4 w-4 shrink-0" />
              <MessageCircle className="h-4 w-4 shrink-0 -ml-2.5 opacity-90" aria-hidden />
            </span>
            <span>{t("contact_us")}</span>
          </a>
        </div>
      </div>
      {/* Language toggle top right */}
      <div className="absolute top-0 right-0 z-10 flex items-center gap-2 px-6 py-5" data-testid="login-language-toggle">
          <Button
            size="sm"
            onClick={() => onLanguageChange?.("en")}
            className={cn(
              "hover:translate-y-0 hover:scale-100",
              language === "en"
                ? "bg-primary text-white hover:bg-primary/90 shadow-md"
                : "bg-white border-2 border-slate-300 text-slate-600 hover:border-primary hover:bg-primary/5"
            )}
            variant={language === "en" ? "default" : "outline"}
            data-testid="login-lang-en"
          >
            <Globe className="mr-1 h-4 w-4" />
            EN
          </Button>
          <Button
            size="sm"
            onClick={() => onLanguageChange?.("ar")}
            className={cn(
              "hover:translate-y-0 hover:scale-100",
              language === "ar"
                ? "bg-primary text-white hover:bg-primary/90 shadow-md"
                : "bg-white border-2 border-slate-300 text-slate-600 hover:border-primary hover:bg-primary/5"
            )}
            variant={language === "ar" ? "default" : "outline"}
            data-testid="login-lang-ar"
          >
            <Globe className="mr-1 h-4 w-4" />
            AR
          </Button>
      </div>

      {/* Hero section – Interacto style: large title + subtitle (darker green) */}
      <div className="relative z-10 w-full max-w-lg text-center mt-24 mb-10 animate-fade-in-up" style={{ animationDuration: "0.6s" }} data-testid="login-welcome">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-[hsl(166,76%,28%)]">{t("login_welcome_title")}</h1>
        <p className="mt-4 text-lg max-w-md mx-auto text-[hsl(166,76%,24%)]">{t("login_welcome_subtitle")}</p>
      </div>

      {/* Login card – white, shadow, rounded (no hover pop on this page) */}
      <div
        className="relative z-10 w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-xl p-8 animate-scale-in"
        style={{ animationDuration: "0.5s", animationDelay: "0.15s", animationFillMode: "backwards" }}
        data-testid="login-frame"
      >
        <Card noHoverPop className="rounded-xl border-0 shadow-none bg-transparent">
          <CardHeader className="px-0 pt-0">
            <CardTitle className="text-xl text-[hsl(166,76%,28%)]">{t("login_title")}</CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <form className="space-y-4" onSubmit={handleLogin}>
              <Input
                placeholder={t("username")}
                value={form.username}
                onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))}
                className="h-11 border-slate-200 focus:ring-2 focus:ring-primary/20"
                data-testid="login-username"
              />
              <Input
                type="password"
                placeholder={t("password")}
                value={form.password}
                onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                className="h-11 border-slate-200 focus:ring-2 focus:ring-primary/20"
                data-testid="login-password"
              />
              <Button
                type="submit"
                className="w-full h-11 bg-primary hover:bg-primary/90 text-white font-semibold shadow-md"
                data-testid="login-submit"
                disabled={backendOk === false && !isProductionBackendUrl}
              >
                {t("login")}
              </Button>
              {backendOk === null && (
                <p className="text-xs text-slate-500 mt-2">Checking server…</p>
              )}
              {backendOk === true && (
                <p className="text-xs text-green-600 mt-2">Server connected</p>
              )}
              {backendOk === false && (
                <p className="text-xs text-amber-600 mt-2">
                  {isProductionBackendUrl
                    ? "Server may be waking up (free hosting). You can try logging in; it may take up to a minute."
                    : "Server not connected. Run Start_App.bat and keep its window open."}
                </p>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
