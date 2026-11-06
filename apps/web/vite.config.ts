import babel from "@rolldown/plugin-babel";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const SERVER_PORT = 4777;

export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    // LocatorJS, dev server only: Option/Alt-click a component in the page to open its source.
    // React 19 no longer records where JSX came from, so this Babel pass tags each element.
    command === "serve" &&
      babel({
        include: /[\\/]src[\\/].*\.tsx$/,
        // A path, so Babel doesn't rewrite the name to '@locator/babel-plugin-babel-jsx'.
        plugins: ["@locator/babel-jsx/dist"],
      }),
  ],
  server: {
    host: "0.0.0.0",
    // Next to the server's 4777, not Vite's usual 5173: another project's dev server often
    // holds that one, and http://localhost:5173 would open it instead of this app.
    port: 1111,
    strictPort: true,
    // The dev server forwards the WebSocket, skin API and sprites to the Fastify server.
    proxy: {
      "/ws": { target: `ws://127.0.0.1:${SERVER_PORT}`, ws: true },
      "/api": { target: `http://127.0.0.1:${SERVER_PORT}` },
      "/skins": { target: `http://127.0.0.1:${SERVER_PORT}` },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
    // Served from 127.0.0.1 only, so a single ~200 kB (gzip) bundle is fine; no need to split.
    chunkSizeWarningLimit: 800,
  },
}));
