import fs from "node:fs/promises";
import path from "node:path";
import { getBasePath } from "./build-utils.mjs";

const rootDir = process.cwd();
const outDir = path.join(rootDir, "out");
const basePath = getBasePath();
const requiredFiles = [
  "index.html",
  "library/index.html",
  "about/index.html",
  "impressum/index.html",
  "stories/legend-of-alsbans/index.html",
  "reader.html",
  "404.html",
  "assets/styles.css",
  "assets/site.js"
];

const errors = [];

for (const filename of requiredFiles) {
  if (!(await exists(path.join(outDir, filename)))) {
    errors.push(`Missing generated file: out/${filename}`);
  }
}

const htmlFiles = await collectFiles(outDir, ".html");
for (const filePath of htmlFiles) {
  const html = await fs.readFile(filePath, "utf8");
  const relative = path.relative(rootDir, filePath);

  if (html.includes("/Users/") || html.includes("\\Users\\")) {
    errors.push(`${relative} contains a machine-specific path.`);
  }
  if (html.includes("Example Draft")) {
    errors.push(`${relative} exposes the draft example.`);
  }

  for (const match of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
    const reference = match[1];
    if (
      !reference ||
      reference.startsWith("#") ||
      /^(?:https?:|mailto:|tel:|data:)/i.test(reference)
    ) {
      continue;
    }

    const cleanReference = reference.split(/[?#]/)[0];
    if (!cleanReference.startsWith(basePath)) {
      errors.push(`${relative} uses an internal URL outside the base path: ${reference}`);
      continue;
    }

    const artifactPath = cleanReference.slice(basePath.length);
    const target = path.join(
      outDir,
      artifactPath.endsWith("/") ? artifactPath : artifactPath
    );
    const resolved = artifactPath.endsWith("/") ? path.join(target, "index.html") : target;
    if (!(await exists(resolved))) {
      errors.push(`${relative} links to a missing artifact: ${reference}`);
    }
  }
}

if (errors.length) {
  throw new Error(`Static output validation failed:\n- ${errors.join("\n- ")}`);
}

console.log(`Checked ${htmlFiles.length} HTML files: routes, assets, base paths, and draft exclusion are valid.`);

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function collectFiles(directory, extension) {
  const results = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await collectFiles(fullPath, extension)));
    } else if (entry.name.endsWith(extension)) {
      results.push(fullPath);
    }
  }
  return results;
}

