import { execFileSync, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, relative, sep } from "node:path";

const args = process.argv.slice(2);
const e2e = args.includes("--e2e");
const files = args.filter((arg) => arg !== "--e2e");
if (files.length > 1)
  throw new Error("Usage: npm run test:mutation -- [--e2e] [source file[:start-end]]");
const input = files[0] ?? "frontend/src/search.ts";
const match = input.match(/^(.*?)(?::(\d+)-(\d+))?$/);
if (!match) throw new Error("Invalid source file or line range");
const file = relative(process.cwd(), resolve(match[1])).split(sep).join("/");
if (!/^(frontend|backend)\/src\/.+\.(ts|tsx)$/.test(file) || !existsSync(file))
  throw new Error("Choose an existing .ts or .tsx file inside frontend/src or backend/src");
if (match[2] && (Number(match[2]) < 1 || Number(match[2]) > Number(match[3])))
  throw new Error("Choose a valid line range");
const target = match[2] ? `${file}:${match[2]}-${match[3]}` : file;
const id = randomBytes(6).toString("hex");
const project = `hernes-mutation-${id}`;
const reportDir = `.harness/mutation/${id}`;
mkdirSync(".harness/mutation", { recursive: true });
mkdirSync(reportDir);
const compose = ["compose", "-p", project, "-f", "compose.test.yaml"];
const metadata = {
  target,
  mode: e2e ? "e2e" : "vitest",
  revision: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  dirty: Boolean(execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim()),
  startedAt: new Date().toISOString(),
};
writeFileSync(`${reportDir}/run.json`, JSON.stringify(metadata, null, 2) + "\n");
let active,
  interrupted,
  cleaning = false;
function stop(signal) {
  if (cleaning || interrupted) return;
  interrupted = signal;
  if (active?.pid) {
    try {
      if (process.platform === "win32") active.kill(signal);
      else process.kill(-active.pid, signal);
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
    }
  }
}
process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));
async function run(command, commandArgs, { capture = false, env = process.env } = {}) {
  if (interrupted && !cleaning) throw new Error(`Interrupted by ${interrupted}`);
  return await new Promise((resolveRun, reject) => {
    const child = spawn(command, commandArgs, {
      env,
      detached: process.platform !== "win32",
      stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit",
    });
    active = child;
    let output = "";
    child.stdout?.setEncoding("utf8");
    child.stdout?.on("data", (chunk) => {
      output += chunk;
    });
    child.once("error", (error) => {
      active = undefined;
      reject(error);
    });
    child.once("close", (code, signal) => {
      active = undefined;
      if (code === 0 && !interrupted) resolveRun(output);
      else if (code === 0 && cleaning) resolveRun(output);
      else reject(new Error(`${command} failed (${signal ?? code})`));
    });
  });
}
let result = 1;
try {
  await run("docker", [...compose, "up", "-d", "--wait"]);
  const address = (
    await run("docker", [...compose, "port", "mysql", "3306"], { capture: true })
  ).trim();
  const port = address.slice(address.lastIndexOf(":") + 1);
  await run("npx", ["stryker", "run", "--mutate", target], {
    env: {
      ...process.env,
      STRYKER_REPORT_DIR: reportDir,
      STRYKER_TEST_MODE: e2e ? "e2e" : "vitest",
      STRYKER_ISOLATED_PROJECT: project,
      MYSQL_HOST: "127.0.0.1",
      MYSQL_PORT: port,
      MYSQL_DATABASE: "tasks_test",
      MYSQL_USER: "tasks_test",
      MYSQL_PASSWORD: "testpassword",
    },
  });
  result = 0;
} catch (error) {
  console.error(error.message);
} finally {
  cleaning = true;
  try {
    await run("docker", [...compose, "down", "-v", "--remove-orphans"]);
  } catch (error) {
    console.error(`Cleanup failed: ${error.message}`);
    result = 1;
  }
  if (interrupted) result = interrupted === "SIGINT" ? 130 : 143;
  writeFileSync(
    `${reportDir}/run.json`,
    JSON.stringify(
      {
        ...metadata,
        finishedAt: new Date().toISOString(),
        exitCode: result,
        interrupted: interrupted ?? null,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`Mutation report: ${reportDir}`);
}
process.exitCode = result;
