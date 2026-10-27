import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const ROOT = resolve(".next-web");
const PORT = Number(process.env.PORT ?? 1320);
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
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
  response.setHeader("Content-Type", TYPES[extname(file)] ?? "application/octet-stream");
  response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  response.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
  if (url.pathname.endsWith("/sw.js")) response.setHeader("Cache-Control", "no-cache");
  response.statusCode = found ? 200 : 404;
  createReadStream(file).pipe(response);
}).listen(PORT, "127.0.0.1", () => console.info(`web target on http://127.0.0.1:${PORT}`));
