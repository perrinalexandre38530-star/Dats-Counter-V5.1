// ============================================
// src/main.tsx — Entrée principale stable Cloudflare + React + Tailwind
// ============================================
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// ✅ Enregistrement du Service Worker (production uniquement)
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js")
      .then(() => console.log("✅ Service Worker enregistré"))
      .catch((err) => console.warn("⚠️ Erreur Service Worker :", err));
  });
}

// ✅ Point d’entrée React 18/19 — strict mode activé
const container = document.getElementById("root");
if (!container) throw new Error("❌ Élément #root introuvable dans index.html");

createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// --- Service Worker policy (dev vs prod) ---
if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    // Prod: OK pour la PWA
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  } else {
    // Dev/StackBlitz: on s'assure de ne JAMAIS garder un SW en cache
    navigator.serviceWorker.getRegistrations().then(regs => {
      regs.forEach(r => r.unregister());
    });
    if (typeof caches !== 'undefined' && caches.keys) {
      caches.keys().then(keys => keys.forEach(k => caches.delete(k)));
    }
    // Empêche un ancien SW déjà contrôlant la page de rester en contrôle
    navigator.serviceWorker.ready
      .then(reg => reg?.unregister?.())
      .catch(() => {});
  }
}
