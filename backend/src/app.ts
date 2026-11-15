import { Hono } from "hono";
import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";

type Task = { id: number; title: string; completed: boolean };

type TaskRow = RowDataPacket & { id: number; title: string; completed: number };

export function createApp(db: Pool) {
  const taskFromRow = (row: TaskRow): Task => ({
    id: row.id,
    title: row.title,
    completed: Boolean(row.completed),
  });
  const app = new Hono();
  app.get("/api/tasks", async (c) => {
    const [rows] = await db.execute<TaskRow[]>(
      "SELECT id, title, completed FROM tasks ORDER BY id",
    );
    return c.json(rows.map(taskFromRow));
  });
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
    const [result] = await db.execute<ResultSetHeader>("INSERT INTO tasks (title) VALUES (?)", [
      title,
    ]);
    return c.json({ id: result.insertId, title, completed: false }, 201);
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
    const fields: string[] = [];
    const values: (string | number)[] = [];
    if (typeof input.title === "string") {
      fields.push("title = ?");
      values.push(input.title.trim());
    }
    if (typeof input.completed === "boolean") {
      fields.push("completed = ?");
      values.push(Number(input.completed));
    }
    const [result] = await db.execute<ResultSetHeader>(
      `UPDATE tasks SET ${fields.join(", ")} WHERE id = ?`,
      [...values, Number(id)],
    );
    if (result.affectedRows === 0) return c.json({ error: "タスクが見つかりません" }, 404);
    const [rows] = await db.execute<TaskRow[]>(
      "SELECT id, title, completed FROM tasks WHERE id = ?",
      [Number(id)],
    );
    const updated = rows[0];
    if (!updated) return c.json({ error: "タスクが見つかりません" }, 404);
    return c.json(taskFromRow(updated));
  });
  app.delete("/api/tasks/:id", async (c) => {
    const id = c.req.param("id");
    if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id)))
      return c.json({ error: "タスクが見つかりません" }, 404);
    const [result] = await db.execute<ResultSetHeader>("DELETE FROM tasks WHERE id = ?", [
      Number(id),
    ]);
    if (result.affectedRows === 0) return c.json({ error: "タスクが見つかりません" }, 404);
    return c.body(null, 204);
  });
  return app;
}
