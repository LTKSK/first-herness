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

describe("タスクAPI", () => {
  it("作成時にタイトルの前後の空白を除去する", async () => {
    const app = createApp(db);
    const response = await app.request("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "  first  " }),
    });
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ title: "first" });
  });
  it("更新時にタイトルの前後の空白を除去する", async () => {
    const app = createApp(db);
    const created = await app.request("/api/tasks", {
      method: "POST",
      body: JSON.stringify({ title: "first" }),
    });
    const task = (await created.json()) as { id: number };
    const updated = await app.request(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: " updated " }),
    });
    expect(updated.status).toBe(200);
    expect(await updated.json()).toEqual({ id: task.id, title: "updated", completed: false });
  });
  it("DBを開き直しても更新済みタイトルを一覧に表示する", async () => {
    let app = createApp(db);
    const created = await app.request("/api/tasks", {
      method: "POST",
      body: JSON.stringify({ title: "  first  " }),
    });
    const task = (await created.json()) as { id: number };
    await app.request(`/api/tasks/${task.id}`, {
      method: "PATCH",
      body: JSON.stringify({ title: " updated " }),
    });
    db.close();
    db = new DatabaseSync(join(directory, "test.sqlite"));
    app = createApp(db);
    const list = await app.request("/api/tasks");
    expect(list.status).toBe(200);
    expect(await list.json()).toEqual([{ id: task.id, title: "updated", completed: false }]);
  });
  it.each([
    ["空白のみのタイトル", '{"title":"  "}'],
    ["不正なJSON", "{"],
    ["数値のタイトル", '{"title":1}'],
    ["タイトルなし", "{}"],
  ])("作成時に%sを400で拒否する", async (_name, body) => {
    const app = createApp(db);
    const result = await app.request("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    expect(result.status).toBe(400);
  });
  it("空のタイトルへの更新を400で拒否する", async () => {
    const app = createApp(db);
    const result = await app.request("/api/tasks/1", {
      method: "PATCH",
      body: JSON.stringify({ title: "" }),
    });
    expect(result.status).toBe(400);
  });
  it("存在しないタスクの更新に404を返す", async () => {
    const app = createApp(db);
    const result = await app.request("/api/tasks/999", {
      method: "PATCH",
      body: JSON.stringify({ title: "hello" }),
    });
    expect(result.status).toBe(404);
  });
});

describe("完了状態", () => {
  it("旧DBのIDとタイトルを保持し未完了として移行する", async () => {
    db.exec(
      "CREATE TABLE tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL); INSERT INTO tasks (id, title) VALUES (42, 'existing')",
    );
    const app = createApp(db);
    expect(await (await app.request("/api/tasks")).json()).toEqual([
      { id: 42, title: "existing", completed: false },
    ]);
  });
  it("新規タスクを未完了で作成する", async () => {
    const app = createApp(db);
    const response = await app.request("/api/tasks", {
      method: "POST",
      body: JSON.stringify({ title: "new" }),
    });
    expect(await response.json()).toMatchObject({ title: "new", completed: false });
  });
  it.each([
    ["完了", true],
    ["未完了", false],
  ])("%sへの変更をDBの再オープン後も保持する", async (_name, completed) => {
    let app = createApp(db);
    await app.request("/api/tasks", { method: "POST", body: JSON.stringify({ title: "task" }) });
    await app.request("/api/tasks/1", {
      method: "PATCH",
      body: JSON.stringify({ completed: true }),
    });
    await app.request("/api/tasks/1", { method: "PATCH", body: JSON.stringify({ completed }) });
    db.close();
    db = new DatabaseSync(join(directory, "test.sqlite"));
    app = createApp(db);
    expect(await (await app.request("/api/tasks")).json()).toEqual([
      { id: 1, title: "task", completed },
    ]);
  });
  it("真偽値以外の完了状態を400で拒否する", async () => {
    const app = createApp(db);
    expect(
      (
        await app.request("/api/tasks/1", {
          method: "PATCH",
          body: JSON.stringify({ completed: 1 }),
        })
      ).status,
    ).toBe(400);
  });
});

it("移行後の完了状態を同じDBの再オープン後も保持する", async () => {
  db.exec(
    "CREATE TABLE tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL); INSERT INTO tasks (id, title) VALUES (42, 'existing')",
  );
  let app = createApp(db);
  const updated = await app.request("/api/tasks/42", {
    method: "PATCH",
    body: JSON.stringify({ completed: true }),
  });
  expect(updated.status).toBe(200);
  db.close();
  db = new DatabaseSync(join(directory, "test.sqlite"));
  app = createApp(db);
  expect(await (await app.request("/api/tasks")).json()).toEqual([
    { id: 42, title: "existing", completed: true },
  ]);
});

it.each(["0", "-1", "1.5", "9007199254740992", "abc"])(
  "不正なID %s の更新に404を返す",
  async (id) => {
    const app = createApp(db);
    const result = await app.request(`/api/tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ completed: true }),
    });
    expect(result.status).toBe(404);
  },
);

it("更新時に不正なJSONを400で拒否する", async () => {
  const app = createApp(db);
  expect((await app.request("/api/tasks/1", { method: "PATCH", body: "{" })).status).toBe(400);
});

it("想定外のDB障害には500を返す", async () => {
  const app = createApp(db);
  db.close();
  try {
    expect((await app.request("/api/tasks")).status).toBe(500);
  } finally {
    db = new DatabaseSync(join(directory, "test.sqlite"));
  }
});
