import { readFile, writeFile } from "node:fs/promises";
import { resolve, dirname, extname } from "node:path";

const [inputArg, outputArg] = process.argv.slice(2);
if (!inputArg || !outputArg)
  throw new Error("Usage: node viewer/build.mjs <data.json> <output.html>");
const input = resolve(inputArg),
  output = resolve(outputArg);
const data = JSON.parse(await readFile(input, "utf8"));
if (
  data.formatVersion !== 1 ||
  !Array.isArray(data.requirements) ||
  !Array.isArray(data.evaluations)
)
  throw new Error("Unsupported or invalid viewer data");
const esc = (v) =>
  String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
const labels = {
  pass: "成功",
  fail: "失敗",
  not_run: "未実施",
  unknown: "未確認",
  environment_error: "環境エラー",
  patch_error: "差分エラー",
};
const showStatus = (s) =>
  `<span class="status ${esc(s)}">${esc(labels[s] ?? s ?? "未確認")}</span>`;
const clips = await Promise.all(
  (data.videos ?? []).map(async (video) => {
    if (!video.path)
      return `<section class="panel"><h3>${esc(video.title)}</h3><p>動画は未取得です。${esc(video.reason)}</p></section>`;
    const path = resolve(dirname(input), video.path);
    const mime = { ".webm": "video/webm", ".mp4": "video/mp4" }[extname(path).toLowerCase()];
    if (!mime) throw new Error(`Unsupported video format: ${path}`);
    const bytes = await readFile(path);
    return `<section class="panel"><h3>${esc(video.title)}</h3><video controls preload="metadata"><source src="data:${mime};base64,${bytes.toString("base64")}" type="${mime}"></video><p>${esc(video.description)}</p></section>`;
  }),
);
const rows = data.requirements
  .map(
    (r) =>
      `<tr><td><strong>${esc(r.id)}</strong><br>${esc(r.description)}</td><td>${(r.checks ?? []).length ? r.checks.map((c) => `<div class="check">${showStatus(c.result)} ${esc(c.description)}<br><code>${esc(c.evidence)}</code></div>`).join("") : "対応するチェックは未登録です。"}</td><td>${showStatus(r.result)}</td></tr>`,
  )
  .join("");
const evaluations = data.evaluations
  .map(
    (e) =>
      `<article class="panel"><h3>${esc(e.id)}: ${esc(e.title)} ${showStatus(e.result)}</h3><p>対象: ${esc(e.targetId)}</p><p>${esc(e.summary)}</p>${(e.findings ?? []).length ? `<ul>${e.findings.map((f) => `<li><strong>${esc(f.id)}</strong> ${esc(f.summary)}<br><small>${esc(f.evidence)}</small></li>`).join("")}</ul>` : '<p class="muted">指摘の記録はありません。</p>'}</article>`,
  )
  .join("");
const revisions = (data.revisions ?? [])
  .map(
    (r) =>
      `<li><strong>${esc(r.id)}</strong> ${esc(r.summary)}<br><small>対象: ${esc(r.fromTargetId)} → ${esc(r.targetId)} / 対応した指摘: ${esc((r.findingIds ?? []).join(", ") || "記録なし")} / 再評価: ${esc(r.reevaluationId || "未実施")}</small></li>`,
  )
  .join("");
const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(data.title)}</title><style>body{font-family:system-ui,sans-serif;background:#f4f6f2;color:#23312b;margin:0;line-height:1.65}main{max-width:1100px;margin:auto;padding:40px 20px}h1{margin-bottom:4px}h2{margin-top:44px}.muted,small{color:#61736a}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px}.panel{background:white;border:1px solid #dce6dd;border-radius:12px;padding:18px;margin-bottom:12px}video{width:100%;background:#111;border-radius:8px}table{width:100%;border-collapse:collapse;background:white}th,td{text-align:left;vertical-align:top;padding:14px;border:1px solid #dce6dd}th{background:#edf3ee}.status{display:inline-block;border-radius:5px;background:#e8ede9;padding:2px 7px;font-size:.85em;white-space:nowrap}.pass{background:#d9f2df;color:#174f2b}.fail,.environment_error,.patch_error{background:#f9dddd;color:#842626}.not_run,.unknown{background:#fff0ce;color:#624600}.check+.check{margin-top:12px}code{font-size:.85em;overflow-wrap:anywhere}</style></head><body><main><header><p class="muted">評価レポート · 形式 v${esc(data.formatVersion)}</p><h1>${esc(data.title)}</h1><p>${esc(data.summary)}</p><p class="muted">基準: ${esc(data.baseline)} / 対象: ${esc(data.candidate)}</p></header><h2>機能の動画</h2><div class="grid">${clips.join("") || "<p>動画は未取得です。</p>"}</div><h2>仕様とチェック</h2><p class="muted">未登録や未実施の項目は未確認として表示します。チェックの成功だけで仕様の網羅性は保証できません。</p><table><thead><tr><th>仕様</th><th>対応するチェック</th><th>結果</th></tr></thead><tbody>${rows}</tbody></table><h2>評価</h2>${evaluations}<h2>改善履歴</h2>${revisions ? `<ol>${revisions}</ol>` : "<p>改善履歴はまだ記録されていません。</p>"}</main></body></html>`;
await writeFile(output, html);
console.log(`Built ${output}`);
