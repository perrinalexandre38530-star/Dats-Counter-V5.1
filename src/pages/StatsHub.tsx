// src/pages/StatsHub.tsx
import React from "react";
import type { Store } from "../lib/types";
import StatsPage from "./StatsPage";       // ta page Stats existante
import HistoryPage from "./HistoryPage";   // ta page Historique existante

export default function StatsHub({ store }: { store: Store }) {
  const [tab, setTab] = React.useState<"stats" | "history">("stats");

  return (
    <div className="container">
      {/* Segmented control */}
      <div className="seg">
        <button
          className={`seg-btn ${tab === "stats" ? "active" : ""}`}
          onClick={() => setTab("stats")}
        >
          Stats
        </button>
        <button
          className={`seg-btn ${tab === "history" ? "active" : ""}`}
          onClick={() => setTab("history")}
        >
          Historique
        </button>
      </div>

      {/* Contenu */}
      <div style={{ marginTop: 16 }}>
        {tab === "stats" ? <StatsPage store={store} /> : <HistoryPage store={store} />}
      </div>
    </div>
  );
}
