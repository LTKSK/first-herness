import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), "review-report-test-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const manifest = {
    formatVersion: 1,
    title: "検索",
    summary: "検索を行う",
    baseline: "base",
    candidate: "candidate",
    candidateVersions: ["candidate"],
    videos: [
      { kind: "feature", title: "通常", reason: "未撮影" },
      { kind: "annotated", title: "注釈", reason: "未撮影" },
    ],
    requirements: [{ id: "AC-01", description: "検索できる", result: "unknown", checks: [] }],
    evaluationFiles: ["evaluation.json"],
    revisionFiles: ["revision.json"],
  };
  const evaluation = {
    formatVersion: 1,
    recordType: "evaluation",
    id: "eval-1",
    targetId: "candidate",
    type: "test_quality",
    result: "fail",
    summary: "テストを確認",
    findings: [{ id: "finding-1", summary: "不足", evidence: "test.ts" }],
  };
  const revision = {
    formatVersion: 1,
    recordType: "revision",
    fromTargetId: "candidate",
    id: "revision-1",
    targetId: "candidate",
    summary: "テストを追加",
    findingIds: ["finding-1"],
    reevaluationId: null,
  };
  const save = async () => {
    await Promise.all(
      Object.entries({
        "manifest.json": manifest,
        "evaluation.json": evaluation,
        "revision.json": revision,
      }).map(([name, value]) => writeFile(join(dir, name), JSON.stringify(value))),
    );
  };
  const run = () =>
    spawnSync(
      process.execPath,
      [resolve("viewer/prepare.mjs"), join(dir, "manifest.json"), join(dir, "report.json")],
      { encoding: "utf8" },
    );
  return { dir, manifest, evaluation, revision, save, run };
}

test("評価と修正を結び付けるとHTMLに指摘と未確認を表示する", async (t) => {
  const f = await fixture(t);
  await f.save();
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  const build = spawnSync(
    process.execPath,
    [resolve("viewer/build.mjs"), join(f.dir, "report.json"), join(f.dir, "index.html")],
    { encoding: "utf8" },
  );
  assert.equal(build.status, 0, build.stderr);
  const html = await readFile(join(f.dir, "index.html"), "utf8");
  for (const value of ["finding-1", "revision-1", "未確認", "未撮影"])
    assert.ok(html.includes(value), value);
});
test("テストのない仕様を成功と記録するとレポート作成を拒否する", async (t) => {
  const f = await fixture(t);
  f.manifest.requirements[0].result = "pass";
  await f.save();
  const result = f.run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unverified requirement/);
});
test("異なる候補の評価を渡すとレポート作成を拒否する", async (t) => {
  const f = await fixture(t);
  f.evaluation.targetId = "other";
  await f.save();
  const result = f.run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /candidate/);
});
test("存在しない指摘に修正を対応付けるとレポート作成を拒否する", async (t) => {
  const f = await fixture(t);
  f.revision.findingIds = ["missing"];
  await f.save();
  const result = f.run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unknown finding/);
});
test("候補の異なる動画を指定するとレポート作成を拒否する", async (t) => {
  const f = await fixture(t);
  f.manifest.videos[0] = {
    kind: "feature",
    title: "通常",
    path: "feature.webm",
    targetId: "other",
  };
  await f.save();
  const result = f.run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Video candidate mismatch/);
});

test("修正前の候補の指摘と修正後の再評価を表示する", async (t) => {
  const f = await fixture(t);
  f.manifest.candidateVersions = ["before", "candidate"];
  f.evaluation.targetId = "before";
  f.revision.fromTargetId = "before";
  f.revision.reevaluationId = "eval-2";
  f.manifest.evaluationFiles.push("reevaluation.json");
  await f.save();
  await writeFile(
    join(f.dir, "reevaluation.json"),
    JSON.stringify({
      ...f.evaluation,
      id: "eval-2",
      targetId: "candidate",
      result: "pass",
      findings: [],
    }),
  );
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(await readFile(join(f.dir, "report.json"), "utf8"));
  assert.equal(report.evaluations[0].targetId, "before");
  assert.equal(report.evaluations[1].targetId, "candidate");
  assert.equal(report.revisions[0].reevaluationId, "eval-2");
  const build = spawnSync(
    process.execPath,
    [resolve("viewer/build.mjs"), join(f.dir, "report.json"), join(f.dir, "index.html")],
    { encoding: "utf8" },
  );
  assert.equal(build.status, 0, build.stderr);
  assert.match(await readFile(join(f.dir, "index.html"), "utf8"), /再評価: eval-2/);
});

test("動画の種類と未取得理由を省略するとレポート作成を拒否する", async (t) => {
  const f = await fixture(t);
  f.manifest.videos = [];
  await f.save();
  const result = f.run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /feature and one annotated/);
});

test("未実施のテストを持つ仕様を成功と記録するとレポート作成を拒否する", async (t) => {
  const f = await fixture(t);
  f.manifest.requirements[0].result = "pass";
  f.manifest.requirements[0].checks = [
    { description: "検索結果", evidence: "tests/search", result: "not_run" },
  ];
  await f.save();
  const result = f.run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unverified requirement/);
});

test("既存の動画出力先を指定すると前回の記録を残して撮影を拒否する", async (t) => {
  const f = await fixture(t);
  const candidate = join(f.dir, "candidate");
  const output = join(f.dir, "existing");
  const scenario = join(f.dir, "scenario.mjs");
  const { mkdir } = await import("node:fs/promises");
  await mkdir(candidate);
  await mkdir(output);
  await writeFile(join(output, "videos.json"), "previous");
  await writeFile(scenario, "export function start() {} export function run() {}\n");
  for (const args of [
    ["init", "-q"],
    [
      "-c",
      "user.name=Test",
      "-c",
      "user.email=test@example.invalid",
      "commit",
      "--allow-empty",
      "-qm",
      "candidate",
    ],
  ]) {
    const git = spawnSync("git", args, { cwd: candidate, encoding: "utf8" });
    assert.equal(git.status, 0, git.stderr);
  }
  const result = spawnSync(
    process.execPath,
    [resolve("viewer/record-scenario.mjs"), candidate, scenario, output],
    { encoding: "utf8" },
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /EEXIST/);
  assert.equal(await readFile(join(output, "videos.json"), "utf8"), "previous");
});
