/**
 * Copy CRA's index.html to 404.html so deep links may work on hosts that
 * serve 404.html for unknown paths. Render Static Sites still need a dashboard
 * rewrite (or Blueprint routes in render.yaml); this is an extra safety net.
 */
const fs = require("fs");
const path = require("path");

const buildDir = path.join(__dirname, "..", "build");
const indexHtml = path.join(buildDir, "index.html");
const dest = path.join(buildDir, "404.html");

if (fs.existsSync(indexHtml)) {
  fs.copyFileSync(indexHtml, dest);
  // eslint-disable-next-line no-console
  console.log("postbuild-spa: copied build/index.html -> build/404.html");
}
