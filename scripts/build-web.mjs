import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const OUT = ".next-web";
const WORKER = "sw.js";

execFileSync("pnpm", ["exec", "next", "build"], {
  stdio: "inherit",
  env: { ...process.env, DEIXA_TARGET: "web", NEXT_TELEMETRY_DISABLED: "1" },
});

function listFiles(folder) {
  return readdirSync(folder).flatMap((name) => {
    const path = join(folder, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

function urlFor(path) {
  const url = `/${relative(OUT, path).split(sep).join("/")}`;
  return url.endsWith("/index.html") ? url.slice(0, -"index.html".length) : url;
}

const files = listFiles(OUT).filter((path) => !path.endsWith(WORKER));
const hash = createHash("sha256");
for (const path of files.toSorted()) hash.update(path).update(readFileSync(path));
const version = hash.digest("hex").slice(0, 16);
const urls = files.map(urlFor).toSorted();
const template = readFileSync(join("scripts", "web-service-worker.js"), "utf8");
writeFileSync(
  join(OUT, WORKER),
  template.replace("__VERSION__", version).replace('"__FILES__"', JSON.stringify(urls)),
);
console.info(`web target: ${urls.length} files, version ${version}`);
