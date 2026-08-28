import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { api } from "../lib/api";
import { changedBaselineMarks, parseBaselineMark } from "../lib/baselineScores";
import { buildNavigationGroups } from "../lib/navigationConfig";
import { getTranslation } from "../lib/i18n";

let mockContext;
const mockSetSearch = jest.fn();
const mockSearch = new URLSearchParams();
jest.mock("react-router-dom", () => ({
  useOutletContext: () => mockContext,
  useSearchParams: () => [mockSearch, mockSetSearch],
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
}), { virtual: true });
jest.mock("../lib/api", () => ({ api: { get: jest.fn(), patch: jest.fn(), post: jest.fn() } }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
const BaselineAssessments = require("./BaselineAssessments").default;

const fixture = () => ({
  snapshot_id: "a".repeat(64), record: { id: "r1", revision: 1, max_score: 20 },
  labels: { total: "Total", graded: "Scored", mean: "Mean", completion: "Completion", student: "Student", class: "Class", score: "Score", percent: "Percentage", level: "Level", subject: "Computer Science", rules: "Rules", scope_note: "Test only", students: "Student percentages", distribution: "Distribution", class_means: "Class means", comparison: "Comparison" },
  stats: { total: 3, graded: 2, mean: 37.5, completion: 66.67 },
  classes: [{ id: "c1", name: "4A", mean: 37.5 }],
  distribution: [{ key: "high", label: "High", count: 1, percentage: 33.33 }],
  insights: [{ title: "Summary", body: "One high student" }],
  students: [
    { id: "s1", full_name: "طالب 01", class_id: "c1", class_name: "4A", score: 15, score_label: "15 / 20", percentage: 75, level: "high", level_label: "High", class_mean: 37.5, insights: [{ title: "Interpretation", body: "Student scored 75%" }] },
    { id: "s2", full_name: "Student 02", class_id: "c1", class_name: "4A", score: null, score_label: "- / 20", percentage: null, level: "missing", level_label: "Not scored", class_mean: 37.5, insights: [] },
    { id: "s3", full_name: "Student 03", class_id: "c1", class_name: "4A", score: 0, score_label: "0 / 20", percentage: 0, level: "support", level_label: "Needs support", class_mean: 37.5, insights: [] },
  ],
});

describe("baseline inputs and navigation", () => {
  it("preserves blank versus zero and rejects impossible numbers", () => {
    expect(parseBaselineMark("", 20)).toBeNull();
    expect(parseBaselineMark("0", 20)).toBe(0);
    expect(parseBaselineMark("15.5", 20)).toBe(15.5);
    expect(parseBaselineMark("١٥٫٥", 20)).toBe(15.5);
    for (const raw of ["NaN", "Infinity", "-1", "21", "abc"]) expect(() => parseBaselineMark(raw, 20)).toThrow();
    expect(changedBaselineMarks(fixture().students, { s1: "15", s2: "0", s3: "" }, 20)).toEqual({ s2: 0, s3: null });
  });
  it.each(["en", "ar"])("keeps both section labels and existing assessment links in %s", (lang) => {
    for (const section of ["arabic", "international"]) {
      const groups = buildNavigationGroups({ t: (key) => getTranslation(lang, key), quarter: 2, schoolSection: section, roleName: "Teacher" });
      const items = groups.find((g) => g.id === "assessments").items;
      expect(items.find((i) => i.to === "/baseline-scores").label).toBe(getTranslation(lang, section === "arabic" ? "baseline_diagnostic" : "baseline_pre"));
      expect(items.some((i) => i.to === (section === "arabic" ? "/arabic-grades" : "/assessment-marks-q2"))).toBe(true);
    }
  });
});

describe("baseline page", () => {
  let container, root;
  beforeEach(() => {
    jest.clearAllMocks(); sessionStorage.clear();
    global.IS_REACT_ACT_ENVIRONMENT = true;
    mockContext = { language: "en", schoolSection: "international", academicYear: "2026-2027", semester: "semester2", quarter: 1, profile: { id: "t1" }, classes: [{ id: "c1", name: "4A" }], setSemester: jest.fn(), setQuarter: jest.fn() };
    api.get.mockImplementation(async (url) => ({ data: url === "/baseline-assessments" ? [{ id: "r1", title: "Baseline", teacher_name: "Teacher", max_score: 20, classes: [{ id: "c1", name: "4A" }] }] : fixture() }));
    api.patch.mockResolvedValue({ data: { revision: 2 } });
    window.confirm = jest.fn(() => true);
    container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
  });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); delete global.IS_REACT_ACT_ENVIRONMENT; });
  const render = async (view) => { await act(async () => root.render(<BaselineAssessments view={view} />)); };
  const button = (text) => [...container.querySelectorAll("button")].find((b) => b.textContent === text);
  async function changeInput(index, value) {
    const input = container.querySelectorAll('input[inputmode="decimal"]')[index];
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); });
  }
  it.each(["en", "ar"])("starts maximum spinner at 0.01 and formats whole/decimal marks to two places in %s", async (lang) => {
    mockContext.language = lang;
    await render();
    await act(async () => button(getTranslation(lang, "baseline_setup")).click());
    const maximum = container.querySelector('[data-testid="baseline-max-score"]');
    expect(maximum.placeholder).toBe("0.00");
    expect(maximum.value).toBe("");
    await act(async () => {
      maximum.stepUp();
      maximum.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(maximum.value).toBe("0.01");
    for (const [raw, formatted] of [["30", "30.00"], ["30.5", "30.50"], ["0.29", "0.29"], ["0", "0.00"]]) {
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(maximum, raw);
        maximum.dispatchEvent(new Event("input", { bubbles: true }));
      });
      await act(async () => maximum.dispatchEvent(new FocusEvent("focusout", { bubbles: true })));
      expect(maximum.value).toBe(formatted);
    }
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(maximum, "");
      maximum.dispatchEvent(new Event("input", { bubbles: true }));
      maximum.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    });
    expect(maximum.value).toBe("");
  });
  it("rejects over-precise or zero maxima without rounding or posting them", async () => {
    await render();
    await act(async () => button("Set up mark entry").click());
    const maximum = container.querySelector('[data-testid="baseline-max-score"]');
    const title = container.querySelector("form input");
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(title, "Computer science");
      title.dispatchEvent(new Event("input", { bubbles: true }));
      container.querySelector('form input[type="checkbox"]').click();
    });
    for (const raw of ["0.000001", "30.125", "0"]) {
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(maximum, raw);
        maximum.dispatchEvent(new Event("input", { bubbles: true }));
      });
      expect(maximum.checkValidity()).toBe(false);
      await act(async () => maximum.dispatchEvent(new FocusEvent("focusout", { bubbles: true })));
      expect(maximum.value).toBe(raw === "0" ? "0.00" : raw);
      await act(async () => container.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    }
    expect(api.post).not.toHaveBeenCalled();
  });
  it("loads the global scope and preserves unscored / zero", async () => {
    await render();
    expect(api.get).toHaveBeenCalledWith("/baseline-assessments", { params: { school_section: "international", academic_year: "2026-2027", semester: 2, quarter: 1 } });
    const inputs = container.querySelectorAll('input[inputmode="decimal"]');
    expect([...inputs].map((i) => i.value)).toEqual(["15", "", "0"]);
    expect(container.textContent).toContain("Q3");
    expect(button("Save marks").disabled).toBe(true);
  });
  it("saves only changed totals with the displayed revision", async () => {
    await render(); await changeInput(1, "10");
    await act(async () => button("Save marks").click());
    expect(api.patch).toHaveBeenCalledWith("/baseline-assessments/r1/scores", { revision: 1, scores: { s2: 10 } });
  });
  it("blocks invalid scores and protects drafts across scope changes", async () => {
    await render(); await changeInput(1, "21");
    expect(button("Save marks").disabled).toBe(true);
    mockContext = { ...mockContext, schoolSection: "arabic" }; await render();
    mockContext = { ...mockContext, schoolSection: "international" }; await render();
    expect(container.querySelectorAll('input[inputmode="decimal"]')[1].value).toBe("21");
  });
  it("keeps edits and blocks saving on a concurrent update", async () => {
    api.patch.mockRejectedValue({ response: { status: 409, data: { detail: "baseline_conflict" } } });
    await render(); await changeInput(0, "16");
    await act(async () => button("Save marks").click());
    expect(container.textContent).toContain("another window");
    expect(container.querySelector('input[inputmode="decimal"]').value).toBe("16");
    expect(button("Save marks").disabled).toBe(true);
  });
  it.each(["en", "ar"])("renders the server donut and horizontal chart values in %s", async (lang) => {
    mockContext.language = lang; await render("analytics");
    expect(container.querySelector('[data-testid="baseline-page"]').dir).toBe(lang === "ar" ? "rtl" : "ltr");
    expect(container.querySelector('[data-testid="baseline-student-donut"]').textContent).toContain("75%");
    expect(container.querySelectorAll('[data-testid="baseline-bar"]').length).toBe(5);
    const ring = container.querySelector('[data-testid="baseline-student-donut"] circle[pathLength]');
    expect(ring.getAttribute("stroke-dasharray")).toBe("75 100");
  });
});
