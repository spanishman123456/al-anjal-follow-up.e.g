import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api, checkBackendHealth, checkBackendLive, isProductionBackendUrl, warmBackendInBackground } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Globe, MessageCircle, Mail } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslations } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { SocialLinks } from "@/components/SocialLinks";

const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || "";

export default function Login({
  language = "en",
  theme = "light",
  onLogin,
  onLanguageChange,
  serverStatus: serverStatusProp,
}) {
  const t = useTranslations(language);
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "", password: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [gsiReady, setGsiReady] = useState(false);
  const [pageReady, setPageReady] = useState(false);
  const googleButtonRef = useRef(null);
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

  useEffect(() => {
    let cancelled = false;
    const fontsReady =
      typeof document !== "undefined" && document.fonts?.ready
        ? document.fonts.ready.catch(() => null)
        : Promise.resolve();

    Promise.race([
      fontsReady,
      new Promise((resolve) => setTimeout(resolve, GOOGLE_CLIENT_ID ? 900 : 500)),
    ]).then(() => {
      if (!cancelled) setPageReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // Nudge Render free tier to start waking as soon as the login page opens (cold start can take 1–2 min).
  useEffect(() => {
    if (!isProductionBackendUrl) return;
    warmBackendInBackground();
    const a = setTimeout(() => warmBackendInBackground(), 3000);
    const b = setTimeout(() => warmBackendInBackground(), 8000);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, []);

  // Wait for HTTP only (/health/live). /health also pings Mongo; treating 503 DB errors as "still waking"
  // made login retry take minutes even when Render was already up.
  const waitForBackendReady = async ({ timeoutMs = 120000, intervalMs = 1500 } = {}) => {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const ok = await checkBackendLive();
      if (ok) return true;
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
    return false;
  };

  const handleGoogleSignIn = useCallback(
    async (credential) => {
      if (!credential) return;
      setIsGoogleLoading(true);
      try {
        const response = await api.post("auth/google", { id_token: credential });
        sessionStorage.setItem("auth_token", response.data.access_token);
        onLogin?.(response.data.access_token);
        navigate("/", { replace: true });
      } catch (error) {
        const detail = error?.response?.data?.detail;
        const msg = typeof detail === "string" ? detail : t("login_failed");
        toast.error(msg);
      } finally {
        setIsGoogleLoading(false);
      }
    },
    [onLogin, navigate, t]
  );

  const handleGmailButtonClick = useCallback(() => {
    if (!GOOGLE_CLIENT_ID) {
      toast.info(t("gmail_not_configured") || "Gmail sign-in is not configured yet. Contact your administrator to enable it. You can use username and password to sign in.");
      return;
    }
    if (!window.google?.accounts?.id) {
      toast.info(t("gmail_loading") || "Google sign-in is loading. Please wait a moment and try again.");
      return;
    }
  }, [GOOGLE_CLIENT_ID, t]);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    let cancelled = false;
    const check = () => {
      if (cancelled) return;
      if (window.google?.accounts?.id) {
        setGsiReady(true);
        return true;
      }
      return false;
    };
    if (check()) return;
    const t = setInterval(() => {
      if (check()) clearInterval(t);
    }, 200);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [GOOGLE_CLIENT_ID]);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !gsiReady || !googleButtonRef.current) return;
    if (!window.google?.accounts?.id) return;
    const el = googleButtonRef.current;
    const cleanup = () => {
      if (el?.firstChild) el.innerHTML = "";
    };
    try {
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response) => handleGoogleSignIn(response.credential),
        auto_select: false,
      });
      window.google.accounts.id.renderButton(el, {
        type: "standard",
        theme: "outline",
        size: "large",
        width: 320,
        text: "signin_with",
      });
    } catch (e) {
      cleanup();
    }
    return cleanup;
  }, [GOOGLE_CLIENT_ID, gsiReady, handleGoogleSignIn]);

  const handleLogin = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      let response;
      try {
        response = await api.post("/auth/login", form);
      } catch (error) {
        const isNetwork = !error.response;
        if (isNetwork && isProductionBackendUrl) {
          toast.info("Waking the server and retrying login automatically...");
          const isReady = await waitForBackendReady();
          if (isReady) {
            response = await api.post("/auth/login", form);
          } else {
            throw error;
          }
        } else {
          throw error;
        }
      }
      sessionStorage.setItem("auth_token", response.data.access_token);
      onLogin?.(response.data.access_token);
      navigate("/", { replace: true });
    } catch (error) {
      const status = error?.response?.status;
      const detail = error?.response?.data?.detail;
      const isNetwork = !error.response;
      let msg = t("login_failed");
      if (isNetwork) {
        if (isProductionBackendUrl) {
          msg =
            "Server is waking up (Render free tier). This can take 1–2 minutes after idle. Please wait, then try Login again.";
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
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="login-mubarmij-bg min-h-screen flex flex-col items-center px-6 pt-6 pb-10 relative overflow-hidden"
      data-testid="login-page"
    >
      {theme === "light" && <div className="login-top-sky" aria-hidden />}
      <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-100 dark:opacity-40 z-[1]" aria-hidden>
        <div className="absolute -top-24 -right-20 h-[24rem] w-[24rem] rounded-full bg-purple-500/20 blur-3xl" />
        <div
          className="absolute top-[30%] -left-28 h-[20rem] w-[20rem] rounded-full bg-pink-500/15 blur-3xl"
        />
        <div
          className="absolute bottom-0 left-1/3 h-[14rem] w-[14rem] rounded-full bg-secondary/20 blur-3xl"
        />
      </div>
      <div
        className="absolute inset-0 opacity-[0.14] mix-blend-multiply dark:opacity-[0.06] dark:mix-blend-overlay"
        aria-hidden="true"
        style={{
          backgroundImage: "url('/login-bg.png')",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center",
          backgroundSize: "cover",
        }}
      />
      <div
        className={cn(
          "w-full contents transition-opacity duration-200",
          pageReady ? "opacity-100" : "opacity-0",
        )}
      >
      {/* Left column: logos top, social + Contact Us bottom, same horizontal center */}
      <div className="absolute left-0 top-0 bottom-0 z-10 flex flex-col items-center pt-5 pb-6 px-6 w-56 sm:w-60 bg-transparent border-0 shadow-none" data-testid="login-left-column">
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
          <SocialLinks layout="column" iconSize="h-9 w-11" />
          <a
            href="#contact"
            className="flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground py-2.5 px-5 font-medium text-sm hover:bg-primary/90 transition-all duration-200 hover:translate-y-[-2px] hover:scale-[1.02] hover:shadow-md active:translate-y-0 active:scale-[0.98] shadow-md whitespace-nowrap dark:bg-gradient-to-r dark:from-violet-600 dark:to-purple-600 dark:hover:from-violet-500 dark:hover:to-purple-500"
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
                ? "bg-primary text-white hover:bg-primary/90 shadow-md dark:bg-gradient-to-r dark:from-violet-600 dark:to-purple-600"
                : "bg-white border-2 border-slate-300 text-slate-600 hover:border-primary hover:bg-primary/5 dark:bg-white/5 dark:border-white/20 dark:text-slate-200 dark:hover:bg-white/10"
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
                ? "bg-primary text-white hover:bg-primary/90 shadow-md dark:bg-gradient-to-r dark:from-violet-600 dark:to-purple-600"
                : "bg-white border-2 border-slate-300 text-slate-600 hover:border-primary hover:bg-primary/5 dark:bg-white/5 dark:border-white/20 dark:text-slate-200 dark:hover:bg-white/10"
            )}
            variant={language === "ar" ? "default" : "outline"}
            data-testid="login-lang-ar"
          >
            <Globe className="mr-1 h-4 w-4" />
            AR
          </Button>
      </div>

      <div className="relative z-10 w-full max-w-lg text-center mt-24 mb-10" data-testid="login-welcome">
        <h1 className="font-sans text-3xl sm:text-4xl font-semibold leading-snug tracking-normal text-white drop-shadow-sm dark:text-white">
          {t("login_welcome_title")}
        </h1>
        <p className="mt-4 text-lg max-w-md mx-auto text-muted-foreground font-semibold dark:text-slate-300">
          {t("login_welcome_subtitle")}
        </p>
      </div>

      {/* Login card – white, shadow, rounded (no hover pop on this page) */}
      <div
        className="relative z-10 w-full max-w-md rounded-2xl bg-card border border-border shadow-lg p-8 dark:border-white/10 dark:bg-slate-900/75 dark:backdrop-blur-xl dark:shadow-2xl dark:shadow-black/50"
        data-testid="login-frame"
      >
        <Card noHoverPop className="rounded-xl border-0 shadow-none bg-transparent">
          <CardHeader className="px-0 pt-0">
            <CardTitle className="text-xl text-primary dark:text-cyan-400">{t("login_title")}</CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <form className="space-y-4" onSubmit={handleLogin}>
              <Input
                placeholder={t("username")}
                value={form.username}
                onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))}
                className="h-11 border-slate-200 focus:ring-2 focus:ring-primary/20 dark:border-white/15"
                data-testid="login-username"
              />
              <Input
                type="password"
                placeholder={t("password")}
                value={form.password}
                onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                className="h-11 border-slate-200 focus:ring-2 focus:ring-primary/20 dark:border-white/15"
                data-testid="login-password"
              />
              <Button
                type="submit"
                className="w-full h-11 font-semibold shadow-md"
                data-testid="login-submit"
                disabled={isSubmitting || (backendOk === false && !isProductionBackendUrl)}
              >
                {isSubmitting ? "Signing in..." : t("login")}
              </Button>
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-slate-200 dark:border-white/10" />
                </div>
                <div className="relative flex justify-center text-xs text-slate-500 dark:text-slate-400">
                  <span className="bg-white px-2 dark:bg-slate-900">{t("or_sign_in_with_gmail")}</span>
                </div>
              </div>
              {GOOGLE_CLIENT_ID && gsiReady ? (
                <div ref={googleButtonRef} className="flex justify-center min-h-[44px]" data-testid="google-signin-container" />
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-11 border-slate-300 text-slate-700 hover:bg-slate-50 font-medium dark:border-white/20 dark:text-slate-200 dark:hover:bg-white/5"
                  onClick={handleGmailButtonClick}
                  disabled={isGoogleLoading}
                  data-testid="login-gmail-button"
                >
                  <Mail className="mr-2 h-5 w-5" />
                  {t("sign_in_with_gmail") || "Sign in with Gmail"}
                </Button>
              )}
              <div className="mt-2 min-h-[3.5rem] text-center">
                {isGoogleLoading && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">Signing in with Google...</p>
                )}
                {backendOk === null && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">Checking server status...</p>
                )}
                {backendOk === true && (
                  <p className="text-xs text-green-600 dark:text-emerald-400">Server and database connected</p>
                )}
                {backendOk === false && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    {isProductionBackendUrl
                      ? "Server may be waking (Render free tier: up to ~2 min after idle). You can press Login — the app will retry automatically."
                      : "Backend or database not reachable. Run Start_App.bat (keep it open). If this persists, open MongoDB Atlas → Network Access and allow your current IP (or 0.0.0.0/0 for testing), and ensure the cluster is not paused."}
                  </p>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
      </div>
    </div>
  );
}
