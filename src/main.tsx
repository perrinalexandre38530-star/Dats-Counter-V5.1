// ============================================
// src/main.tsx — Entrée principale Cloudflare + React + Tailwind
// - PROD : enregistre uniquement /sw.js (non-module), auto-update + auto-reload
// - DEV  : désenregistre tous les Service Workers + purge caches (safe StackBlitz)
// ============================================
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

/* ---------- Service Worker policy ---------- */
const IS_STACKBLITZ =
  /stackblitz\.com$/.test(location.hostname) || /webcontainer\.io$/.test(location.hostname);
const IS_PROD = import.meta.env.PROD && !IS_STACKBLITZ;

if ("serviceWorker" in navigator) {
  if (IS_PROD) {
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

        // 2) Enregistre le SW unique (chemin ABSOLU)
        const reg = await navigator.serviceWorker.register("/sw.js");

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
    (async () => {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister().catch(() => {})));
      } catch {}
      try {
        if (typeof caches !== "undefined" && caches.keys) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
      } catch {}
      // Petit plus : si un SW venait d'être actif, on force un reload "propre"
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          location.reload();
        });
      }
      console.log("🧹 Dev mode: SW désenregistrés + caches purgés");
    })();
  }
}

/* ---------- DEBUG console helper ---------- */
(async () => {
  (window as any).dumpStore = async () => {
    const { loadStore } = await import("./lib/storage");
    const s = await loadStore<any>();
    console.log("STORE =", s);
    console.log("statsByPlayer =", s?.statsByPlayer);
    console.log(
      "Dernier summary =",
      Array.isArray(s?.history) ? s.history[s.history.length - 1]?.summary : undefined
    );
    return s;
  };
})();

/* ---------- Point d’entrée React ---------- */
const container = document.getElementById("root");
if (!container) throw new Error("❌ Élément #root introuvable dans index.html");

createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
