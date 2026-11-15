import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";
const [resultArg, directoryArg] = process.argv.slice(2);
if (!resultArg || !directoryArg)
  throw new Error("Usage: node viewer/demo.mjs <evaluation result.json> <report directory>");
const source = JSON.parse(await readFile(resolve(resultArg), "utf8"));
const directory = resolve(directoryArg);
await mkdir(directory, { recursive: true });
const status = (name) => {
  const check = source.checks.find((item) => item.name === name);
  return !check
    ? "not_run"
    : check.error
      ? "environment_error"
      : check.status === 0
        ? "pass"
        : "fail";
};
const api = status("evaluation-api"),
  ui = status("evaluation-ui");
const check = (description, evidence, result) => ({
  description,
  evidence,
  result,
});
const data = {
  formatVersion: 1,
  title: "タスクに期限を追加する",
  summary:
    "タスクの期限を指定し、変更や解除を行います。動画と評価結果はM1から作成した候補を対象としています。",
  baseline: source.baseline,
  candidate: "M2の候補差分",
  videos: [
    {
      title: "機能の操作",
      path: "feature.webm",
      description: "期限の作成、変更、再読み込み、解除を表示します。",
    },
    {
      title: "仕様とチェックの注釈",
      path: "annotated.webm",
      description: "同じ操作に確認内容を表示します。動画は仕様の一部を示します。",
    },
  ],
  requirements: [
    {
      id: "REQ-01",
      description: "期限を指定してタスクを作成し、一覧に表示する。",
      result: ui,
      checks: [check("作成後の一覧表示", "評価用画面テスト: evaluate-ui.mjs", ui)],
    },
    {
      id: "REQ-02",
      description: "期限を編集し、再読み込み後も表示する。",
      result: status("e2e"),
      checks: [
        check(
          "変更して再読み込み",
          "tests/e2e/tasks.spec.ts: create, edit and reload a task",
          status("e2e"),
        ),
      ],
    },
    {
      id: "REQ-03",
      description: "期限を解除し、再読み込み後も解除状態を保つ。",
      result: ui,
      checks: [check("解除して再読み込み", "評価用画面テスト: evaluate-ui.mjs", ui)],
    },
    {
      id: "REQ-04",
      description: "実在しない日付や形式の異なる期限をAPIが拒否する。",
      result: api,
      checks: [check("不正な日付と形式の境界値", "評価用APIテスト: evaluate-api.mjs", api)],
    },
    {
      id: "REQ-05",
      description: "期限を省略した作成ではnullとし、省略した更新では期限を維持する。",
      result: api,
      checks: [check("作成と更新における省略", "評価用APIテスト: evaluate-api.mjs", api)],
    },
    {
      id: "REQ-06",
      description: "旧DBのタスクを保持し、API再起動後も期限を保持する。",
      result: api,
      checks: [check("旧DBの移行とAPI再起動", "評価用APIテスト: evaluate-api.mjs", api)],
    },
    {
      id: "REQ-07",
      description: "入力エラーと保存エラーを画面に表示する。",
      result: ui === "pass" && status("e2e") === "pass" ? "pass" : "unknown",
      checks: [
        check(
          "空タイトルの入力エラー",
          "tests/e2e/tasks.spec.ts: shows a validation error for an empty title",
          status("e2e"),
        ),
        check("API保存エラー", "評価用画面テスト: evaluate-ui.mjs", ui),
      ],
    },
    {
      id: "REQ-08",
      description: "既存のタイトル・一覧・作成・更新の仕様を維持する。",
      result: "unknown",
      checks: [
        check("既存動作の一部", "tests/api/tasks.test.ts、tests/e2e/tasks.spec.ts", status("test")),
      ],
    },
  ],
  evaluations: [
    {
      id: source.id,
      title: "機能の評価",
      result: source.result,
      summary:
        "型検査、Lint、テスト、評価用API・画面テストを実行しました。詳細は評価結果のログを参照してください。",
      findings: [],
    },
    {
      id: "specification",
      title: "仕様の評価",
      result: "not_run",
      summary: "曖昧な要求を用いた評価は未実施です。",
      findings: [],
    },
    {
      id: "test-quality",
      title: "テストの評価",
      result: "not_run",
      summary: "このレポートでは評価結果をまだ結び付けていません。",
      findings: [],
    },
    {
      id: "code-quality",
      title: "コード品質の評価",
      result: "not_run",
      summary: "保守性の評価は未実施です。",
      findings: [],
    },
  ],
  revisions: [],
};
await writeFile(join(directory, "report.json"), JSON.stringify(data, null, 2) + "\n");
console.log(`Prepared ${join(directory, "report.json")}`);
