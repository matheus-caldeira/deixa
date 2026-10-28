import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const OUT = ".next-web";
const WORKER = "sw.js";

const FAMILY_BUILD = ".next";
const PARKED_BUILD = ".next-family";

if (existsSync(PARKED_BUILD)) rmSync(PARKED_BUILD, { recursive: true, force: true });
if (existsSync(FAMILY_BUILD)) renameSync(FAMILY_BUILD, PARKED_BUILD);
try {
  execFileSync("pnpm", ["exec", "next", "build"], {
    stdio: "inherit",
    env: { ...process.env, DEIXA_TARGET: "web", NEXT_TELEMETRY_DISABLED: "1" },
  });
} finally {
  rmSync(FAMILY_BUILD, { recursive: true, force: true });
  if (existsSync(PARKED_BUILD)) renameSync(PARKED_BUILD, FAMILY_BUILD);
}

const locale = JSON.parse(readFileSync(join("locales", "pt-BR.json"), "utf8"));
const appName =
  readFileSync(join("src", "shared", "app.ts"), "utf8").match(/APP_NAME = "([^"]+)"/)?.[1] ?? "Deixa";
const icon = (size, purpose) => ({
  src: `/pwa-icon/${size}`,
  sizes: `${size}x${size}`,
  type: "image/png",
  purpose,
});
writeFileSync(
  join(OUT, "manifest.webmanifest"),
  JSON.stringify({
    name: appName,
    short_name: appName,
    description: locale.app.tagline,
    lang: "pt-BR",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0E1018",
    theme_color: "#0E1018",
    icons: [icon(192, "any"), icon(512, "any"), icon(512, "maskable")],
  }),
);

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
