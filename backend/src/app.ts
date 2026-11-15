import { Hono } from "hono";
import { DatabaseSync } from "node:sqlite";

type Task = { id: number; title: string; completed: boolean };

export function createApp(db: DatabaseSync) {
  db.exec(
    "CREATE TABLE IF NOT EXISTS tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL)",
  );
  const columns = db.prepare("PRAGMA table_info(tasks)").all();
  if (!columns.some((column) => column.name === "completed")) {
    db.exec("ALTER TABLE tasks ADD COLUMN completed INTEGER NOT NULL DEFAULT 0");
  }
  const taskFromRow = (row: Record<string, unknown>): Task => ({
    id: row.id as number,
    title: row.title as string,
    completed: row.completed === 1,
  });
  const app = new Hono();
  app.get("/api/tasks", (c) =>
    c.json(db.prepare("SELECT id, title, completed FROM tasks ORDER BY id").all().map(taskFromRow)),
  );
  async function titleFromRequest(request: Request): Promise<string | null> {
    try {
      const body: unknown = await request.json();
      if (
        typeof body !== "object" ||
        body === null ||
        !("title" in body) ||
        typeof body.title !== "string"
      )
        return null;
      return body.title.trim() || null;
    } catch {
      return null;
    }
  }
  app.post("/api/tasks", async (c) => {
    const title = await titleFromRequest(c.req.raw);
    if (!title) return c.json({ error: "タイトルを入力してください" }, 400);
    const result = db.prepare("INSERT INTO tasks (title) VALUES (?)").run(title);
    return c.json({ id: Number(result.lastInsertRowid), title, completed: false }, 201);
  });
  app.patch("/api/tasks/:id", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "不正な入力です" }, 400);
    }
    if (typeof body !== "object" || body === null || Array.isArray(body))
      return c.json({ error: "不正な入力です" }, 400);
    const input = body as Record<string, unknown>;
    if (
      (!Object.hasOwn(input, "title") && !Object.hasOwn(input, "completed")) ||
      (Object.hasOwn(input, "title") && (typeof input.title !== "string" || !input.title.trim())) ||
      (Object.hasOwn(input, "completed") && typeof input.completed !== "boolean")
    )
      return c.json({ error: "不正な入力です" }, 400);
    const id = c.req.param("id");
    if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id)))
      return c.json({ error: "タスクが見つかりません" }, 404);
    const existing = db
      .prepare("SELECT id, title, completed FROM tasks WHERE id = ?")
      .get(Number(id));
    if (!existing) return c.json({ error: "タスクが見つかりません" }, 404);
    const title = typeof input.title === "string" ? input.title.trim() : (existing.title as string);
    const completed =
      typeof input.completed === "boolean"
        ? Number(input.completed)
        : (existing.completed as number);
    db.prepare("UPDATE tasks SET title = ?, completed = ? WHERE id = ?").run(
      title,
      completed,
      Number(id),
    );
    return c.json({ id: Number(id), title, completed: Boolean(completed) });
  });
  return app;
}
