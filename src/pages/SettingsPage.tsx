import React from "react";
import type { Settings } from "../lib/types";
import { clearStore } from "../lib/storage";

export default function SettingsPage({
  value,
  onChange,
}: {
  value: Settings;
  onChange: (s: Settings) => void;
}) {
  function set<K extends keyof Settings>(key: K, v: Settings[K]) {
    onChange({ ...value, [key]: v });
  }

  function onReset() {
    const ok = window.confirm(
      "Réinitialiser toutes les données locales (profils, historiques, réglages) ?\n\nCette action est définitive."
    );
    if (ok) clearStore();
  }

  return (
    <div className="container" style={{ maxWidth: 760 }}>
      {/* ====== X01 ====== */}
      <section className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>X01</h2>

        <div className="grid2" style={{ marginBottom: 10 }}>
          <div>
            <div className="subtitle" style={{ marginBottom: 6 }}>
              Score de départ
            </div>
            <select
              className="input"
              value={value.defaultX01}
              onChange={(e) =>
                set(
                  "defaultX01",
                  Number(e.target.value) as 301 | 501 | 701 | 1001
                )
              }
            >
              <option value={301}>301</option>
              <option value={501}>501</option>
              <option value={701}>701</option>
              <option value={1001}>1001</option>
            </select>
          </div>

          <div>
            <div className="subtitle" style={{ marginBottom: 6 }}>
              Sortie (out mode)
            </div>
            <select
              className="input"
              value={value.doubleOut ? "double" : "single"}
              onChange={(e) => set("doubleOut", e.target.value === "double")}
            >
              <option value="single">Single Out</option>
              <option value="double">Double Out</option>
            </select>
          </div>
        </div>

        <div className="row" style={{ gap: 14 }}>
          <label className="row" style={{ gap: 8 }}>
            <input
              type="checkbox"
              checked={value.randomOrder}
              onChange={(e) => set("randomOrder", e.target.checked)}
            />
            <span>Tirage aléatoire de l’ordre des joueurs</span>
          </label>
        </div>
      </section>

      {/* ====== Ambiance / Voix ====== */}
      <section className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>
          Ambiance & voix
        </h2>

        <div className="row" style={{ gap: 14, marginBottom: 10 }}>
          <label className="row" style={{ gap: 8 }}>
            <input
              type="checkbox"
              checked={value.neonTheme}
              onChange={(e) => set("neonTheme", e.target.checked)}
            />
            <span>Mode arcade (fond néon)</span>
          </label>

          <label className="row" style={{ gap: 8 }}>
            <input
              type="checkbox"
              checked={value.ttsOnThird}
              onChange={(e) => set("ttsOnThird", e.target.checked)}
            />
            <span>Activer la voix à la 3ᵉ fléchette</span>
          </label>
        </div>

        <div style={{ maxWidth: 280 }}>
          <div className="subtitle" style={{ marginBottom: 6 }}>
            Langue
          </div>
          <select
            className="input"
            value={value.lang}
            onChange={(e) => set("lang", e.target.value as Settings["lang"])}
          >
            <option value="fr">Français</option>
            <option value="en">English</option>
          </select>
        </div>
      </section>

      {/* ====== Danger zone ====== */}
      <section className="card" style={{ borderColor: "rgba(255,92,102,.35)" }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>
          Réinitialiser l’application
        </h2>
        <p className="subtitle" style={{ margin: "0 0 12px" }}>
          Efface toutes les données locales (profils, historiques, réglages) et
          redémarre l’application.
        </p>
        <button className="btn danger" onClick={onReset}>
          Réinitialiser les données
        </button>
      </section>
    </div>
  );
}
