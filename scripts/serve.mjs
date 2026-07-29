import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { getBasePath } from "./build-utils.mjs";

const rootDir = process.cwd();
const outDir = path.join(rootDir, "out");
const basePath = getBasePath();
const port = Number(process.env.PORT || 4173);
const host = "127.0.0.1";
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp"
};

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${request.headers.host || host}`);
    let pathname = decodeURIComponent(url.pathname);

    if (basePath !== "/" && pathname.startsWith(basePath)) {
      pathname = `/${pathname.slice(basePath.length)}`;
    }

    const normalized = path.posix.normalize(pathname).replace(/^\/+/, "");
    let filePath = path.join(outDir, normalized);

    if (pathname.endsWith("/")) {
      filePath = path.join(filePath, "index.html");
    } else if (!(await exists(filePath))) {
      const directoryIndex = path.join(filePath, "index.html");
      filePath = (await exists(directoryIndex))
        ? directoryIndex
        : path.join(outDir, "404.html");
    }

    if (!filePath.startsWith(outDir)) {
      throw new Error("Invalid path");
    }

    const body = await fs.readFile(filePath);
    response.writeHead(filePath.endsWith("404.html") ? 404 : 200, {
      "Content-Type": contentTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream"
    });
    response.end(body);
  } catch {
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Unable to serve this file.");
  }
});

server.listen(port, host, () => {
  console.log(`StoryWhiteBlue preview: http://${host}:${port}${basePath}`);
});

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

