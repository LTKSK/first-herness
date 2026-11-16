import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join } from "node:path";

test(
  "検索語の前後の空白を除かない変異を対応する画面テストが検出する",
  { timeout: 180000 },
  async () => {
    const output = await new Promise((resolve, reject) => {
      const child = spawn(
        process.execPath,
        ["scripts/test-mutation.mjs", "--e2e", "frontend/src/search.ts:7-7"],
        { stdio: ["ignore", "pipe", "pipe"] },
      );
      let text = "";
      child.stdout.on("data", (chunk) => {
        text += chunk;
      });
      child.stderr.on("data", (chunk) => {
        text += chunk;
      });
      child.once("error", reject);
      child.once("close", (code) => (code === 0 ? resolve(text) : reject(new Error(text))));
    });
    const directory = output.match(/Mutation report: (\.harness\/mutation\/[^\s]+)/)?.[1];
    assert.ok(directory, "レポートの保存先が必要です");
    const report = JSON.parse(await readFile(join(directory, "mutation.json"), "utf8"));
    const mutants = report.files["frontend/src/search.ts"].mutants;
    assert.equal(mutants.length, 1);
    assert.equal(mutants[0].replacement, "query");
    assert.equal(mutants[0].status, "Killed");
    assert.match(
      mutants[0].statusReason,
      /タイトル検索に入力すると大小文字を区別せず部分一致するタスクだけを表示し、消去すると一覧に戻る/,
    );
    assert.match(mutants[0].statusReason, /expect\(locator\)\.toBeVisible\(\) failed/);
    assert.doesNotMatch(mutants[0].statusReason, /strict mode violation/);
  },
);
