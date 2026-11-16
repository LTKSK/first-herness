import { spawnSync } from "node:child_process";
import { createConnection } from "mysql2/promise";

if (
  process.env.STRYKER_TEST_MODE !== "e2e" ||
  process.env.MYSQL_HOST !== "127.0.0.1" ||
  process.env.MYSQL_DATABASE !== "tasks_test" ||
  !process.env.STRYKER_ISOLATED_PROJECT?.startsWith("hernes-mutation-")
) {
  throw new Error("E2E mutation tests require the isolated database created by test-mutation.mjs");
}
const db = await createConnection({
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
});
try {
  await db.query("DROP TABLE IF EXISTS tasks");
} finally {
  await db.end();
}
const result = spawnSync("npx", ["playwright", "test"], { stdio: "inherit" });
process.exitCode = result.status ?? 1;
