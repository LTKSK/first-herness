import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";

const [checkoutArg, outputArg] = process.argv.slice(2);
if (!checkoutArg || !outputArg)
  throw new Error("Usage: node viewer/record.mjs <candidate checkout> <output directory>");
const checkout = resolve(checkoutArg),
  output = resolve(outputArg);
await mkdir(output, { recursive: true });
const temp = await mkdtemp(join(tmpdir(), "task-video-"));
async function freePort() {
  const server = createServer();
  await new Promise((done, fail) => {
    server.once("error", fail);
    server.listen(0, "127.0.0.1", done);
  });
  const port = server.address().port;
  await new Promise((done, fail) => server.close((error) => (error ? fail(error) : done())));
  return port;
}
const apiPort = await freePort();
let webPort = await freePort();
while (webPort === apiPort) webPort = await freePort();
const children = [];
function launch(args, extraEnv) {
  const child = spawn(process.execPath, args, {
    cwd: checkout,
    env: { ...process.env, ...extraEnv },
    stdio: "inherit",
  });
  children.push(child);
  return child;
}
async function ready(url, child) {
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error(`Server exited: ${child.exitCode}`);
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      /* server is starting */
    }
    await new Promise((done) => setTimeout(done, 100));
  }
  throw new Error(`Server did not start: ${url}`);
}
let browser;
try {
  const api = launch(["--import", "tsx", "backend/src/server.ts"], {
    PORT: String(apiPort),
    DB_PATH: join(temp, "tasks.sqlite"),
  });
  await ready(`http://127.0.0.1:${apiPort}/api/tasks`, api);
  const web = launch(
    [
      "node_modules/vite/bin/vite.js",
      "--host",
      "127.0.0.1",
      "--port",
      String(webPort),
      "--strictPort",
    ],
    { API_PORT: String(apiPort) },
  );
  await ready(`http://127.0.0.1:${webPort}/`, web);
  browser = await chromium.launch({ headless: true, slowMo: 250 });
  for (const annotated of [false, true]) {
    const context = await browser.newContext({
      viewport: { width: 1200, height: 820 },
      recordVideo: { dir: temp, size: { width: 1200, height: 820 } },
    });
    const page = await context.newPage();
    const video = page.video();
    const note = async (message) => {
      if (annotated)
        await page.evaluate((text) => {
          let box = document.getElementById("evaluation-video-note");
          if (!box) {
            box = document.createElement("div");
            box.id = "evaluation-video-note";
            Object.assign(box.style, {
              position: "fixed",
              bottom: "20px",
              left: "20px",
              right: "20px",
              padding: "14px 18px",
              background: "#162c23",
              color: "white",
              font: "bold 20px sans-serif",
              borderRadius: "10px",
              zIndex: "2147483647",
              boxShadow: "0 4px 20px #0005",
            });
            document.body.append(box);
          }
          box.textContent = text;
        }, message);
      await page.waitForTimeout(1800);
    };
    await page.goto(`http://127.0.0.1:${webPort}/`);
    await note("期限を指定してタスクを作成します");
    const title = annotated ? "期限の確認（注釈あり）" : "期限の確認";
    await page.getByLabel("タイトル", { exact: true }).fill(title);
    await page.getByLabel("期限", { exact: true }).fill("2032-02-29");
    await page.getByRole("button", { name: "追加" }).click();
    const row = page.locator("li").filter({ hasText: title });
    await row.getByText("期限: 2032-02-29", { exact: false }).waitFor();
    await note("チェック: 作成したタスクと期限が一覧に表示されます");
    await row.getByRole("button", { name: "編集" }).click();
    await page.getByLabel("期限を編集").fill("2032-03-01");
    await page.getByRole("button", { name: "保存" }).click();
    await row.getByText("期限: 2032-03-01", { exact: false }).waitFor();
    await note("チェック: 期限を変更できます");
    await page.reload();
    await row.getByText("期限: 2032-03-01", { exact: false }).waitFor();
    await note("チェック: 再読み込み後も期限が残ります");
    await row.getByRole("button", { name: "編集" }).click();
    await page.getByLabel("期限を編集").fill("");
    await page.getByRole("button", { name: "保存" }).click();
    await row.getByRole("button", { name: "編集" }).waitFor();
    if (await row.getByText("期限:", { exact: false }).count())
      throw new Error("The deadline was not cleared");
    await note("チェック: 期限を解除できます");
    await context.close();
    if (!video) throw new Error("Video recording was not created");
    await video.saveAs(join(output, annotated ? "annotated.webm" : "feature.webm"));
    console.log(`Recorded ${annotated ? "annotated" : "feature"} video`);
  }
} finally {
  if (browser) await browser.close();
  await Promise.all(
    children.map(async (child) => {
      if (child.exitCode === null) {
        const done = new Promise((resolveExit) => child.once("exit", resolveExit));
        child.kill("SIGTERM");
        await done;
      }
    }),
  );
  await rm(temp, { recursive: true, force: true });
}
