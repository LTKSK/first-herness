import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: "frontend",
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    proxy: { "/api": `http://127.0.0.1:${process.env.API_PORT ?? "3000"}` },
  },
  build: { outDir: "../dist", emptyOutDir: true },
});
