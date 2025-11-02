// ============================================
// src/main.tsx — Entrée principale Cloudflare + React + Tailwind
// - PROD : enregistre uniquement /sw.js (non-module), auto-update + auto-reload
// - DEV  : désenregistre tous les Service Workers + purge caches
// ============================================
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

/* ---------- Service Worker policy ---------- */
if ("serviceWorker" in navigator) {
  if (import.meta.env.PROD) {
    // Production (Cloudflare Pages) — enregistre /sw.js
    window.addEventListener("load", async () => {
      try {
        // 1) Désenregistre tout SW hérité (ex: /service-worker.js)
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(
          regs
            .filter((r) => !r.active?.scriptURL.endsWith("/sw.js"))
            .map((r) => r.unregister().catch(() => {}))
        );

        // 2) Enregistre le SW unique
        const reg = await navigator.serviceWorker.register("/sw.js"); // chemin ABSOLU
        // 3) Si une nouvelle version est trouvée → on force skipWaiting
        reg.addEventListener("updatefound", () => {
          const nw = reg.installing;
          nw?.addEventListener("statechange", () => {
            if (nw.state === "installed" && navigator.serviceWorker.controller) {
              reg.waiting?.postMessage({ type: "SKIP_WAITING" });
            }
          });
        });

        // 4) Quand le contrôleur change (nouvelle version active) → reload
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          window.location.reload();
        });

        console.log("✅ Service Worker enregistré :", reg.scope);
      } catch (err) {
        console.warn("⚠️ SW register error", err);
      }
    });
  } else {
    // Développement / StackBlitz — jamais de SW persistant
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => Promise.all(regs.map((r) => r.unregister())))
      .catch(() => {});
    if (typeof caches !== "undefined" && caches.keys) {
      caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
    }
  }
}

/* ---------- Point d’entrée React ---------- */
const container = document.getElementById("root");
if (!container) throw new Error("❌ Élément #root introuvable dans index.html");

createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
