import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { api } from "../lib/api";

let mockContext;
const mockToast = { success: jest.fn(), error: jest.fn() };

jest.mock("react-router-dom", () => ({ useOutletContext: () => mockContext }), { virtual: true });
jest.mock("../lib/api", () => ({
  api: { get: jest.fn(), post: jest.fn(), delete: jest.fn() },
  getLocalizedApiErrorMessage: jest.fn(() => "failed"),
}));
jest.mock("sonner", () => ({ toast: mockToast }));
jest.mock("../components/layout/PageHeader", () => ({ PageHeader: ({ title, action }) => <header><h1>{title}</h1>{action}</header> }));
jest.mock("../components/ui/button", () => ({ Button: ({ children, ...props }) => <button {...props}>{children}</button> }));
jest.mock("../components/ui/card", () => ({
  Card: ({ children, ...props }) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }) => <div {...props}>{children}</div>,
  CardHeader: ({ children, ...props }) => <div {...props}>{children}</div>,
  CardTitle: ({ children, ...props }) => <h2 {...props}>{children}</h2>,
}));
jest.mock("../components/ui/input", () => ({ Input: (props) => <input {...props} /> }));
jest.mock("../components/ui/progress", () => ({ Progress: ({ value }) => <div data-value={value} /> }));
jest.mock("../components/ui/select", () => ({
  Select: ({ value, onValueChange, children }) => <select value={value} onChange={(event) => onValueChange(event.target.value)}>{children}</select>,
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }) => <>{children}</>,
  SelectItem: ({ value, children }) => <option value={value}>{children}</option>,
}));
jest.mock("../components/ScoreSheetImportControl", () => ({ ScoreSheetImportControl: () => null }));
jest.mock("../components/LoadErrorCard", () => ({ LoadErrorCard: () => <div>load error</div> }));
jest.mock("../components/ui/dialog", () => ({
  Dialog: ({ open, children }) => open ? <div>{children}</div> : null,
  DialogContent: ({ children, ...props }) => <div {...props}>{children}</div>,
  DialogDescription: ({ children }) => <p>{children}</p>,
  DialogFooter: ({ children }) => <div>{children}</div>,
  DialogHeader: ({ children }) => <div>{children}</div>,
  DialogTitle: ({ children }) => <h2>{children}</h2>,
}));

const ArabicGrades = require("./ArabicGrades").default;

describe("ArabicGrades smart bulk grading", () => {
  let container;
  let root;

  beforeEach(() => {
    jest.clearAllMocks();
    global.IS_REACT_ACT_ENVIRONMENT = true;
    mockContext = {
      language: "ar", semester: "semester1", quarter: 1, academicYear: "2026-2027",
      classes: [{ id: "c4a", name: "رابع أ" }], schoolSection: "arabic",
    };
    api.get.mockResolvedValue({
      data: {
        students: [{
          id: "s1", full_name: "طالب أول", class_id: "c4a", class_name: "رابع أ",
          educational_stage: "primary", exam_raw_max: 15,
          performance_tasks: null, participation: null, interaction: null, attendance: null,
          theory_test_1: null, theory_test_2: null, practical_test: null,
        }],
        total_students: 1, students_with_grades: 0, students_without_grades: 1,
        completion_percentage: 0, test_completion: {}, migration: {},
      },
    });
    api.post.mockResolvedValue({ data: { status: "saved" } });
    api.delete.mockResolvedValue({ data: { grades_deleted: 1, class_name: "رابع أ" } });
    window.confirm = jest.fn(() => true);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    delete global.IS_REACT_ACT_ENVIRONMENT;
  });

  it("fills the selected column with the maximum for the selected class and saves it", async () => {
    await act(async () => root.render(<ArabicGrades />));
    const selects = container.querySelectorAll("select");
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(selects[0], "c4a");
      selects[0].dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(async () => container.querySelector('[data-testid="arabic-fill-max-column"]').click());

    const performanceInput = container.querySelector('input[aria-label="طالب أول المهام الأدائية"]');
    expect(performanceInput.value).toBe("10");
    expect(mockToast.success).toHaveBeenCalledWith(expect.stringContaining("طالبًا"));

    const saveButton = [...container.querySelectorAll("button")].find((button) => button.textContent.includes("حفظ الدرجات"));
    await act(async () => saveButton.click());
    expect(api.post).toHaveBeenCalledWith("/arabic/grades/bulk", expect.objectContaining({
      academic_year: "2026-2027",
      semester: 1,
      quarter: 1,
      updates: [expect.objectContaining({ student_id: "s1", performance_tasks: 10 })],
    }));
  });

  it("deletes only the selected class grades for the displayed Arabic term", async () => {
    api.get.mockResolvedValue({
      data: {
        students: [{
          id: "s1", full_name: "طالب أول", class_id: "c4a", class_name: "رابع أ",
          educational_stage: "primary", exam_raw_max: 15,
          performance_tasks: 10, participation: null, interaction: null, attendance: null,
          theory_test_1: null, theory_test_2: null, practical_test: null,
        }],
        total_students: 1, students_with_grades: 1, students_without_grades: 0,
        completion_percentage: 0, test_completion: {}, migration: {},
      },
    });
    await act(async () => root.render(<ArabicGrades />));
    const classSelect = container.querySelector("select");
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(classSelect, "c4a");
      classSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(async () => container.querySelector('[data-testid="arabic-clear-class-grades"]').click());
    expect(container.textContent).toContain("لن تتأثر الفصول أو الفترات الأخرى");
    await act(async () => container.querySelector('[data-testid="arabic-clear-class-grades-confirm"]').click());
    expect(api.delete).toHaveBeenCalledWith("/arabic/grades", { params: {
      academic_year: "2026-2027", semester: 1, quarter: 1, class_id: "c4a",
    } });
  });
});
