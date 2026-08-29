import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { api } from "../lib/api";

let mockContext;
jest.mock("react-router-dom", () => ({ useOutletContext: () => mockContext }), { virtual: true });
jest.mock("../lib/api", () => {
  const actual = jest.requireActual("../lib/api");
  return { ...actual, api: { get: jest.fn(), post: jest.fn() } };
});
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
const ArabicGrades = require("./ArabicGrades").default;

describe("ArabicGrades load failures", () => {
  let container;
  let root;

  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    mockContext = {
      language: "ar", semester: "semester1", quarter: 1, academicYear: "2026-2027",
      classes: [], schoolSection: "arabic",
    };
    api.get.mockRejectedValue({ response: { status: 409, data: { detail: "arabic_class_grade_required" } } });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    jest.clearAllMocks();
    delete global.IS_REACT_ACT_ENVIRONMENT;
  });

  it("shows a persistent translated error and retry instead of misleading zero metrics", async () => {
    await act(async () => root.render(<ArabicGrades />));
    const error = container.querySelector('[data-testid="arabic-grades-load-error"]');
    expect(error).not.toBeNull();
    expect(error.textContent).toContain("يوجد فصل عربي غير مرتبط برقم صف دراسي");
    expect(error.textContent).toContain("إعادة المحاولة");
    expect(container.textContent).not.toContain("0%");
    await act(async () => error.querySelector("button").click());
    expect(api.get).toHaveBeenCalledTimes(2);
  });
});
