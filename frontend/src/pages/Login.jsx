import { useState, useEffect, useRef, useCallback, memo } from "react";
import { useNavigate } from "react-router-dom";
import { api, isProductionBackendUrl, setStoredAuthToken, warmBackendInBackground } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Globe, MessageCircle, Mail } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslations } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { SocialLinks } from "@/components/SocialLinks";

const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || "";

const isConnectionError = (error) =>
  !error?.response || [502, 504].includes(error.response.status);

// Send credentials immediately. Allow one direct retry for a connection failure,
// within a single 90-second budget, without waiting on separate health probes.
async function submitLoginRequest(path, payload) {
  const deadline = Date.now() + (isProductionBackendUrl ? 90000 : 30000);
  try {
    return await api.post(path, payload, { timeout: isProductionBackendUrl ? 60000 : 30000 });
  } catch (error) {
    if (!isProductionBackendUrl || !isConnectionError(error)) throw error;
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw error;
    return api.post(path, payload, { timeout: remaining });
  }
}

function LoginPage({
  language = "en",
  theme = "light",
  onLogin,
  onLanguageChange,
  logoutReason = null,
}) {
  const t = useTranslations(language);
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "", password: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isSlowLogin, setIsSlowLogin] = useState(false);
  const [gsiReady, setGsiReady] = useState(false);
  const googleButtonRef = useRef(null);
  const handleGoogleSignInRef = useRef(null);
  const loginInFlightRef = useRef(false);
  const warmupStartedRef = useRef(false);
  const isLoggingIn = isSubmitting || isGoogleLoading;

  useEffect(() => {
    if (!isProductionBackendUrl || warmupStartedRef.current) return;
    warmupStartedRef.current = true;
    // Start waking the host while the user types, never gate login on this ping.
    warmBackendInBackground();
  }, []);

  useEffect(() => {
    if (!isLoggingIn) return;
    const timer = setTimeout(() => setIsSlowLogin(true), 4000);
    return () => clearTimeout(timer);
  }, [isLoggingIn]);

  const handleGoogleSignIn = useCallback(
    async (credential) => {
      if (!credential || loginInFlightRef.current) return;
      loginInFlightRef.current = true;
      setIsSlowLogin(false);
      setIsGoogleLoading(true);
      try {
        const response = await submitLoginRequest("/auth/google", { id_token: credential });
        setStoredAuthToken(response.data.access_token);
        onLogin?.(response.data.access_token);
        navigate("/", { replace: true });
      } catch (error) {
        const detail = error?.response?.data?.detail;
        let msg = isConnectionError(error)
          ? t("login_connection_failed")
          : typeof detail === "string" ? detail : t("login_failed");
        if (typeof detail === "string") {
          if (detail.includes("request was sent to the administrator")) {
            msg = t("gmail_pending_approval_login");
          } else if (detail.includes("waiting for admin approval")) {
            msg = t("gmail_waiting_approval_login");
          } else if (detail.includes("request was rejected")) {
            msg = t("gmail_rejected_login");
          }
        }
        toast.error(msg);
      } finally {
        loginInFlightRef.current = false;
        setIsGoogleLoading(false);
      }
    },
    [onLogin, navigate, t]
  );
  handleGoogleSignInRef.current = handleGoogleSignIn;

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
    if (googleButtonRef.current.dataset.gsiRendered === "1") return;
    const el = googleButtonRef.current;
    try {
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response) => handleGoogleSignInRef.current?.(response.credential),
        auto_select: false,
      });
      window.google.accounts.id.renderButton(el, {
        type: "standard",
        theme: "outline",
        size: "large",
        width: 320,
        text: "signin_with",
      });
      el.dataset.gsiRendered = "1";
    } catch {
      delete el.dataset.gsiRendered;
    }
  }, [GOOGLE_CLIENT_ID, gsiReady]);

  const handleLogin = async (event) => {
    event.preventDefault();
    if (loginInFlightRef.current) return;
    loginInFlightRef.current = true;
    setIsSlowLogin(false);
    setIsSubmitting(true);
    try {
      const response = await submitLoginRequest("/auth/login", form);
      setStoredAuthToken(response.data.access_token);
      onLogin?.(response.data.access_token);
      navigate("/", { replace: true });
    } catch (error) {
      const detail = error?.response?.data?.detail;
      let msg = t("login_failed");
      if (isConnectionError(error)) {
        msg = t("login_connection_failed");
      } else if (detail === "Invalid credentials") {
        msg = t("login_failed");
      } else if (typeof detail === "string") {
        msg = detail;
      }
      toast.error(msg);
    } finally {
      loginInFlightRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="login-mubarmij-bg min-h-screen flex flex-col items-center px-6 pt-6 pb-10 relative overflow-hidden"
      data-testid="login-page"
      dir={language === "ar" ? "rtl" : "ltr"}
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
            className="flex items-center justify-center gap-3 rounded-lg bg-primary text-primary-foreground py-2.5 px-5 font-medium text-sm hover:bg-primary/90 transition-all duration-200 hover:translate-y-[-2px] hover:scale-[1.02] hover:shadow-md active:translate-y-0 active:scale-[0.98] shadow-md whitespace-nowrap dark:bg-gradient-to-r dark:from-violet-600 dark:to-purple-600 dark:hover:from-violet-500 dark:hover:to-purple-500"
            data-testid="login-contact-us"
          >
            <MessageCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
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
            {logoutReason === "session_replaced" && (
              <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                {t("session_replaced_message")}
              </div>
            )}
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
                disabled={isLoggingIn}
              >
                {isSubmitting ? t("login_signing_in") : t("login")}
              </Button>
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-slate-200 dark:border-white/10" />
                </div>
                <div className="relative flex justify-center text-xs text-slate-500 dark:text-slate-400">
                  <span className="bg-white px-2 dark:bg-slate-900">{t("or_sign_in_with_gmail")}</span>
                </div>
              </div>
              <div className="relative my-4 flex min-h-[44px] w-full items-center justify-center">
                <div
                  ref={googleButtonRef}
                  className={cn(
                    "flex w-full justify-center",
                    isLoggingIn && "pointer-events-none opacity-50",
                    (!GOOGLE_CLIENT_ID || !gsiReady) && "pointer-events-none opacity-0",
                  )}
                  aria-hidden={!GOOGLE_CLIENT_ID || !gsiReady}
                  aria-disabled={isLoggingIn}
                  data-testid="google-signin-container"
                />
                {(!GOOGLE_CLIENT_ID || !gsiReady) && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 w-full border-slate-300 text-slate-700 hover:bg-slate-50 font-medium dark:border-white/20 dark:text-slate-200 dark:hover:bg-white/5"
                      onClick={handleGmailButtonClick}
                      disabled={isLoggingIn}
                      data-testid="login-gmail-button"
                    >
                      <Mail className="mr-2 h-5 w-5" />
                      {t("sign_in_with_gmail") || "Sign in with Gmail"}
                    </Button>
                  </div>
                )}
              </div>
              {isLoggingIn && isSlowLogin && (
                <p role="status" className="mt-2 text-center text-xs text-slate-500 dark:text-slate-400">
                  {t("login_taking_longer")}
                </p>
              )}
              {isGoogleLoading && (
                <p className="mt-1 text-center text-xs text-slate-500 dark:text-slate-400">{t("login_google_signing_in")}</p>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default memo(LoginPage);
