// ============================================
// vite.config.ts — Config Cloudflare Pages + React + Tailwind
// ============================================
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/", // ✅ important pour Cloudflare Pages (serveur racine)
  plugins: [react()],
  build: {
    outDir: "dist",
    sourcemap: false,
    emptyOutDir: true,
  },
  server: {
    host: true,
    port: 5173,
  },
});
