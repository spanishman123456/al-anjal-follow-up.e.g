import { getLocalizedApiErrorMessage } from "./api";

const copy = {
  load_failed: "تعذر تحميل بيانات الصفحة.",
  load_failed_connection: "تعذر الاتصال بالخادم.",
  arabic_class_grade_required: "يوجد فصل عربي بلا رقم صف.",
};
const t = (key) => copy[key] || key;

describe("getLocalizedApiErrorMessage", () => {
  it("translates stable backend codes instead of displaying raw keys", () => {
    const error = { response: { data: { detail: "arabic_class_grade_required" } } };
    expect(getLocalizedApiErrorMessage(error, t)).toBe("يوجد فصل عربي بلا رقم صف.");
  });

  it("uses a localized connection message for timeouts", () => {
    expect(getLocalizedApiErrorMessage({ code: "ECONNABORTED" }, t)).toBe("تعذر الاتصال بالخادم.");
  });

  it("uses the localized fallback rather than exposing load_failed", () => {
    expect(getLocalizedApiErrorMessage({ response: { status: 500 } }, t)).toBe("تعذر تحميل بيانات الصفحة.");
  });
});
