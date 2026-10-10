import { test } from "node:test";
import assert from "node:assert/strict";
import { checkSecrets, checkSecretsInput } from "./guard-secrets.mjs";
import { runHook } from "./run-hook.mjs";
import { checkCommitMessage, isConventionalSubject } from "./guard-conventional-commit.mjs";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("bloqueia chave de API em conteúdo escrito", () => {
  assert.equal(
    checkSecrets({ file_path: "src/x.ts", content: 'const k = "sk-ant-api03-abcdefghijklmnopqrstuv"' })
      .blocked,
    true,
  );
});
test("bloqueia escrita em .env", () => {
  assert.equal(checkSecrets({ file_path: ".env", content: "X=1" }).blocked, true);
});
test("permite .env.example", () => {
  assert.equal(checkSecrets({ file_path: ".env.example", content: "TMDB_API_KEY=" }).blocked, false);
});
test("bloqueia escrita direta no diretório de dados", () => {
  assert.equal(checkSecrets({ file_path: "data/catalog/series/x/original.en.srt", content: "1" }).blocked, true);
});
test("aceita conventional commit", () => {
  assert.equal(checkCommitMessage('git commit -m "feat(catalog): importa legenda"').blocked, false);
});
test("rejeita commit fora do padrão", () => {
  assert.equal(checkCommitMessage('git commit -m "ajustes"').blocked, true);
});
test("ignora comandos que não são commit", () => {
  assert.equal(checkCommitMessage("git status").blocked, false);
});

const heredoc = (msg) => `git commit -m "$(cat <<'EOF'\n${msg}\nEOF\n)"`;
test("aceita commit via heredoc conventional", () => {
  assert.equal(checkCommitMessage(heredoc("feat(x): add\n\nbody")).blocked, false);
});
test("bloqueia commit via heredoc fora do padrão", () => {
  assert.equal(checkCommitMessage(heredoc("ajustes\n\nfeat(x): add")).blocked, true);
});
test("bloqueia flag curta combinada fora do padrão", () => {
  assert.equal(checkCommitMessage('git commit -am "ajustes"').blocked, true);
});
test("bloqueia --message= e --message fora do padrão", () => {
  assert.equal(checkCommitMessage('git commit --message="ajustes"').blocked, true);
  assert.equal(checkCommitMessage('git commit --message "ajustes"').blocked, true);
});
test("aceita flag combinada e --message conventional", () => {
  assert.equal(checkCommitMessage('git commit -am "fix(ui): corrige"').blocked, false);
  assert.equal(checkCommitMessage('git commit --message="fix(ui): corrige"').blocked, false);
});
test("não confunde --amend com mensagem", () => {
  assert.equal(checkCommitMessage("git commit --amend --no-edit").blocked, false);
});
test("bloqueia .env.local", () => {
  assert.equal(checkSecrets({ file_path: "app/.env.local", content: "" }).blocked, true);
});
const KEY = ["sk", "ant", "api03", "abcdefghijklmnopqrstuv"].join("-");
const SLUG = "sk" + "-abcdefghijklmnopqrstuvwxyz";
test("slug com sk- colado não é falso positivo", () => {
  assert.equal(checkSecrets({ file_path: "a.md", content: "task-" + SLUG }).blocked, false);
  assert.equal(checkSecrets({ file_path: "a.md", content: `k="${SLUG}"` }).blocked, true);
});
test("runHook: JSON inválido ou vazio falha fechado (2)", () => {
  const check = () => ({ blocked: false });
  assert.equal(runHook("not json", check).exitCode, 2);
  assert.equal(runHook("", check).exitCode, 2);
});
test("runHook: exceção no check falha fechado (2)", () => {
  assert.equal(
    runHook("{}", () => {
      throw new Error("x");
    }).exitCode,
    2,
  );
});
test("runHook: permitido => 0; bloqueado => 2 com motivo", () => {
  assert.equal(runHook("{}", () => ({ blocked: false })).exitCode, 0);
  const r = runHook("{}", () => ({ blocked: true, reason: "motivo" }));
  assert.equal(r.exitCode, 2);
  assert.match(r.stderr, /motivo/);
});

test("secrets: MultiEdit e NotebookEdit", () => {
  assert.equal(
    checkSecretsInput({ file_path: "a.ts", edits: [{ new_string: "ok" }, { new_string: KEY }] }).blocked,
    true,
  );
  assert.equal(checkSecretsInput({ notebook_path: "n.ipynb", new_source: KEY }).blocked, true);
  assert.equal(checkSecretsInput({ notebook_path: ".env", new_source: "x" }).blocked, true);
  assert.equal(checkSecretsInput({ file_path: "a.ts", edits: [{ new_string: "ok" }] }).blocked, false);
});
test("secrets: variantes de caminho bloqueadas", () => {
  for (const p of [
    "./.env",
    "foo/../.env",
    "/abs/project/.env.local",
    ".ENV",
    "data//audio/x.wav",
    "/Volumes/x/data/catalog/y",
    "a\\.env",
  ]) {
    assert.equal(checkSecrets({ file_path: p, content: "" }).blocked, true, p);
  }
  for (const p of [".env.example", "docs/.env.example"]) {
    assert.equal(checkSecrets({ file_path: p, content: "" }).blocked, false, p);
  }
});

const blocked = (cmd, opts) => checkCommitMessage(cmd, opts).blocked;

test("commit: heredoc que só grava arquivo com texto de commit é permitido", () => {
  const cmd = "cat > notas.md <<'EOF'\nExemplo:\ngit commit -m \"ajustes\"\nEOF";
  assert.equal(blocked(cmd), false);
});
test("commit: heredoc anterior + commit via heredoc válido é permitido", () => {
  const cmd =
    "cat > a.txt <<'EOF'\najustes\nEOF\ngit add a.txt && git commit -m \"$(cat <<'EOF'\nfeat(x): add\n\ncorpo\nEOF\n)\"";
  assert.equal(blocked(cmd), false);
});
test("commit: heredoc anterior válido + commit via heredoc ruim é bloqueado", () => {
  const cmd = "cat > a.txt <<'EOF'\nfeat(x): ok\nEOF\ngit commit -m \"$(cat <<'MSG'\najustes\nMSG\n)\"";
  assert.equal(blocked(cmd), true);
});
test("commit: git -C dir / -c k=v commit com mensagem ruim é bloqueado", () => {
  assert.equal(blocked('git -C dir commit -m "ajustes"'), true);
  assert.equal(blocked('git -c user.x=y -C a commit -m "ajustes"'), true);
  assert.equal(blocked('git -C dir commit -m "feat(x): ok"'), false);
});
test("commit: -m sem aspas e colado", () => {
  assert.equal(blocked("git commit -m ajustes"), true);
  assert.equal(blocked('git commit -m"ajustes"'), true);
  assert.equal(blocked('git commit -m"feat(x): ok"'), false);
  assert.equal(blocked("git commit -majustes"), true);
});
test("commit: segundo commit após ; com mensagem ruim é bloqueado", () => {
  assert.equal(blocked('git commit -m "feat(x): ok"; git commit -m "ajustes"'), true);
  assert.equal(blocked('git commit -m "feat(x): ok" && git commit --allow-empty -m "fix(y): ok"'), false);
});
test("commit: vários -m — o primeiro define o assunto", () => {
  assert.equal(blocked('git commit -m "feat(x): ok" -m "corpo livre"'), false);
  assert.equal(blocked('git commit -m "ajustes" -m "feat(x): ok"'), true);
});
test("commit: prefixos de atribuição e rtk", () => {
  assert.equal(blocked('GIT_AUTHOR_DATE=now rtk git commit -m "ajustes"'), true);
  assert.equal(blocked('rtk git commit -m "docs: ok"'), false);
});
test("commit: texto citado e comentário não são commits", () => {
  assert.equal(blocked('echo "git commit -m ajustes"'), false);
  assert.equal(blocked("# git commit -m ajustes\ngit status"), false);
});
test("commit: continuação de linha", () => {
  assert.equal(blocked('git commit \\\n  -m "ajustes"'), true);
});
test("commit: -F/--file com arquivo válido, inválido e inexistente", () => {
  const dir = mkdtempSync(join(tmpdir(), "hook-"));
  const ok = join(dir, "ok.txt");
  const bad = join(dir, "bad.txt");
  writeFileSync(ok, "\nfeat(x): ok\n\ncorpo\n");
  writeFileSync(bad, "ajustes\n");
  assert.equal(blocked(`git commit -F ${ok}`), false);
  assert.equal(blocked(`git commit --file=${ok}`), false);
  assert.equal(blocked(`git commit -F${ok}`), false);
  assert.equal(blocked(`git commit -F ${bad}`), true);
  assert.equal(blocked(`git commit --file ${bad}`), true);
  const missing = join(dir, "nao-existe.txt");
  assert.equal(blocked(`git commit -F ${missing}`), true);
  assert.match(checkCommitMessage(`git commit -F ${missing}`).reason, /arquivo/);
  assert.equal(blocked("git commit -F ok.txt", { cwd: dir }), false);
  assert.equal(blocked("git commit -F bad.txt", { cwd: dir }), true);
});
test("commit: -F - lê o heredoc do próprio statement; stdin de pipe bloqueia", () => {
  assert.equal(blocked("git commit -F - <<'EOF'\nfix(x): ok\n\ncorpo\nEOF"), false);
  assert.equal(blocked("git commit -F - <<'EOF'\najustes\nEOF"), true);
  assert.equal(blocked("printf 'fix(x): ok' | git commit -F -"), true);
});

test("isConventionalSubject aceita tipos e escopo opcional", () => {
  for (const ok of ["feat: x", "fix(app): y", "chore(deps)!: z", "revert: w"])
    assert.equal(isConventionalSubject(ok), true);
});

test("isConventionalSubject rejeita fora do padrão", () => {
  for (const bad of ["ajustes", "Feat: x", "feat:x", "", "wip"])
    assert.equal(isConventionalSubject(bad), false);
});

test("isConventionalSubject aceita merge e fixup gerados pelo git", () => {
  for (const ok of ["Merge branch 'x'", "fixup! feat: x", "squash! fix: y"])
    assert.equal(isConventionalSubject(ok), true);
});
