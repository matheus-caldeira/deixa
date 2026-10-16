import { createServer } from "node:http";
import { readFile, readdir } from "node:fs/promises";
import { networkInterfaces } from "node:os";
import { join } from "node:path";

const DOCS_DIR = join(import.meta.dirname, "..", "docs");
const POC_SUFFIX = "-poc.html";
const DEFAULT_PORT = 1399;
const port = Number(process.env.POC_PORT ?? DEFAULT_PORT);

async function listPocs() {
  const files = await readdir(DOCS_DIR);
  return files.filter((file) => file.endsWith(POC_SUFFIX)).sort();
}

function indexPage(pocs) {
  const links = pocs
    .map((file) => `<li><a href="/${file}">${file.replace(POC_SUFFIX, "")}</a></li>`)
    .join("");
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>POCs do Deixa</title><body style="font-family:system-ui;padding:24px"><h1>POCs do Deixa</h1><ul>${links}</ul></body>`;
}

function lanAddresses() {
  return Object.values(networkInterfaces())
    .flat()
    .filter((address) => address && address.family === "IPv4" && !address.internal)
    .map((address) => address.address);
}

const server = createServer(async (request, response) => {
  const pocs = await listPocs();
  const name = decodeURIComponent((request.url ?? "/").split("?")[0] ?? "/").slice(1);
  const target = name === "" && pocs.length === 1 ? pocs[0] : name;
  if (target === "") {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(indexPage(pocs));
    return;
  }
  if (!target || !pocs.includes(target)) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("POC não encontrado");
    return;
  }
  response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
  response.end(await readFile(join(DOCS_DIR, target)));
});

server.listen(port, "0.0.0.0", async () => {
  const pocs = await listPocs();
  console.log(`POCs servidos de docs/ (${pocs.length}): ${pocs.join(", ")}`);
  console.log(`  local: http://localhost:${port}`);
  for (const address of lanAddresses()) console.log(`  rede:  http://${address}:${port}`);
});
