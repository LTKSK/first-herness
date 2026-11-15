import { chromium } from "@playwright/test";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

const [checkoutArg, scenarioArg, outputArg] = process.argv.slice(2);
if (!checkoutArg || !scenarioArg || !outputArg)
  throw new Error(
    "Usage: node viewer/record-scenario.mjs <candidate checkout> <scenario.mjs> <output directory>",
  );
const checkout = resolve(checkoutArg),
  output = resolve(outputArg);
const candidate = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: checkout,
  encoding: "utf8",
}).trim();
if (execFileSync("git", ["status", "--porcelain"], { cwd: checkout, encoding: "utf8" }).trim())
  throw new Error("Candidate checkout must be clean and committed");
const scenario = await import(pathToFileURL(resolve(scenarioArg)).href);
if (typeof scenario.start !== "function" || typeof scenario.run !== "function")
  throw new Error("Scenario must export start and run");
await mkdir(output);
const temp = await mkdtemp(join(tmpdir(), "review-video-"));
let environment, browser;
try {
  environment = await scenario.start({ checkout });
  if (!environment?.url || typeof environment.stop !== "function")
    throw new Error("start must return url and stop");
  browser = await chromium.launch({ headless: true, slowMo: 250 });
  for (const annotated of [true]) {
    const context = await browser.newContext({
      viewport: { width: 1200, height: 820 },
      recordVideo: { dir: temp, size: { width: 1200, height: 820 } },
    });
    const page = await context.newPage(),
      video = page.video();
    try {
      const note = async (message) => {
        if (annotated)
          await page.evaluate((text) => {
            let box = document.getElementById("review-video-note");
            if (!box) {
              box = document.createElement("div");
              box.id = "review-video-note";
              Object.assign(box.style, {
                position: "fixed",
                bottom: "20px",
                left: "20px",
                right: "20px",
                padding: "14px",
                background: "#162c23",
                color: "white",
                font: "bold 20px sans-serif",
                zIndex: "2147483647",
              });
              document.body.append(box);
            }
            box.textContent = text;
          }, message);
        await page.waitForTimeout(1000);
      };
      await page.goto(environment.url);
      await scenario.run({ page, note, annotated });
    } finally {
      await context.close();
    }
    if (!video) throw new Error("Video was not created");
    await video.saveAs(join(output, "annotated.webm"));
  }
  await writeFile(
    join(output, "videos.json"),
    JSON.stringify(
      {
        candidate,
        videos: [
          {
            kind: "annotated",
            title: "仕様とチェックの注釈",
            path: "annotated.webm",
            targetId: candidate,
          },
        ],
      },
      null,
      2,
    ) + "\n",
  );
} finally {
  if (browser) await browser.close();
  if (environment?.stop) await environment.stop();
  await rm(temp, { recursive: true, force: true });
}
