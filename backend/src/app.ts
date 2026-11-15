import { Hono } from "hono";
import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";

type Task = { id: number; title: string; completed: boolean; dueDate: string | null };

type TaskRow = RowDataPacket & {
  id: number;
  title: string;
  completed: number;
  due_date: string | null;
};

function validDueDate(value: unknown): value is string | null {
  if (value === null) return true;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

export function createApp(db: Pool) {
  const taskFromRow = (row: TaskRow): Task => ({
    id: row.id,
    title: row.title,
    completed: Boolean(row.completed),
    dueDate: row.due_date,
  });
  const app = new Hono();
  app.get("/api/tasks", async (c) => {
    const [rows] = await db.execute<TaskRow[]>(
      "SELECT id, title, completed, due_date FROM tasks ORDER BY id",
    );
    return c.json(rows.map(taskFromRow));
  });
  app.post("/api/tasks", async (c) => {
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
      typeof input.title !== "string" ||
      !input.title.trim() ||
      (Object.hasOwn(input, "dueDate") && !validDueDate(input.dueDate))
    )
      return c.json({ error: "不正な入力です" }, 400);
    const title = input.title.trim();
    const dueDate = (input.dueDate ?? null) as string | null;
    const [result] = await db.execute<ResultSetHeader>(
      "INSERT INTO tasks (title, due_date) VALUES (?, ?)",
      [title, dueDate],
    );
    return c.json({ id: result.insertId, title, completed: false, dueDate }, 201);
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
      (!Object.hasOwn(input, "title") &&
        !Object.hasOwn(input, "completed") &&
        !Object.hasOwn(input, "dueDate")) ||
      (Object.hasOwn(input, "title") && (typeof input.title !== "string" || !input.title.trim())) ||
      (Object.hasOwn(input, "completed") && typeof input.completed !== "boolean") ||
      (Object.hasOwn(input, "dueDate") && !validDueDate(input.dueDate))
    )
      return c.json({ error: "不正な入力です" }, 400);
    const id = c.req.param("id");
    if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id)))
      return c.json({ error: "タスクが見つかりません" }, 404);
    const fields: string[] = [];
    const values: (string | number | null)[] = [];
    if (typeof input.title === "string") {
      fields.push("title = ?");
      values.push(input.title.trim());
    }
    if (typeof input.completed === "boolean") {
      fields.push("completed = ?");
      values.push(Number(input.completed));
    }
    if (Object.hasOwn(input, "dueDate") && validDueDate(input.dueDate)) {
      fields.push("due_date = ?");
      values.push(input.dueDate);
    }
    const [result] = await db.execute<ResultSetHeader>(
      `UPDATE tasks SET ${fields.join(", ")} WHERE id = ?`,
      [...values, Number(id)],
    );
    if (result.affectedRows === 0) return c.json({ error: "タスクが見つかりません" }, 404);
    const [rows] = await db.execute<TaskRow[]>(
      "SELECT id, title, completed, due_date FROM tasks WHERE id = ?",
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
