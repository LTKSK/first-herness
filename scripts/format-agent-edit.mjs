import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  lstatSync,
  unlinkSync,
  writeSync,
} from "node:fs";
import { resolve, relative, join, isAbsolute } from "node:path";
import { tmpdir } from "node:os";

const phase = process.argv[2];
let event;
try {
  event = JSON.parse(readFileSync(0, "utf8"));
} catch {
  console.error("Format hook: invalid event JSON");
  process.exit(2);
}
if (
  !["before", "after"].includes(phase) ||
  typeof event.tool_use_id !== "string" ||
  typeof event.cwd !== "string"
) {
  console.error("Format hook: missing phase, cwd, or tool_use_id");
  process.exit(2);
}
const git = spawnSync("git", ["rev-parse", "--show-toplevel"], {
  cwd: event.cwd,
  encoding: "utf8",
});
if (git.status !== 0) {
  console.error("Format hook: cannot find Git root");
  process.exit(2);
}
const root = resolve(git.stdout.trim());
const digest = (value) => createHash("sha256").update(value).digest("hex");
const stateDir = join(
  tmpdir(),
  `agent-format-hook-${process.getuid?.() ?? "user"}`,
);
const stateFile = join(
  stateDir,
  `${digest(`${root}\0${event.tool_use_id}`)}.json`,
);

function snapshot() {
  const listing = spawnSync(
    "git",
    ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
    { cwd: root, encoding: "utf8", maxBuffer: 20 * 1024 * 1024 },
  );
  if (listing.status !== 0)
    throw new Error(
      `Unable to list files: ${listing.stderr || listing.error?.message}`,
    );
  const files = {};
  for (const file of new Set(listing.stdout.split("\0").filter(Boolean))) {
    if (!/\.(?:ts|tsx)$/.test(file)) continue;
    const path = resolve(root, file);
    const rel = relative(root, path);
    if (!rel || rel.startsWith("..") || isAbsolute(rel)) continue;
    try {
      const info = lstatSync(path);
      if (info.isFile() && !info.isSymbolicLink())
        files[file] = digest(readFileSync(path));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  return files;
}
try {
  if (phase === "before") {
    mkdirSync(stateDir, { recursive: true, mode: 0o700 });
    writeFileSync(stateFile, JSON.stringify(snapshot()), { mode: 0o600 });
  } else {
    let contents;
    try {
      contents = readFileSync(stateFile, "utf8");
    } catch (error) {
      if (error.code === "ENOENT")
        throw new Error(
          "Missing pre-edit snapshot; the file was not formatted",
        );
      throw error;
    }
    unlinkSync(stateFile);
    const before = JSON.parse(contents);
    const after = snapshot();
    const changed = Object.keys(after).filter(
      (file) => before[file] !== after[file],
    );
    if (changed.length) {
      const formatter = join(
        root,
        "node_modules",
        ".bin",
        process.platform === "win32" ? "oxfmt.cmd" : "oxfmt",
      );
      const format = spawnSync(formatter, ["--write", "--", ...changed], {
        cwd: root,
        encoding: "utf8",
        maxBuffer: 10 * 1024 * 1024,
      });
      if (format.status !== 0)
        throw new Error(
          `Oxfmt failed:\n${format.stdout ?? ""}${format.stderr ?? ""}${format.error?.message ?? ""}`,
        );
      console.log(
        JSON.stringify({
          hookSpecificOutput: {
            hookEventName:
              event.hook_event_name === "PostToolUseFailure"
                ? "PostToolUseFailure"
                : "PostToolUse",
            additionalContext: `Oxfmt formatted: ${changed.join(", ")}`,
          },
        }),
      );
    }
  }
} catch (error) {
  writeSync(
    2,
    `Format hook: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 2;
}
