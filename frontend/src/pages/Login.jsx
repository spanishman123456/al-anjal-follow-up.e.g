import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api, checkBackendHealth } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslations } from "@/lib/i18n";
import { toast } from "sonner";

export default function Login({ language = "en", onLogin, onLanguageChange }) {
  const t = useTranslations(language);
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "", password: "" });
  const [backendOk, setBackendOk] = useState(null);

  useEffect(() => {
    let cancelled = false;
    checkBackendHealth().then((ok) => {
      if (!cancelled) setBackendOk(ok);
    });
    const t = setInterval(() => {
      checkBackendHealth().then((ok) => {
        if (!cancelled) setBackendOk(ok);
      });
    }, 8000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  const handleLogin = async (event) => {
    event.preventDefault();
    try {
      const response = await api.post("/auth/login", form);
      localStorage.setItem("auth_token", response.data.access_token);
      onLogin?.(response.data.access_token);
      navigate("/");
    } catch (error) {
      const status = error?.response?.status;
      const detail = error?.response?.data?.detail;
      const isNetwork = !error.response;
      let msg = t("login_failed");
      if (isNetwork) {
        msg = backendOk
          ? "Login request failed. Keep the Start_App.bat window open and try again in a moment."
          : "Cannot reach backend. Run Start_App.bat (keep its window open), then try again.";
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
      className="min-h-screen flex flex-col items-center justify-center p-6 relative"
      data-testid="login-page"
    >
      {/* Background image – brightened so it appears clear */}
      <div
        className="absolute inset-0"
        aria-hidden="true"
        style={{
          backgroundImage: "url('/login-bg.png')",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center",
          backgroundSize: "cover",
          backgroundColor: "#e8e8e8",
          filter: "brightness(1.12) contrast(1.05)",
        }}
      />
      {/* Light overlay so text and form stay readable */}
      <div
        className="absolute inset-0 bg-slate-900/20"
        aria-hidden="true"
      />
      {/* Top bar: Al-Anjal logo on top, Cognia seal centered below it, left-aligned */}
      <div className="absolute top-0 left-0 right-0 z-10 flex justify-start px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex flex-col items-center gap-2 sm:gap-3">
          <img
            src="/logo-al-anjal.png"
            alt="Al-Anjal Private Schools"
            className="h-20 sm:h-24 md:h-28 w-auto object-contain"
            data-testid="login-logo-school"
          />
          <img
            src="/logo-cognia.png"
            alt="Accredited Cognia"
            className="h-16 sm:h-18 md:h-20 w-auto object-contain"
            data-testid="login-logo-cognia"
          />
        </div>
      </div>
      <div className="relative z-10 flex w-full max-w-md flex-col items-center text-center text-white px-4 py-5 rounded-2xl bg-slate-900/35 shadow-lg" data-testid="login-welcome">
        <h1 className="text-2xl font-semibold [text-shadow:0_1px_2px_rgba(0,0,0,0.4),0_2px_8px_rgba(0,0,0,0.35)]">{t("login_welcome_title")}</h1>
        <p className="mt-2 text-sm font-medium [text-shadow:0_1px_2px_rgba(0,0,0,0.4),0_0_6px_rgba(0,0,0,0.3)]">{t("login_welcome_subtitle")}</p>
        <div className="mt-4 flex items-center gap-2" data-testid="login-language-toggle">
          <Button
            size="sm"
            onClick={() => onLanguageChange?.("en")}
            className={
              language === "en"
                ? "bg-[#1f4c9a] text-white hover:bg-[#1a3f7f]"
                : "border-[#1f4c9a] text-[#1f4c9a] hover:bg-[#1f4c9a]/10"
            }
            variant={language === "en" ? "default" : "outline"}
            data-testid="login-lang-en"
          >
            <Globe className="mr-1 h-4 w-4" />
            EN
          </Button>
          <Button
            size="sm"
            onClick={() => onLanguageChange?.("ar")}
            className={
              language === "ar"
                ? "bg-[#1f4c9a] text-white hover:bg-[#1a3f7f]"
                : "border-[#1f4c9a] text-[#1f4c9a] hover:bg-[#1f4c9a]/10"
            }
            variant={language === "ar" ? "default" : "outline"}
            data-testid="login-lang-ar"
          >
            <Globe className="mr-1 h-4 w-4" />
            AR
          </Button>
        </div>
      </div>
      <div
        className="relative z-10 mt-8 w-full max-w-md rounded-[28px] border-2 border-[#1f4c9a]/30 bg-white/95 backdrop-blur-sm p-2 shadow-xl"
        data-testid="login-frame"
      >
        <Card className="rounded-[24px] border border-[#1f4c9a]/10">
          <CardHeader>
            <CardTitle>{t("login_title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleLogin}>
              <Input
                placeholder={t("username")}
                value={form.username}
                onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))}
                data-testid="login-username"
              />
              <Input
                type="password"
                placeholder={t("password")}
                value={form.password}
                onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                data-testid="login-password"
              />
              <Button type="submit" className="w-full" data-testid="login-submit" disabled={backendOk === false}>
                {t("login")}
              </Button>
              {backendOk === true && (
                <p className="text-xs text-green-600 mt-2">Server connected</p>
              )}
              {backendOk === false && (
                <p className="text-xs text-amber-600 mt-2">Server not connected. Run Start_App.bat and keep its window open.</p>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
