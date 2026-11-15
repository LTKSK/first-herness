import { serve } from "@hono/node-server";
import { createApp } from "./app.ts";
import { createDatabase, initializeDatabase } from "./db.ts";

const db = createDatabase();
await initializeDatabase(db);
const port = Number(process.env.PORT ?? 3000);
const server = serve({ fetch: createApp(db).fetch, port, hostname: "127.0.0.1" }, () => {
  console.log(`API: http://127.0.0.1:${port}`);
});
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () =>
    server.close(() => {
      void db.end().finally(() => process.exit(0));
    }),
  );
}
