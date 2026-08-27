import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { fileURLToPath } from "url";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(currentDirectory, "./src"),
    },
  },
  build: {
    // ─── DO NOT WIPE dist/ ON BUILD ───
    //
    // Vite content-hashes every chunk, and `emptyOutDir` defaults to true — so
    // a deploy deletes the previous build's chunks the moment the new one is
    // written. Every browser with the CRM already open is then holding a module
    // graph that names files which no longer exist, and the next navigation to
    // a lazily-loaded page dies with:
    //
    //   Failed to fetch dynamically imported module: .../EmployeeDashboard-<hash>.js
    //
    // which surfaces as the ErrorBoundary's "Something went wrong". It reads as
    // random because it depends on how long a tab has been open relative to the
    // last deploy — so it hits everyone who leaves the CRM open all day, and
    // never the person who just deployed and hard-refreshed.
    //
    // Keeping the old chunks alongside the new ones means open tabs keep
    // working across a deploy. index.html is still overwritten, so new visitors
    // get the new build immediately. Run `node scripts/prune-dist.js` on a
    // schedule to clear out what nothing references any more.
    emptyOutDir: false,

    // Ensure compatibility with older browsers including iOS Safari
    target: ["es2015", "edge88", "firefox78", "chrome87", "safari13"],
    // Generate sourcemaps for debugging iOS issues
    sourcemap: false,
    // Optimize for mobile
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: false, // Keep console for debugging, set to true for production
      },
      safari10: true, // Ensure Safari 10+ compatibility
    },
  },
  optimizeDeps: {
    // Pre-bundle dependencies for faster loading on mobile
    include: ["react", "react-dom", "react-redux"],
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
        secure: false,
      },
      "/socket.io": {
        target: "ws://localhost:5000", // backend with socket.io
        ws: true, // important: enable websocket proxying
        changeOrigin: true,
      },
    },
  },
});
