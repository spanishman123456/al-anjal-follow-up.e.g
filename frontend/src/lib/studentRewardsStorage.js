/**
 * Persist student reward toggles (badge, certificate, comment) in localStorage
 * so they are reflected on both Students and Rewards pages.
 */
const STORAGE_KEY = "alanjal_student_rewards";

function getAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw);
    return typeof data === "object" && data !== null ? data : {};
  } catch {
    return {};
  }
}

function save(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (_) {}
}

/** Get reward flags for one student. Returns { badge, certificate, comment } (booleans). */
export function getStudentRewards(studentId) {
  const key = String(studentId);
  const all = getAll();
  const entry = all[key];
  return {
    badge: Boolean(entry?.badge),
    certificate: Boolean(entry?.certificate),
    comment: Boolean(entry?.comment),
  };
}

/** Set one reward type for a student (add or remove). */
export function setStudentReward(studentId, type, value) {
  const key = String(studentId);
  const all = getAll();
  if (!all[key]) all[key] = { badge: false, certificate: false, comment: false };
  all[key][type] = Boolean(value);
  if (!all[key].badge && !all[key].certificate && !all[key].comment) delete all[key];
  save(all);
}

/**
 * Build Sets of student IDs (as strings) that have each reward (for initial state from storage).
 */
export function getRewardSetsFromStorage() {
  const all = getAll();
  const badge = new Set();
  const certificate = new Set();
  const comment = new Set();
  for (const [id, flags] of Object.entries(all)) {
    const key = String(id);
    if (flags.badge) badge.add(key);
    if (flags.certificate) certificate.add(key);
    if (flags.comment) comment.add(key);
  }
  return { badge, certificate, comment };
}
