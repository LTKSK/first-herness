import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, symlinkSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const hook = join(root, "scripts/format-agent-edit.mjs");
function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), "agent-format-test-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const init = spawnSync("git", ["init", "-q"], { cwd: dir, encoding: "utf8" });
  assert.equal(init.status, 0, init.stderr);
  symlinkSync(join(root, "node_modules"), join(dir, "node_modules"), "dir");
  writeFileSync(join(dir, ".gitignore"), "node_modules\n");
  return dir;
}
function invoke(dir, phase, id, toolName = "Bash", hookEventName = "PostToolUse") {
  return new Promise((resolveResult, reject) => {
    const child = spawn(process.execPath, [hook, phase], { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "",
      stderr = "";
    child.stdout.on("data", (data) => {
      stdout += data;
    });
    child.stderr.on("data", (data) => {
      stderr += data;
    });
    child.on("error", reject);
    child.on("close", (status) => resolveResult({ status, stdout, stderr }));
    child.stdin.end(
      JSON.stringify({
        cwd: dir,
        tool_use_id: id,
        tool_name: toolName,
        hook_event_name: hookEventName,
      }),
    );
  });
}

test("formats changed and newly created TS/TSX files only", async (t) => {
  const dir = fixture(t);
  writeFileSync(join(dir, "changed.ts"), "const initial= 1\n");
  writeFileSync(join(dir, "unrelated.ts"), "const unchanged=  2\n");
  assert.equal((await invoke(dir, "before", "edit-1")).status, 0);
  writeFileSync(join(dir, "changed.ts"), "const changed=  3\n");
  writeFileSync(join(dir, "new file.tsx"), "export const A=()=> <div>hey</div>\n");
  writeFileSync(join(dir, "notes.md"), "untouched\n");
  const result = await invoke(dir, "after", "edit-1");
  assert.equal(result.status, 0, result.stderr);
  assert.equal(readFileSync(join(dir, "changed.ts"), "utf8"), "const changed = 3;\n");
  assert.match(
    readFileSync(join(dir, "new file.tsx"), "utf8"),
    /export const A = \(\) => <div>hey<\/div>;/,
  );
  assert.equal(readFileSync(join(dir, "unrelated.ts"), "utf8"), "const unchanged=  2\n");
  assert.equal(readFileSync(join(dir, "notes.md"), "utf8"), "untouched\n");
});

test("reports a missing pre-edit snapshot", async (t) => {
  const dir = fixture(t);
  const result = await invoke(dir, "after", "missing", "Edit");
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Missing pre-edit snapshot/);
});

test("does not format files if no TS or TSX file changed", async (t) => {
  const dir = fixture(t);
  writeFileSync(join(dir, "unrelated.ts"), "const unchanged=  2\n");
  assert.equal((await invoke(dir, "before", "read-1")).status, 0);
  writeFileSync(join(dir, "notes.md"), "updated\n");
  const result = await invoke(dir, "after", "read-1");
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "");
  assert.equal(readFileSync(join(dir, "unrelated.ts"), "utf8"), "const unchanged=  2\n");
});

test("reports formatter failures without hiding them", async (t) => {
  const dir = fixture(t);
  assert.equal((await invoke(dir, "before", "invalid-1", "Write")).status, 0);
  writeFileSync(join(dir, "invalid.ts"), "const value = ;\n");
  const result = await invoke(dir, "after", "invalid-1", "Write");
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Oxfmt failed/);
});
