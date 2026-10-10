export function runHook(rawInput, check) {
  try {
    const input = JSON.parse(rawInput);
    const r = check(input);
    return r.blocked ? { exitCode: 2, stderr: r.reason } : { exitCode: 0, stderr: "" };
  } catch (e) {
    return {
      exitCode: 2,
      stderr: `hook falhou (bloqueado por segurança): ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

export async function main(check) {
  let raw = "";
  try {
    const chunks = [];
    for await (const c of process.stdin) chunks.push(c);
    raw = Buffer.concat(chunks).toString("utf8");
  } catch {
    raw = "";
  }
  const r = runHook(raw, check);
  if (r.stderr) console.error(r.stderr);
  process.exit(r.exitCode);
}
