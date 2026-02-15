/**
 * Patch schema-utils to fix "Unknown keyword formatMinimum" error.
 * formatMinimum/formatMaximum were removed from ajv-keywords v5 (moved to ajv-formats).
 * Affects: fork-ts-checker-webpack-plugin, babel-loader, and other packages.
 */
const fs = require('fs');
const path = require('path');

const targetPaths = [
  'fork-ts-checker-webpack-plugin/node_modules/schema-utils/dist/validate.js',
  'babel-loader/node_modules/schema-utils/dist/validate.js',
  'schema-utils/dist/validate.js',
];

const oldPatterns = [
  'ajvKeywords(ajv, ["instanceof", "formatMinimum", "formatMaximum", "patternRequired"]);',
  "ajvKeywords(ajv, ['instanceof', 'formatMinimum', 'formatMaximum', 'patternRequired']);",
];

const newPatterns = [
  'ajvKeywords(ajv, ["instanceof", "patternRequired"]); // formatMinimum/formatMaximum fix',
  "ajvKeywords(ajv, ['instanceof', 'patternRequired']); // formatMinimum/formatMaximum fix",
];

const nodeModules = path.join(__dirname, '../node_modules');
let patched = 0;

for (const target of targetPaths) {
  const targetPath = path.join(nodeModules, target);
  if (fs.existsSync(targetPath)) {
    let content = fs.readFileSync(targetPath, 'utf8');
    let changed = false;
    for (let i = 0; i < oldPatterns.length; i++) {
      if (content.includes(oldPatterns[i])) {
        content = content.replace(oldPatterns[i], newPatterns[i]);
        changed = true;
      }
    }
    if (changed) {
      fs.writeFileSync(targetPath, content);
      patched++;
      console.log('Patched:', target);
    }
  }
}

if (patched > 0) {
  console.log('schema-utils formatMinimum fix: patched', patched, 'file(s)');
}
