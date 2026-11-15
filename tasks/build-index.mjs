import { readFile, writeFile } from "node:fs/promises";

const entries = [
  ["task-completion.md", "タスクの完了", "確定", "実装済み"],
  ["title-search.md", "タイトル検索", "確定", "実装済み"],
  ["task-deletion.md", "タスク削除", "草案（最終レビュー待ち）", "実装済み"],
  ["mysql-migration.md", "MySQLへの変更", "草案", "実装済み"],
  ["due-date.md", "期限の追加", "過去の試行用課題", "未実装"],
];
const dir = new URL("./", import.meta.url);
const escape = (s) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
function inline(s) {
  return escape(s).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}
function render(markdown) {
  const lines = markdown.split(/\r?\n/);
  const result = [];
  let list = false;
  let table = false;
  const close = () => { if (list) { result.push("</ul>"); list = false; } if (table) { result.push("</tbody></table>"); table = false; } };
  for (const line of lines) {
    if (/^\|\s*[-:]+\s*\|/.test(line)) continue;
    if (line.startsWith("|")) {
      if (list) { result.push("</ul>"); list = false; }
      if (!table) { result.push('<div class="table"><table><tbody>'); table = true; }
      result.push("<tr>" + line.slice(1, -1).split("|").map((x) => `<td>${inline(x.trim())}</td>`).join("") + "</tr>");
      continue;
    }
    if (table) { result.push("</tbody></table></div>"); table = false; }
    const item = line.match(/^- (.*)/);
    if (item) { if (!list) { result.push("<ul>"); list = true; } result.push(`<li>${inline(item[1])}</li>`); continue; }
    if (list) { result.push("</ul>"); list = false; }
    const heading = line.match(/^(#{1,6})\s+(.+)/);
    if (heading) { const level = Math.min(heading[1].length + 1, 6); result.push(`<h${level}>${inline(heading[2])}</h${level}>`); }
    else if (line.trim()) result.push(`<p>${inline(line)}</p>`);
  }
  close();
  return result.join("\n");
}
const docs = await Promise.all(entries.map(async ([file, title, state, implementation], i) => ({ file, title, state, implementation, id: `spec-${i + 1}`, content: await readFile(new URL(file, dir), "utf8") })));
const mapping = await readFile(new URL("spec-test-map.md", dir), "utf8");
const rows = docs.map((d) => `<tr><td><a href="#${d.id}">${escape(d.title)}</a></td><td>${escape(d.state)}</td><td>${escape(d.implementation)}</td></tr>`).join("\n");
const sections = docs.map((d) => `<details id="${d.id}"><summary>${escape(d.title)} <span>${escape(d.state)} · ${escape(d.implementation)}</span></summary><div class="content">${render(d.content)}</div></details>`).join("\n");
const html = `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>仕様とテストの一覧</title>
<style>body{font-family:system-ui,sans-serif;line-height:1.7;color:#17223b;background:#f3f6fb;margin:0}main{max-width:1050px;margin:auto;padding:32px 20px 80px}h1{margin-bottom:4px}h2{margin-top:40px}p{margin:.65em 0}a{color:#1556a1}table{border-collapse:collapse;width:100%;background:white}td{border:1px solid #d7dfeb;padding:9px;vertical-align:top}.table{overflow-x:auto}details{background:white;border:1px solid #d7dfeb;border-radius:8px;margin:12px 0}summary{cursor:pointer;font-weight:700;padding:16px}summary span{font-size:.85em;font-weight:400;color:#53627a;margin-left:10px}.content{padding:0 20px 20px;overflow-wrap:anywhere}code{background:#eef2f7;padding:2px 4px;border-radius:3px}small{color:#53627a}</style></head>
<body><main><h1>仕様とテストの一覧</h1><p>仕様は作成時の記録です。現在の実装とは異なる場合があります。テストの対応は存在を示し、実行結果を示すものではありません。</p><p><a href="#specifications">仕様を読む</a> · <a href="#tests">テストとの対応を見る</a></p><h2>一覧</h2><div class="table"><table><thead><tr><td>課題</td><td>仕様の状態</td><td>実装</td></tr></thead><tbody>${rows}</tbody></table></div><h2 id="specifications">仕様</h2>${sections}<section id="tests"><h2>テストとの対応</h2>${render(mapping)}</section><hr><small>仕様または対応表を更新したら、リポジトリのルートで node tasks/build-index.mjs を実行してください。</small></main><script>function reveal(){const target=document.getElementById(location.hash.slice(1));if(target?.tagName==='DETAILS')target.open=true}addEventListener('hashchange',reveal);reveal()</script></body></html>\n`;
await writeFile(new URL("index.html", dir), html);
