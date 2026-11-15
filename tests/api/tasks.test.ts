import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Pool } from "mysql2/promise";
import { createApp } from "../../backend/src/app.ts";
import { createDatabase, initializeDatabase } from "../../backend/src/db.ts";

let db: Pool;
beforeEach(async () => {
  db = createDatabase();
  await initializeDatabase(db);
  await db.execute("TRUNCATE TABLE tasks");
});
afterEach(async () => {
  await db.end();
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
  it("MySQLへの接続を開き直しても更新済みタイトルを一覧に表示する", async () => {
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
    await db.end();
    db = createDatabase();
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
  ])("%sへの変更をMySQLへの再接続後も保持する", async (_name, completed) => {
    let app = createApp(db);
    await app.request("/api/tasks", { method: "POST", body: JSON.stringify({ title: "task" }) });
    await app.request("/api/tasks/1", {
      method: "PATCH",
      body: JSON.stringify({ completed: true }),
    });
    await app.request("/api/tasks/1", { method: "PATCH", body: JSON.stringify({ completed }) });
    await db.end();
    db = createDatabase();
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
  await db.end();
  try {
    expect((await app.request("/api/tasks")).status).toBe(500);
  } finally {
    db = createDatabase();
  }
});

describe("タスクの削除", () => {
  it("削除したタスクは同じMySQLへ再接続した一覧に現れず、他のタスクは残る", async () => {
    let app = createApp(db);
    await app.request("/api/tasks", { method: "POST", body: JSON.stringify({ title: "削除" }) });
    await app.request("/api/tasks", { method: "POST", body: JSON.stringify({ title: "残す" }) });
    expect((await app.request("/api/tasks/1", { method: "DELETE" })).status).toBe(204);
    await db.end();
    db = createDatabase();
    app = createApp(db);
    expect(await (await app.request("/api/tasks")).json()).toEqual([
      { id: 2, title: "残す", completed: false },
    ]);
  });
  it.each(["999", "0", "-1", "1.5", "9007199254740992", "abc"])(
    "存在しないか不正なID %s の削除に404を返す",
    async (id) => {
      const app = createApp(db);
      expect((await app.request(`/api/tasks/${id}`, { method: "DELETE" })).status).toBe(404);
    },
  );
});

it("長いタイトルを作成してMySQLから読み出せる", async () => {
  const app = createApp(db);
  const title = "長".repeat(30000);
  const created = await app.request("/api/tasks", {
    method: "POST",
    body: JSON.stringify({ title }),
  });
  expect(created.status).toBe(201);
  expect((await (await app.request("/api/tasks")).json())[0].title).toBe(title);
});

it("タイトルと完了状態を並行更新しても両方を保持する", async () => {
  const app = createApp(db);
  await app.request("/api/tasks", { method: "POST", body: JSON.stringify({ title: "before" }) });
  const results = await Promise.all([
    app.request("/api/tasks/1", { method: "PATCH", body: JSON.stringify({ title: "after" }) }),
    app.request("/api/tasks/1", { method: "PATCH", body: JSON.stringify({ completed: true }) }),
  ]);
  expect(results.map((response) => response.status)).toEqual([200, 200]);
  expect(await (await app.request("/api/tasks")).json()).toEqual([
    { id: 1, title: "after", completed: true },
  ]);
});
