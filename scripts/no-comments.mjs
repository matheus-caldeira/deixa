#!/usr/bin/env node
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const CODE = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;
const SCANNED = ["src", "scripts", ".claude/hooks", "tests"];
const ROOT_FILES = /^(\.dependency-cruiser\.cjs|[\w.-]+\.config\.(ts|mts|mjs|cjs|js)|vitest\.setup\.ts)$/;
const GENERATED = new Set(["next-env.d.ts"]);

function scriptKind(fileName) {
  if (/\.tsx$/.test(fileName)) return ts.ScriptKind.TSX;
  if (/\.jsx$/.test(fileName)) return ts.ScriptKind.JSX;
  if (/\.(js|mjs|cjs)$/.test(fileName)) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

function leafTokens(node, sourceFile, out = []) {
  const children = node.getChildren(sourceFile);
  if (children.length === 0) out.push(node);
  for (const child of children) leafTokens(child, sourceFile, out);
  return out;
}

export function findComments(source, fileName) {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKind(fileName),
  );
  const seen = new Map();
  for (const token of leafTokens(sourceFile, sourceFile)) {
    if (token.kind === ts.SyntaxKind.JsxText) continue;
    for (const range of ts.getLeadingCommentRanges(source, token.pos) ?? []) seen.set(range.pos, range);
    for (const range of ts.getTrailingCommentRanges(source, token.end) ?? []) seen.set(range.pos, range);
  }
  return [...seen.values()]
    .sort((a, b) => a.pos - b.pos)
    .map((range) => ({
      line: sourceFile.getLineAndCharacterOfPosition(range.pos).line + 1,
      text: source.slice(range.pos, range.end),
    }));
}

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    if (name === "node_modules" || name === "fixtures") return [];
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : CODE.test(name) ? [full] : [];
  });
}

function codeFiles() {
  const rootFiles = readdirSync(ROOT)
    .filter((name) => ROOT_FILES.test(name))
    .map((name) => join(ROOT, name));
  return [...SCANNED.flatMap((dir) => walk(join(ROOT, dir))), ...rootFiles].filter(
    (file) => !GENERATED.has(relative(ROOT, file)),
  );
}

function main() {
  const files = process.argv.slice(2).length
    ? process.argv.slice(2).filter((f) => CODE.test(f))
    : codeFiles();
  const problems = files.flatMap((file) =>
    findComments(readFileSync(file, "utf8"), file).map(
      ({ line, text }) => `${relative(ROOT, file)}:${line}  ${text.split("\n")[0]}`,
    ),
  );
  if (problems.length) {
    console.error(
      `✗ ${problems.length} comentário(s) em código (regra: código sem comentários):\n- ${problems.join("\n- ")}`,
    );
    process.exit(1);
  }
  console.log(`✓ sem comentários em ${files.length} arquivo(s) de código`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
