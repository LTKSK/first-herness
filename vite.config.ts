import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

function activateBrowserMutant(): Plugin | null {
  if (process.env.STRYKER_TEST_MODE !== "e2e") return null;
  const active = process.env.__STRYKER_ACTIVE_MUTANT__;
  if (active === undefined) return null;
  if (!/^\d+$/.test(active)) throw new Error("Invalid Stryker mutant ID");
  return {
    name: "activate-browser-mutant",
    transformIndexHtml() {
      return [
        {
          tag: "script",
          children: `globalThis.__stryker__ = { activeMutant: ${JSON.stringify(active)} };`,
          injectTo: "head-prepend",
        },
      ];
    },
  };
}

export default defineConfig({
  root: "frontend",
  plugins: [react(), activateBrowserMutant()],
  server: {
    host: "127.0.0.1",
    proxy: { "/api": `http://127.0.0.1:${process.env.API_PORT ?? "3000"}` },
  },
  build: { outDir: "../dist", emptyOutDir: true },
});
