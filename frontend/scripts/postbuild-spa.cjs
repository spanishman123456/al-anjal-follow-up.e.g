/**
 * Make SPA deep links resilient on static hosts by generating fallback files.
 * Some hosts serve 404.html for unknown paths; others need a concrete file at
 * the requested path. We do both so routes still open in new tabs reliably.
 */
const fs = require("fs");
const path = require("path");

const buildDir = path.join(__dirname, "..", "build");
const indexHtml = path.join(buildDir, "index.html");
const dest = path.join(buildDir, "404.html");

const deepLinkPaths = [
  "students",
  "assessment-marks",
  "assessment-marks-q2",
  "final-exams-assessment",
  "final-exams-assessment-q2",
  "teachers",
  "classes",
  "analytics",
  "remedial-plans",
  "rewards",
  "reports",
  "notifications",
  "calendar",
  "settings",
];

if (fs.existsSync(indexHtml)) {
  fs.copyFileSync(indexHtml, dest);
  for (const routePath of deepLinkPaths) {
    const routeDir = path.join(buildDir, routePath);
    fs.mkdirSync(routeDir, { recursive: true });
    fs.copyFileSync(indexHtml, path.join(routeDir, "index.html"));
  }
  // eslint-disable-next-line no-console
  console.log("postbuild-spa: generated SPA fallback files");
}
