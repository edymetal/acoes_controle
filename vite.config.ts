import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/icon.svg", "icons/icon-192.png", "icons/icon-512.png"],
      manifest: {
        name: "Controle de Ações",
        short_name: "Ações",
        description: "Controle e acompanhamento da sua carteira de ações americanas.",
        theme_color: "#08111f",
        background_color: "#08111f",
        display: "standalone",
        orientation: "any",
        lang: "pt-BR",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png}"],
        cleanupOutdatedCaches: true,
        runtimeCaching: process.env.VITE_DATA_BASE_URL ? [] : [
          {
            urlPattern: ({ url, sameOrigin }) => sameOrigin && /\/data\/(?:portfolio|fiis|crypto|fixed-income)\.json$/.test(url.pathname),
            handler: "NetworkFirst",
            options: {
              cacheName: "investment-data",
              networkTimeoutSeconds: 8,
              expiration: { maxEntries: 8, maxAgeSeconds: 24 * 60 * 60 },
            },
          },
        ],
      },
    }),
  ],
  base: process.env.VITE_BASE_PATH ?? "/acoes_controle/",
  build: {
    sourcemap: false,
  },
});
