import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { api } from "../lib/api";

jest.mock("../lib/api", () => ({ api: { post: jest.fn() } }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
const { ScoreSheetImportControl } = require("./ScoreSheetImportControl");

const messages = {
  score_sheet_import_excel: "Import Excel",
  score_sheet_importing: "Reading",
  score_sheet_no_matches: "No matches",
  score_sheet_confirm: "{matched}/{overwrite}/{unmatched}/{invalid}",
  score_sheet_imported: "Imported {count}",
  score_sheet_import_failed: "Failed",
};

describe("ScoreSheetImportControl", () => {
  let container;
  let root;

  beforeEach(() => {
    jest.clearAllMocks();
    global.IS_REACT_ACT_ENVIRONMENT = true;
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

  it("previews before applying and keeps the selected target and scope", async () => {
    api.post
      .mockResolvedValueOnce({ data: { matched_count: 2, overwrite_count: 1, unmatched_count: 0, ambiguous_count: 0, duplicate_count: 0, invalid_count: 0 } })
      .mockResolvedValueOnce({ data: { imported_count: 2 } });
    const onImported = jest.fn();
    await act(async () => root.render(
      <ScoreSheetImportControl
        t={(key) => messages[key] || key}
        params={{ context: "international_quiz", week_id: "w1" }}
        targets={[{ value: "quiz1", label: "Quiz 1" }]}
        onImported={onImported}
      />,
    ));
    const file = new File(["content"], "scores.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const input = container.querySelector('input[type="file"]');
    await act(async () => {
      Object.defineProperty(input, "files", { configurable: true, value: [file] });
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(api.post).toHaveBeenCalledTimes(2);
    expect(api.post.mock.calls[0][2].params).toEqual({ context: "international_quiz", week_id: "w1", target: "quiz1", apply: false });
    expect(api.post.mock.calls[1][2].params).toEqual({ context: "international_quiz", week_id: "w1", target: "quiz1", apply: true });
    expect(window.confirm).toHaveBeenCalledWith("2/1/0/0");
    expect(onImported).toHaveBeenCalledWith({ imported_count: 2 });
  });

  it("does not apply when the preview has no matches", async () => {
    api.post.mockResolvedValueOnce({ data: { matched_count: 0 } });
    await act(async () => root.render(
      <ScoreSheetImportControl
        t={(key) => messages[key] || key}
        params={{ context: "arabic_theory" }}
        targets={[{ value: "theory_test_1", label: "Theory 1" }]}
      />,
    ));
    const input = container.querySelector('input[type="file"]');
    await act(async () => {
      Object.defineProperty(input, "files", { configurable: true, value: [new File(["x"], "scores.xlsx")] });
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(window.confirm).not.toHaveBeenCalled();
  });
});
