import React, { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import * as apiModule from "../lib/api";
import { translations } from "../lib/i18n";
import { toast } from "sonner";

const mockNavigate = jest.fn();
// CRA's Jest resolver predates React Router 7's package exports.
jest.mock("react-router-dom", () => ({ useNavigate: () => mockNavigate }), { virtual: true });
jest.mock("../lib/api", () => ({
  __esModule: true,
  api: { post: jest.fn() },
  isProductionBackendUrl: true,
  setStoredAuthToken: jest.fn(),
  warmBackendInBackground: jest.fn(),
  checkBackendHealth: jest.fn(),
  checkBackendLive: jest.fn(),
}));
jest.mock("sonner", () => ({ toast: { error: jest.fn(), info: jest.fn() } }));

process.env.REACT_APP_GOOGLE_CLIENT_ID = "test-client";
const Login = require("./Login").default;

describe("Login", () => {
  let container;
  let root;
  let onLogin;
  let googleCallback;
  const query = (id) => container.querySelector(`[data-testid="${id}"]`);
  const render = async (language = "en", props = {}) => {
    await act(async () => {
      root.render(<StrictMode><Login language={language} onLogin={onLogin} {...props} /></StrictMode>);
    });
  };
  const submit = async () => {
    await act(async () => {
      container.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
  };
  const advance = async (ms) => {
    await act(async () => { jest.advanceTimersByTime(ms); });
  };

  beforeEach(() => {
    jest.useFakeTimers("modern");
    jest.resetAllMocks();
    global.IS_REACT_ACT_ENVIRONMENT = true;
    apiModule.isProductionBackendUrl = true;
    // A hung warm-up must never block the actual authentication request.
    apiModule.warmBackendInBackground.mockReturnValue(new Promise(() => {}));
    window.google = { accounts: { id: {
      initialize: jest.fn(({ callback }) => { googleCallback = callback; }),
      renderButton: jest.fn(),
    } } };
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    onLogin = jest.fn();
  });

  afterEach(async () => {
    await act(async () => { root.unmount(); });
    container.remove();
    delete window.google;
    jest.useRealTimers();
    delete global.IS_REACT_ACT_ENVIRONMENT;
  });

  it.each(["en", "ar"])("has one contact bubble and no idle server-check message in %s", async (language) => {
    await render(language);
    expect(query("login-contact-us").querySelectorAll("svg")).toHaveLength(1);
    expect(query("login-contact-us").textContent).toBe(translations[language].contact_us);
    expect(query("login-contact-us").classList.contains("gap-3")).toBe(true);
    expect(query("login-page").dir).toBe(language === "ar" ? "rtl" : "ltr");
    await advance(95000);
    expect(container.textContent).not.toMatch(/Checking server|Server and database/);
    expect(container.querySelector('[role="status"]')).toBeNull();
    expect(apiModule.checkBackendHealth).not.toHaveBeenCalled();
    expect(apiModule.checkBackendLive).not.toHaveBeenCalled();
    expect(apiModule.warmBackendInBackground).toHaveBeenCalledTimes(1);
  });

  it.each(["en", "ar"])("explains an inactivity logout in %s", async (language) => {
    await render(language, { logoutReason: "idle_timeout" });
    expect(container.textContent).toContain(translations[language].session_idle_timeout_message);
  });

  it("sends entered credentials and enters immediately without waiting for warm-up", async () => {
    apiModule.api.post.mockResolvedValue({ data: { access_token: "test-token" } });
    await render();
    await act(async () => {
      for (const [id, value] of [["login-username", "test-user"], ["login-password", "test-password"]]) {
        const input = query(id);
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
    await submit();
    expect(apiModule.api.post).toHaveBeenCalledWith("/auth/login", { username: "test-user", password: "test-password" }, { timeout: 60000 });
    expect(apiModule.api.post).toHaveBeenCalledTimes(1);
    expect(apiModule.setStoredAuthToken).toHaveBeenCalledWith("test-token");
    expect(onLogin).toHaveBeenCalledWith("test-token");
    expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
  });

  it.each([401, 403, 503])("does not retry an HTTP %s authentication/database error", async (status) => {
    const detail = status === 401 ? "Invalid credentials" : "Account or database unavailable";
    apiModule.api.post.mockRejectedValue({ response: { status, data: { detail } } });
    await render("ar");
    await submit();
    await advance(95000);
    expect(apiModule.api.post).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith(status === 401 ? translations.ar.login_failed : detail);
    expect(onLogin).not.toHaveBeenCalled();
    expect(query("login-submit").disabled).toBe(false);
  });

  it.each([undefined, 502, 504])("retries a connection failure (%s) once, without health probes", async (status) => {
    apiModule.api.post
      .mockRejectedValueOnce(status ? { response: { status } } : new Error("Network Error"))
      .mockResolvedValueOnce({ data: { access_token: "retry-token" } });
    await render();
    await submit();
    await advance(1000);
    expect(apiModule.api.post).toHaveBeenCalledTimes(2);
    expect(onLogin).toHaveBeenCalledWith("retry-token");
    expect(apiModule.checkBackendLive).not.toHaveBeenCalled();
  });

  it("caps timeout attempts at a single 90-second budget and promptly releases the button", async () => {
    apiModule.api.post.mockImplementation((_path, _body, { timeout }) => new Promise((_, reject) => {
      setTimeout(() => reject({ code: "ECONNABORTED" }), timeout);
    }));
    await render("ar");
    await submit();
    expect(query("login-submit").textContent).toBe(translations.ar.login_signing_in);
    expect(container.querySelector('[role="status"]')).toBeNull();
    await advance(4000);
    expect(container.querySelector('[role="status"]').textContent).toBe(translations.ar.login_taking_longer);
    await advance(56000);
    await advance(1000);
    expect(apiModule.api.post.mock.calls[1][2].timeout).toBe(29000);
    await advance(29000);
    expect(toast.error).toHaveBeenCalledWith(translations.ar.login_connection_failed);
    expect(query("login-submit").disabled).toBe(false);
    expect(container.querySelector('[role="status"]')).toBeNull();
    expect(apiModule.checkBackendLive).not.toHaveBeenCalled();
    await advance(180000);
    expect(apiModule.api.post).toHaveBeenCalledTimes(2);
  });

  it("blocks duplicate submissions and Google callbacks while password login is pending", async () => {
    apiModule.api.post.mockReturnValue(new Promise(() => {}));
    await render();
    await submit();
    await submit();
    await act(async () => { googleCallback({ credential: "test-google-credential" }); });
    expect(apiModule.api.post).toHaveBeenCalledTimes(1);
  });

  it("sends Google login directly and preserves pending-approval feedback without retry", async () => {
    apiModule.api.post.mockRejectedValue({ response: { status: 403, data: { detail: "waiting for admin approval" } } });
    await render("ar");
    await act(async () => { googleCallback({ credential: "test-google-credential" }); });
    expect(apiModule.api.post).toHaveBeenCalledWith("/auth/google", { id_token: "test-google-credential" }, { timeout: 60000 });
    expect(toast.error).toHaveBeenCalledWith(translations.ar.gmail_waiting_approval_login);
    expect(onLogin).not.toHaveBeenCalled();
    await advance(95000);
    expect(apiModule.api.post).toHaveBeenCalledTimes(1);
  });

  it("keeps local login at 30 seconds without Render warm-up or retry", async () => {
    apiModule.isProductionBackendUrl = false;
    apiModule.api.post.mockRejectedValue(new Error("Network Error"));
    await render();
    await submit();
    expect(apiModule.api.post.mock.calls[0][2].timeout).toBe(30000);
    expect(apiModule.warmBackendInBackground).not.toHaveBeenCalled();
    await advance(95000);
    expect(apiModule.api.post).toHaveBeenCalledTimes(1);
  });
});
