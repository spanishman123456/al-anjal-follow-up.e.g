import { importStudentsWithPreview } from "./studentEnrollmentImport";

describe("student enrollment import flow", () => {
  it("previews before applying and preserves the exact class scope", async () => {
    const api = { post: jest.fn()
      .mockResolvedValueOnce({ data: { processed_rows: 3, target_class_name: "رابع أ" } })
      .mockResolvedValueOnce({ data: { created_students: 3 } }) };
    const file = new File(["sheet"], "students.xlsx");
    const params = { school_section: "arabic", academic_year: "2026-2027", class_id: "c4a" };
    const result = await importStudentsWithPreview({ api, file, params, confirmImport: jest.fn(() => true) });
    expect(result.data.created_students).toBe(3);
    expect(api.post.mock.calls[0][2].params).toEqual({ ...params, dry_run: true });
    expect(api.post.mock.calls[1][2].params).toEqual(params);
    expect(api.post.mock.calls[0][1].get("file")).toBe(file);
  });

  it("does not apply when preview confirmation is cancelled", async () => {
    const api = { post: jest.fn().mockResolvedValue({ data: { processed_rows: 3 } }) };
    const result = await importStudentsWithPreview({
      api,
      file: new File(["sheet"], "students.xlsx"),
      params: { school_section: "arabic", class_id: "c4a" },
      confirmImport: () => false,
    });
    expect(result.cancelled).toBe(true);
    expect(api.post).toHaveBeenCalledTimes(1);
  });
});
