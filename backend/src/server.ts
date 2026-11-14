import { serve } from "@hono/node-server";
import { DatabaseSync } from "node:sqlite";
import { createApp } from "./app.ts";

const db = new DatabaseSync(process.env.DB_PATH ?? "tasks.sqlite");
const port = Number(process.env.PORT ?? 3000);
const server = serve({ fetch: createApp(db).fetch, port, hostname: "127.0.0.1" }, () => {
  console.log(`API: http://127.0.0.1:${port}`);
});
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () =>
    server.close(() => {
      db.close();
      process.exit(0);
    }),
  );
}
