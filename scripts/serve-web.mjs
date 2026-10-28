import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const ROOT = resolve(".next-web");
const SHARED_HEADERS =
  JSON.parse(readFileSync("vercel.json", "utf8")).headers.find((rule) => rule.source === "/(.*)")?.headers ??
  [];
const PORT = Number(process.env.PORT ?? 1320);
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".txt": "text/plain; charset=utf-8",
  ".wasm": "application/wasm",
  ".data": "application/octet-stream",
  ".woff2": "font/woff2",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

function resolveFile(pathname) {
  const target = normalize(join(ROOT, decodeURIComponent(pathname)));
  if (!target.startsWith(ROOT)) return null;
  if (existsSync(target) && statSync(target).isFile()) return target;
  const index = join(target, "index.html");
  if (existsSync(index)) return index;
  return null;
}

createServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://localhost");
  const found = resolveFile(url.pathname);
  const file = found ?? join(ROOT, "404.html");
  const type = url.pathname.startsWith("/pwa-icon/") ? "image/png" : TYPES[extname(file)];
  response.setHeader("Content-Type", type ?? "application/octet-stream");
  for (const header of SHARED_HEADERS) response.setHeader(header.key, header.value);
  response.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
  if (url.pathname.endsWith("/sw.js")) response.setHeader("Cache-Control", "no-cache");
  response.statusCode = found ? 200 : 404;
  createReadStream(file).pipe(response);
}).listen(PORT, "127.0.0.1", () => console.info(`web target on http://127.0.0.1:${PORT}`));
