import { test } from "node:test";
import assert from "node:assert/strict";
import { findComments } from "./no-comments.mjs";

test("acha comentário de linha e de bloco com a linha certa", () => {
  const source = "const a = 1; // explica\n/* bloco */\nconst b = 2;\n";
  assert.deepEqual(findComments(source, "x.ts"), [
    { line: 1, text: "// explica" },
    { line: 2, text: "/* bloco */" },
  ]);
});

test("acha JSDoc e diretivas de lint", () => {
  const source = "/** @type {X} */\nmodule.exports = {};\n// eslint-disable-next-line\nfoo();\n";
  assert.equal(findComments(source, "x.cjs").length, 2);
});

test("não confunde // dentro de string, template ou regex com comentário", () => {
  const source = 'const u = "http://x";\nconst t = `a // b`;\nconst r = /\\/\\//g;\n';
  assert.deepEqual(findComments(source, "x.ts"), []);
});

test("diretiva 'use client' não é comentário", () => {
  assert.deepEqual(findComments('"use client";\nexport const a = 1;\n', "x.tsx"), []);
});

test("entende JSX", () => {
  const source = "export const C = () => <div>{/* nota */}texto // não é comentário</div>;\n";
  assert.deepEqual(findComments(source, "x.tsx"), [{ line: 1, text: "/* nota */" }]);
});

test("shebang não é comentário", () => {
  assert.deepEqual(findComments("#!/usr/bin/env node\nconsole.log(1);\n", "x.mjs"), []);
});
