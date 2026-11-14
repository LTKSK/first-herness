import { Hono } from "hono";
import { DatabaseSync } from "node:sqlite";

type Task = { id: number; title: string };

export function createApp(db: DatabaseSync) {
  db.exec(
    "CREATE TABLE IF NOT EXISTS tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL)",
  );
  const app = new Hono();
  app.get("/api/tasks", (c) => c.json(db.prepare("SELECT id, title FROM tasks ORDER BY id").all()));
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
    return c.json({ id: Number(result.lastInsertRowid), title }, 201);
  });
  app.patch("/api/tasks/:id", async (c) => {
    const title = await titleFromRequest(c.req.raw);
    if (!title) return c.json({ error: "タイトルを入力してください" }, 400);
    const id = c.req.param("id");
    if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id)))
      return c.json({ error: "タスクが見つかりません" }, 404);
    const result = db.prepare("UPDATE tasks SET title = ? WHERE id = ?").run(title, Number(id));
    if (!result.changes) return c.json({ error: "タスクが見つかりません" }, 404);
    return c.json(db.prepare("SELECT id, title FROM tasks WHERE id = ?").get(Number(id)) as Task);
  });
  return app;
}
