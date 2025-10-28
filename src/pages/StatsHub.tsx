// ============================================
// src/pages/StatsHub.tsx — Stats + Historique (reprise intégrée)
// ============================================

import { useEffect, useMemo, useState } from "react";
import { History } from "../lib/history";

/* --- Types légers alignés sur l'usage actuel --- */
type PlayerLite = { id: string; name: string };
type SavedMatch = {
  id: string;
  kind: "x01" | "cricket" | string;
  status: "in_progress" | "finished";
  players?: PlayerLite[];
  winnerId?: string | null;
  updatedAt: number; // timestamp (ms)
};

type StatsHubProps = {
  go?: (tab: string, params?: any) => void;
};

export default function StatsHub(props: StatsHubProps) {
  const go = props.go ?? (() => {});
  const [tab, setTab] = useState<"stats" | "history">("history");

  function handleResumeX01(rec: SavedMatch) {
    go("x01", { resumeId: rec.id });
  }
  function handleShowStats(rec: SavedMatch) {
    go("statsDetail", { matchId: rec.id });
  }

  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Onglets */}
      <div
        style={{
          display: "inline-flex",
          gap: 8,
          padding: 6,
          borderRadius: 14,
          background: "linear-gradient(180deg, rgba(20,20,24,.45), rgba(10,10,12,.55))",
          border: "1px solid rgba(255,255,255,.08)",
        }}
      >
        {(["stats", "history"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            style={{
              appearance: "none" as React.CSSProperties["appearance"],
              padding: "10px 16px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,.08)",
              background: tab === k ? "rgba(240,177,42,.18)" : "transparent",
              color: "#eee",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            {k === "stats" ? "Stats" : "Historique"}
          </button>
        ))}
      </div>

      {tab === "stats" ? (
        <StatsPanel />
      ) : (
        <HistoryPanel onResumeX01={handleResumeX01} onShowStats={handleShowStats} />
      )}
    </div>
  );
}

/* ===== Onglet STATS (placeholder) ===== */
function StatsPanel() {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 18,
        background: "linear-gradient(180deg, rgba(20,20,24,.55), rgba(6,6,8,.7))",
        border: "1px solid rgba(255,255,255,.06)",
        color: "#e7e7e7",
      }}
    >
      <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 8, color: "#f0b12a" }}>
        Stats (bientôt)
      </div>
      <div style={{ opacity: 0.8 }}>
        Ajoute ici tes moyennes, meilleurs checkouts, 180, etc.
      </div>
    </div>
  );
}

/* ===== Onglet HISTORIQUE ===== */
function HistoryPanel({
  onResumeX01,
  onShowStats,
}: {
  onResumeX01: (rec: SavedMatch) => void;
  onShowStats: (rec: SavedMatch) => void;
}) {
  const [kind, setKind] = useState<"all" | "x01" | "cricket">("all");
  const [list, setList] = useState<SavedMatch[]>([]);

  useEffect(() => {
    setList((History.list() as unknown as SavedMatch[]) ?? []);
  }, []);
  function refresh() {
    setList((History.list() as unknown as SavedMatch[]) ?? []);
  }

  const filtered = useMemo(
    () => list.filter((r) => (kind === "all" ? true : r.kind === kind)),
    [list, kind]
  );

  return (
    <>
      {/* Filtres + actions globales */}
      <div
        style={{
          display: "flex",
          gap: 8,
          background: "rgba(255,255,255,.06)",
          border: "1px solid rgba(255,255,255,.08)",
          padding: 6,
          borderRadius: 12,
        }}
      >
        {(["all", "x01", "cricket"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            style={{
              appearance: "none" as React.CSSProperties["appearance"],
              padding: "8px 14px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,.08)",
              background: kind === k ? "rgba(240,177,42,.18)" : "transparent",
              color: "#eee",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {k === "all" ? "Tous les jeux" : k.toUpperCase()}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button
          onClick={() => {
            if (confirm("Vider tout l'historique ?")) {
              History.clear();
              refresh();
            }
          }}
          style={{
            appearance: "none" as React.CSSProperties["appearance"],
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,.15)",
            background: "transparent",
            color: "#bbb",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          🗑️ Vider
        </button>
      </div>

      {/* Liste */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map((rec: SavedMatch) => (
          <HistoryItem
            key={rec.id}
            rec={rec}
            onResume={() => {
              if (rec.kind === "x01" && rec.status === "in_progress") onResumeX01(rec);
            }}
            onStats={() => onShowStats(rec)}
            onDelete={() => {
              History.remove(rec.id);
              refresh();
            }}
          />
        ))}

        {filtered.length === 0 && (
          <div style={{ opacity: 0.7, padding: 24, textAlign: "center" }}>
            Aucun enregistrement pour ce filtre.
          </div>
        )}
      </div>
    </>
  );
}

function HistoryItem({
  rec,
  onResume,
  onStats,
  onDelete,
}: {
  rec: SavedMatch;
  onResume: () => void;
  onStats: () => void;
  onDelete: () => void;
}) {
  const date = new Date(rec.updatedAt);
  const statusColor = rec.status === "in_progress" ? "#ff5b5b" : "#41d17d";
  const statusLabel = rec.status === "in_progress" ? "IN PROGRESS" : "FINISHED";
  const players = (rec.players ?? []).map((p: PlayerLite) => p.name).join(" · ");

  return (
    <div
      style={{
        borderRadius: 18,
        padding: 14,
        background: "linear-gradient(180deg, rgba(20,20,24,.55), rgba(6,6,8,.7))",
        border: "1px solid rgba(255,255,255,.06)",
        boxShadow: "0 4px 18px rgba(0,0,0,.35)",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        color: "#e7e7e7",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ fontWeight: 800, color: "#f0b12a" }}>{(rec.kind ?? "").toUpperCase()}</div>
        <div style={{ opacity: 0.8 }}>
          {date.toLocaleDateString()} {date.toLocaleTimeString()}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ fontWeight: 800, color: statusColor }}>{statusLabel}</div>
      </div>

      <div style={{ opacity: 0.9 }}>{players}</div>
      {rec.status === "finished" && rec.winnerId && (
        <div style={{ opacity: 0.9 }}>🏆 {displayWinnerName(rec)}</div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
        {rec.status === "in_progress" && (
          <button onClick={onResume} style={btnStyle("#2b2", "#173")}>
            Reprendre
          </button>
        )}
        <button onClick={onStats} style={btnStyle("#eee", "#222")}>
          Voir stats
        </button>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => {
            if (confirm("Supprimer cette entrée ?")) onDelete();
          }}
          style={btnStyle("#f55", "#3a0")}
        >
          Supprimer
        </button>
      </div>
    </div>
  );
}

function btnStyle(fg: string, border: string): React.CSSProperties {
  return {
    appearance: "none" as React.CSSProperties["appearance"],
    padding: "8px 12px",
    borderRadius: 10,
    background: "transparent",
    border: `1px solid ${border}`,
    color: fg,
    fontWeight: 700,
    cursor: "pointer",
  };
}

function displayWinnerName(rec: SavedMatch): string {
  const p = (rec.players ?? []).find((x) => x.id === rec.winnerId);
  return p ? p.name : "—";
}
