import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite + React + Ant Design dev server.
// All /api requests are forwarded to the ArkNexus gateway (default :8080),
// which in turn proxies to the email-service (default :8000). This is what
// gives us JWT-edge enforcement in dev.
const GATEWAY_URL = process.env.VITE_GATEWAY_URL ?? "http://127.0.0.1:8080";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": "/src",
    },
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      "/api": {
        target: GATEWAY_URL,
        changeOrigin: false,
      },
    },
  },
});
