import { readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { main } from "./run-hook.mjs";

const CONVENTIONAL = /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([\w-]+\))?!?: \S/;
const HEREDOC_OP = /(?<!<)<<(-?)[ \t]*(['"]?)([\w.-]+)\2/g;
const HEREDOC_REF = /^\s*\$\(\s*cat\s*<<-?\s*__HEREDOC_(\d+)__/;
const ASSIGNMENT = /^[A-Za-z_]\w*=/;
const REASON = "mensagem fora do Conventional Commits: tipo(escopo): descrição";
const GIT_GENERATED = /^(Merge |fixup! |squash! )/;

export function isConventionalSubject(subject) {
  return GIT_GENERATED.test(subject) || CONVENTIONAL.test(subject);
}

export function stripHeredocs(command) {
  const bodies = [];
  let text = command;
  let from = 0;
  for (;;) {
    HEREDOC_OP.lastIndex = from;
    const op = HEREDOC_OP.exec(text);
    if (!op) break;
    const marker = `<<__HEREDOC_${bodies.length}__`;
    const opEnd = op.index + op[0].length;
    const nl = text.indexOf("\n", opEnd);
    if (nl === -1) {
      bodies.push("");
      text = text.slice(0, op.index) + marker + text.slice(opEnd);
      from = op.index + marker.length;
      continue;
    }
    const lines = text.slice(nl + 1).split("\n");
    const end = lines.findIndex((l) => (op[1] ? l.replace(/^\t+/, "") : l) === op[3]);
    const bodyLines = end === -1 ? lines : lines.slice(0, end);
    const consumed = end === -1 ? text.length - nl - 1 : lines.slice(0, end + 1).join("\n").length;
    bodies.push(bodyLines.join("\n"));
    text =
      text.slice(0, op.index) +
      marker +
      text.slice(opEnd, nl + 1) +
      text.slice(nl + 1 + consumed).replace(/^\n/, "");
    from = op.index + marker.length;
  }
  return { text, bodies };
}

function readSubstitution(s, i) {
  let depth = 0;
  let j = i;
  while (j < s.length) {
    const c = s[j];
    if (c === "\\") {
      j += 2;
      continue;
    }
    if (c === "'") {
      const k = s.indexOf("'", j + 1);
      j = k === -1 ? s.length : k + 1;
      continue;
    }
    if (c === '"') {
      j++;
      while (j < s.length && s[j] !== '"') {
        if (s[j] === "\\") j++;
        else if (s[j] === "$" && s[j + 1] === "(") {
          j = readSubstitution(s, j + 1);
          continue;
        }
        j++;
      }
      j++;
      continue;
    }
    if (c === "(") depth++;
    if (c === ")" && --depth === 0) return j + 1;
    j++;
  }
  return s.length;
}

export function splitStatements(text) {
  const statements = [];
  let words = [];
  let word = null;
  const endWord = () => {
    if (word !== null) words.push(word);
    word = null;
  };
  const endStatement = () => {
    endWord();
    if (words.length) statements.push(words);
    words = [];
  };
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === "\\") {
      if (text[i + 1] === "\n") {
        i += 2;
        continue;
      }
      word = (word ?? "") + (text[i + 1] ?? "");
      i += 2;
      continue;
    }
    if (c === "'") {
      const k = text.indexOf("'", i + 1);
      word = (word ?? "") + text.slice(i + 1, k === -1 ? text.length : k);
      i = k === -1 ? text.length : k + 1;
      continue;
    }
    if (c === '"') {
      let v = "";
      i++;
      while (i < text.length && text[i] !== '"') {
        if (text[i] === "\\" && /["\\$`]/.test(text[i + 1] ?? "")) {
          v += text[i + 1];
          i += 2;
          continue;
        }
        if (text[i] === "\\" && text[i + 1] === "\n") {
          i += 2;
          continue;
        }
        if (text[i] === "$" && text[i + 1] === "(") {
          const k = readSubstitution(text, i + 1);
          v += text.slice(i, k);
          i = k;
          continue;
        }
        v += text[i++];
      }
      word = (word ?? "") + v;
      i++;
      continue;
    }
    if (c === "$" && text[i + 1] === "(") {
      const k = readSubstitution(text, i + 1);
      word = (word ?? "") + text.slice(i, k);
      i = k;
      continue;
    }
    if (c === "#" && word === null) {
      const k = text.indexOf("\n", i);
      i = k === -1 ? text.length : k;
      continue;
    }
    if (c === "&" && (/[<>]/.test(text[i - 1] ?? "") || text[i + 1] === ">")) {
      word = (word ?? "") + c;
      i++;
      continue;
    }
    if (";&|\n()".includes(c)) {
      endStatement();
      i++;
      continue;
    }
    if (c === " " || c === "\t") {
      endWord();
      i++;
      continue;
    }
    word = (word ?? "") + c;
    i++;
  }
  endStatement();
  return statements;
}

const LEADING = new Set(["!", "{", "then", "do", "else", "time"]);

function commitArgs(words) {
  let i = 0;
  while (i < words.length && (LEADING.has(words[i]) || ASSIGNMENT.test(words[i]))) i++;
  if (words[i] === "rtk") i++;
  if (words[i] === "proxy") i++;
  if (words[i] !== "git") return null;
  i++;
  while (i < words.length) {
    const w = words[i];
    if (w === "-C" || w === "-c") i += 2;
    else if (/^-[Cc]./.test(w) || /^--[\w-]+(=.*)?$/.test(w) || w === "-p" || w === "-P") i++;
    else break;
  }
  return words[i] === "commit" ? words.slice(i + 1) : null;
}

function parseCommit(args) {
  const messages = [];
  const files = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--") break;
    const long = a.match(/^--(message|file)(?:=([\s\S]*))?$/);
    if (long) {
      const value = long[2] ?? args[++i] ?? "";
      (long[1] === "message" ? messages : files).push(value);
      continue;
    }
    if (/^-[^-]/.test(a)) {
      for (let k = 1; k < a.length; k++) {
        const flag = a[k];
        if ("mFCct".includes(flag)) {
          const rest = a.slice(k + 1);
          const value = rest !== "" ? rest : (args[++i] ?? "");
          if (flag === "m") messages.push(value);
          if (flag === "F") files.push(value);
          break;
        }
      }
    }
  }
  return { messages, files };
}

const firstLine = (text) =>
  text
    .split("\n")
    .find((l) => l.trim() !== "")
    ?.trim() ?? "";

function messageText(value, bodies) {
  const ref = value.match(HEREDOC_REF);
  return ref ? (bodies[Number(ref[1])] ?? "") : value;
}

export function checkCommitMessage(
  command = "",
  { cwd = process.cwd(), readFile = (p) => readFileSync(p, "utf8") } = {},
) {
  const { text, bodies } = stripHeredocs(String(command ?? ""));
  for (const words of splitStatements(text)) {
    const args = commitArgs(words);
    if (!args) continue;
    const { messages, files } = parseCommit(args);
    if (messages.length) {
      const subject = firstLine(messages.map((m) => messageText(m, bodies)).join("\n\n"));
      if (!CONVENTIONAL.test(subject)) return { blocked: true, reason: REASON };
    }
    for (const file of files) {
      let content;
      try {
        if (file === "-") {
          const stdin = words.map((w) => w.match(/^\d?<<__HEREDOC_(\d+)__$/)).find(Boolean);
          if (!stdin) throw new Error("stdin");
          content = bodies[Number(stdin[1])] ?? "";
        } else {
          if (file === "") throw new Error("vazio");
          content = readFile(isAbsolute(file) ? file : resolve(cwd, file));
        }
      } catch {
        return {
          blocked: true,
          reason: `não foi possível ler o arquivo de mensagem "${file}" (-F/--file); crie-o antes, em outro comando, ou use -m ou -F - com heredoc`,
        };
      }
      if (!CONVENTIONAL.test(firstLine(content))) return { blocked: true, reason: REASON };
    }
  }
  return { blocked: false };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main((input) => checkCommitMessage(input.tool_input?.command, { cwd: input.cwd || process.cwd() }));
}
