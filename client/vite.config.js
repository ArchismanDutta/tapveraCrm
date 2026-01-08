import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
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
