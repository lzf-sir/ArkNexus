import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// Vite + React + Ant Design dev server.
// All /api requests are forwarded to the ArkNexus gateway (default :8080),
// which in turn proxies to the email-service (default :8000). This is what
// gives us JWT-edge enforcement in dev.
const GATEWAY_URL = process.env.VITE_GATEWAY_URL ?? "http://127.0.0.1:8080";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Register the service worker only in production. In dev the SW fights
      // with HMR and causes stale chunks after edits.
      registerType: "autoUpdate",
      injectRegister: "auto",
      devOptions: {
        enabled: false,
      },
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "ArkNexus — 个人超级工作台",
        short_name: "ArkNexus",
        description: "临时邮箱 + 多模型 AI 对话 + 统一配置中心",
        theme_color: "#0071e3",
        background_color: "#fbfbfd",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        lang: "zh-CN",
        icons: [
          {
            src: "/icon-192.svg",
            sizes: "192x192",
            type: "image/svg+xml",
            purpose: "any",
          },
          {
            src: "/icon-512.svg",
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        // Bump on every release to invalidate caches. CI can rewrite this
        // file's header via `npm version`.
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // Static font + image assets → cache-first for 30 days.
            urlPattern: /\.(?:js|css|woff2?|ttf|otf|png|jpg|jpeg|gif|svg|webp)$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "arknexus-assets",
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
          {
            // GET /api/v1/ai/config — the catalog changes rarely, so stale-while-
            // revalidate gives instant chat loads on return visits.
            urlPattern: /\/api\/v1\/ai\/config$/,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "arknexus-ai-config",
              expiration: { maxEntries: 4, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
          {
            // GET /api/v1/email/messages — same story: recent inbox loads instantly.
            urlPattern: /\/api\/v1\/email\/messages(\?|$)/,
            handler: "NetworkFirst",
            options: {
              cacheName: "arknexus-inbox",
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 12 },
            },
          },
        ],
      },
    }),
  ],
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