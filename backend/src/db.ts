import mysql from "mysql2/promise";

export function createDatabase() {
  return mysql.createPool({
    host: process.env.MYSQL_HOST ?? "127.0.0.1",
    port: Number(process.env.MYSQL_PORT ?? 3306),
    user: process.env.MYSQL_USER ?? "tasks",
    password: process.env.MYSQL_PASSWORD ?? "tasks",
    database: process.env.MYSQL_DATABASE ?? "tasks",
    charset: "utf8mb4",
    dateStrings: true,
  });
}

export async function initializeDatabase(db: mysql.Pool) {
  await db.execute(`CREATE TABLE IF NOT EXISTS tasks (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    title LONGTEXT NOT NULL,
    completed BOOLEAN NOT NULL DEFAULT FALSE
  ) CHARACTER SET utf8mb4`);
  const [columns] = await db.query<mysql.RowDataPacket[]>(
    "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",
    ["tasks", "due_date"],
  );
  if (columns.length === 0) {
    try {
      await db.execute("ALTER TABLE tasks ADD COLUMN due_date VARCHAR(10) NULL DEFAULT NULL");
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ER_DUP_FIELDNAME"))
        throw error;
    }
  }
}
