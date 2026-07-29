import path from "node:path";

export function getBasePath() {
  if (process.env.BASE_PATH) {
    return normalizeBasePath(process.env.BASE_PATH);
  }

  const repository = process.env.GITHUB_REPOSITORY;
  if (process.env.GITHUB_ACTIONS === "true" && repository?.includes("/")) {
    const [owner, name] = repository.split("/");
    if (name.toLowerCase() === `${owner}.github.io`.toLowerCase()) {
      return "/";
    }
    return normalizeBasePath(`/${name}/`);
  }

  return "/";
}

export function normalizeBasePath(value) {
  const clean = `/${String(value).trim().replace(/^\/+|\/+$/g, "")}/`;
  return clean === "//" ? "/" : clean;
}

export function withBase(basePath, value = "") {
  const clean = String(value).replace(/^\/+/, "");
  return `${basePath}${clean}`;
}

export function outputPathForUrl(outDir, route) {
  const clean = String(route).replace(/^\/+|\/+$/g, "");
  return clean ? path.join(outDir, clean, "index.html") : path.join(outDir, "index.html");
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function formatDate(value) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  }).format(new Date(`${value}T00:00:00Z`));
}

