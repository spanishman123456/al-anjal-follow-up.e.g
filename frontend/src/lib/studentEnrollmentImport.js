export async function importStudentsWithPreview({ api, file, params, confirmImport }) {
  const makeFormData = () => {
    const formData = new FormData();
    formData.append("file", file);
    return formData;
  };
  const requestConfig = { headers: { "Content-Type": "multipart/form-data" } };
  const preview = await api.post("/import/excel", makeFormData(), {
    ...requestConfig,
    params: { ...params, dry_run: true },
  });
  if (!confirmImport(preview.data)) return { cancelled: true, preview: preview.data };
  const applied = await api.post("/import/excel", makeFormData(), {
    ...requestConfig,
    params,
  });
  return { cancelled: false, preview: preview.data, data: applied.data };
}
