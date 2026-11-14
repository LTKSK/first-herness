import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../../backend/src/app.ts";

let db: DatabaseSync;
let directory: string;
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "harness-api-"));
  db = new DatabaseSync(join(directory, "test.sqlite"));
});
afterEach(() => {
  db.close();
  rmSync(directory, { recursive: true, force: true });
});

describe("tasks API", () => {
  it("creates, lists and updates trimmed titles and persists them across reopen", async () => {
    let app = createApp(db);
    const created = await app.request("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "  first  " }),
    });
    expect(created.status).toBe(201);
    const task = (await created.json()) as { id: number; title: string };
    expect(task.title).toBe("first");
    const updated = await app.request(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: " updated " }),
    });
    expect(updated.status).toBe(200);
    expect(await updated.json()).toEqual({ id: task.id, title: "updated" });
    db.close();
    db = new DatabaseSync(join(directory, "test.sqlite"));
    app = createApp(db);
    const list = await app.request("/api/tasks");
    expect(list.status).toBe(200);
    expect(await list.json()).toEqual([{ id: task.id, title: "updated" }]);
  });
  it("rejects invalid inputs and reports missing tasks", async () => {
    const app = createApp(db);
    for (const body of ['{"title":"  "}', "{", '{"title":1}', "{}"]) {
      const result = await app.request("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      expect(result.status).toBe(400);
    }
    const invalid = await app.request("/api/tasks/1", {
      method: "PATCH",
      body: JSON.stringify({ title: "" }),
    });
    expect(invalid.status).toBe(400);
    const missing = await app.request("/api/tasks/999", {
      method: "PATCH",
      body: JSON.stringify({ title: "hello" }),
    });
    expect(missing.status).toBe(404);
  });
});
