// ============================================
// src/main.tsx — Entrée principale stable Cloudflare + React + Tailwind
// - PROD : enregistre uniquement /sw.js (non-module), chemin absolu
// - DEV  : désenregistre tout Service Worker + purge caches
// ============================================
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// ---------- Service Worker policy ----------
if ("serviceWorker" in navigator) {
  if (import.meta.env.PROD) {
    // Production (Cloudflare Pages) — enregistre /sw.js
    window.addEventListener("load", async () => {
      try {
        // Si d’anciens SW existent (ex: /service-worker.js), on les retire
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(
          regs
            .filter((r) => !(r.active?.scriptURL.endsWith("/sw.js")))
            .map((r) => r.unregister())
        );

        const reg = await navigator.serviceWorker.register("/sw.js"); // chemin ABSOLU
        console.log("✅ Service Worker enregistré :", reg.scope);
      } catch (err) {
        console.error("⚠️ SW register error", err);
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

// ---------- Point d’entrée React ----------
const container = document.getElementById("root");
if (!container) throw new Error("❌ Élément #root introuvable dans index.html");

createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
