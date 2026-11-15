import { execFileSync, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";

const project = `hernes-test-${randomBytes(6).toString("hex")}`;
const compose = ["compose", "-p", project, "-f", "compose.test.yaml"];
let result = 1;
try {
  execFileSync("docker", [...compose, "up", "-d", "--wait"], { stdio: "inherit" });
  const address = execFileSync("docker", [...compose, "port", "mysql", "3306"], {
    encoding: "utf8",
  }).trim();
  const port = address.slice(address.lastIndexOf(":") + 1);
  const runner = process.argv[2];
  if (runner !== "vitest" && runner !== "playwright") throw new Error("Invalid test runner");
  const command = runner === "vitest" ? ["vitest", "run"] : ["playwright", "test"];
  const child = spawnSync("npx", command, {
    stdio: "inherit",
    env: {
      ...process.env,
      MYSQL_HOST: "127.0.0.1",
      MYSQL_PORT: port,
      MYSQL_DATABASE: "tasks_test",
      MYSQL_USER: "tasks_test",
      MYSQL_PASSWORD: "testpassword",
    },
  });
  result = child.status ?? 1;
} finally {
  try {
    execFileSync("docker", [...compose, "down", "-v", "--remove-orphans"], { stdio: "inherit" });
  } catch {
    result = 1;
  }
}
process.exit(result);
