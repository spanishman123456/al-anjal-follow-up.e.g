import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { api } from "../lib/api";

let mockContext;
const mockToast = { success: jest.fn(), error: jest.fn() };

jest.mock("react-router-dom", () => ({ useOutletContext: () => mockContext }), { virtual: true });
jest.mock("../lib/api", () => ({
  api: { get: jest.fn(), post: jest.fn(), delete: jest.fn() },
  getLocalizedApiErrorMessage: jest.fn((error) => error?.response?.data?.detail || "failed"),
}));
jest.mock("sonner", () => ({ toast: mockToast }));
jest.mock("../components/layout/PageHeader", () => ({ PageHeader: ({ title, action }) => <header><h1>{title}</h1>{action}</header> }));
jest.mock("../components/ui/button", () => ({ Button: ({ children, ...props }) => <button {...props}>{children}</button> }));
jest.mock("../components/ui/card", () => ({ Card: ({ children, ...props }) => <div {...props}>{children}</div>, CardContent: ({ children, ...props }) => <div {...props}>{children}</div> }));
jest.mock("../components/ui/input", () => ({ Input: (props) => <input {...props} /> }));
jest.mock("../components/ui/select", () => ({
  Select: ({ value, onValueChange, children }) => <select value={value} onChange={(event) => onValueChange(event.target.value)}>{children}</select>,
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }) => <>{children}</>,
  SelectItem: ({ value, children }) => <option value={value}>{children}</option>,
}));
jest.mock("../components/ui/dialog", () => ({
  Dialog: ({ children }) => <>{children}</>, DialogContent: ({ children }) => <>{children}</>,
  DialogFooter: ({ children }) => <>{children}</>, DialogHeader: ({ children }) => <>{children}</>,
  DialogTitle: ({ children }) => <>{children}</>,
}));
jest.mock("../components/LoadErrorCard", () => ({ LoadErrorCard: () => <div>load error</div> }));

const ArabicStudents = require("./ArabicStudents").default;

describe("Arabic student import safeguards", () => {
  let container;
  let root;

  beforeEach(() => {
    jest.clearAllMocks();
    global.IS_REACT_ACT_ENVIRONMENT = true;
    mockContext = {
      language: "ar",
      academicYear: "2026-2027",
      classes: [{ id: "c4a", name: "رابع أ" }, { id: "c6b", name: "سادس ب" }],
      loadClasses: jest.fn(),
      profile: { role_name: "Admin" },
    };
    api.get.mockResolvedValue({ data: [] });
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

  it("requires one selected class, previews without writes, then applies to that exact class", async () => {
    api.post
      .mockResolvedValueOnce({ data: { processed_rows: 30, target_class_name: "رابع أ", dry_run: true } })
      .mockResolvedValueOnce({ data: { created_students: 30, updated_students: 0, repaired_students: 0, created_classes: 0, skipped_rows: 0 } });
    await act(async () => root.render(<ArabicStudents />));

    const importButton = container.querySelector('[data-testid="arabic-students-import"]');
    await act(async () => importButton.click());
    expect(mockToast.error).toHaveBeenCalled();
    expect(api.post).not.toHaveBeenCalled();

    const classSelect = container.querySelector("select");
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(classSelect, "c4a");
      classSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });
    const fileInput = container.querySelector('[data-testid="arabic-students-import-input"]');
    const file = new File(["xlsx"], "رابع أ.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    Object.defineProperty(fileInput, "files", { configurable: true, value: [file] });
    await act(async () => fileInput.dispatchEvent(new Event("change", { bubbles: true })));

    expect(api.post).toHaveBeenCalledTimes(2);
    expect(api.post.mock.calls[0][2].params).toEqual({ school_section: "arabic", academic_year: "2026-2027", class_id: "c4a", dry_run: true });
    expect(api.post.mock.calls[1][2].params).toEqual({ school_section: "arabic", academic_year: "2026-2027", class_id: "c4a" });
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining("رابع أ"));
  });

  it("uses Arabic table labels and deletes only the selected class roster", async () => {
    api.get.mockResolvedValue({
      data: [
        { id: "s1", full_name: "طالب أول", class_id: "c6b", class_name: "سادس ب" },
        { id: "s2", full_name: "طالب ثان", class_id: "c6b", class_name: "سادس ب" },
      ],
    });
    api.delete.mockResolvedValue({ data: { students_deleted: 2, target_class_name: "سادس ب" } });
    await act(async () => root.render(<ArabicStudents />));

    expect(container.querySelector("thead").textContent).toContain("اسم الطالب");
    expect(container.querySelector("thead").textContent).toContain("الصف");
    expect(container.querySelector("tbody").textContent).toContain("حذف");

    const classSelect = container.querySelector("select");
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(classSelect, "c6b");
      classSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(async () => container.querySelector('[data-testid="delete-class-students-button"]').click());
    await act(async () => container.querySelector('[data-testid="delete-class-students-confirm"]').click());

    expect(api.delete).toHaveBeenCalledWith("/students", {
      params: { school_section: "arabic", academic_year: "2026-2027", class_id: "c6b" },
    });
  });
});
