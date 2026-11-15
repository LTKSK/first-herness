import mysql from "mysql2/promise";

export function createDatabase() {
  return mysql.createPool({
    host: process.env.MYSQL_HOST ?? "127.0.0.1",
    port: Number(process.env.MYSQL_PORT ?? 3306),
    user: process.env.MYSQL_USER ?? "tasks",
    password: process.env.MYSQL_PASSWORD ?? "tasks",
    database: process.env.MYSQL_DATABASE ?? "tasks",
    charset: "utf8mb4",
  });
}

export async function initializeDatabase(db: mysql.Pool) {
  await db.execute(`CREATE TABLE IF NOT EXISTS tasks (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    title LONGTEXT NOT NULL,
    completed BOOLEAN NOT NULL DEFAULT FALSE
  ) CHARACTER SET utf8mb4`);
}
