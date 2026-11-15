import { spawn } from "node:child_process";
import { createServer } from "node:net";

async function port() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const value = server.address().port;
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return value;
}
async function ready(url, child) {
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error(`Server exited: ${child.exitCode}`);
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      /* starting */
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Server did not start: ${url}`);
}
export async function start({ checkout }) {
  if (!process.env.MYSQL_DATABASE)
    throw new Error("Set MYSQL_DATABASE to a dedicated recording database");
  const apiPort = await port();
  let webPort = await port();
  while (apiPort === webPort) webPort = await port();
  const children = [];
  const launch = (args, env) => {
    const child = spawn(process.execPath, args, {
      cwd: checkout,
      env: { ...process.env, ...env },
      stdio: "inherit",
    });
    children.push(child);
    return child;
  };
  const stop = async () => {
    await Promise.all(
      children.map(async (child) => {
        if (child.exitCode !== null) return;
        const done = new Promise((resolve) => child.once("exit", resolve));
        child.kill("SIGTERM");
        await done;
      }),
    );
  };
  try {
    const api = launch(["--import", "tsx", "backend/src/server.ts"], { PORT: String(apiPort) });
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
    return { url: `http://127.0.0.1:${webPort}/`, stop };
  } catch (error) {
    await stop();
    throw error;
  }
}
export async function run({ page, note }) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const first = `Review Alpha ${suffix}`,
    second = `Review Beta ${suffix}`;
  await note("タイトル検索の対象となるタスクを作成します");
  for (const title of [first, second]) {
    await page.getByLabel("タイトル", { exact: true }).fill(title);
    await page.getByRole("button", { name: "追加" }).click();
    await page.getByText(title, { exact: true }).waitFor();
  }
  await note("検索語を入力すると一致するタスクだけが表示されます");
  await page.getByLabel("タイトルを検索").fill(`alpha ${suffix}`);
  await page.getByText(first, { exact: true }).waitFor();
  if (await page.getByText(second, { exact: true }).count())
    throw new Error("Nonmatching task is visible");
  await note("検索語を消すと両方のタスクが表示されます");
  await page.getByLabel("タイトルを検索").fill("");
  await page.getByText(second, { exact: true }).waitFor();
}
