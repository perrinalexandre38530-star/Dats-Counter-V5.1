import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// --- Gestion du service worker en production uniquement ---
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js")
      .then(() => console.log("✅ Service Worker enregistré"))
      .catch((err) => console.warn("❌ Échec SW :", err));
  });
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

