import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

const directory = mkdtempSync(join(tmpdir(), "harness-e2e-"));
const child = spawn(process.execPath, ["--import", "tsx", "backend/src/server.ts"], {
  env: { ...process.env, DB_PATH: join(directory, "tasks.sqlite"), PORT: "31337" },
  stdio: "inherit",
});
let stopping = false;
function stop() {
  if (!stopping) {
    stopping = true;
    child.kill("SIGTERM");
  }
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
child.on("exit", (code) => {
  rmSync(directory, { recursive: true, force: true });
  process.exit(stopping ? 0 : (code ?? 1));
});
