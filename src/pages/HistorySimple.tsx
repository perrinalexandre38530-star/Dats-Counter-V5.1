// ============================================
// src/pages/HistorySimple.tsx
// Liste d'historique avec stats dérivées simples
// ============================================
import React from "react";
import { History } from "../lib/history";
import { deriveSimpleStats } from "../lib/deriveHistoryStats";

export default function HistorySimple() {
  const [items, setItems] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    (async () => {
      try {
        const arr = await History.list(); // ton API existante
        // tri récent → ancien
        arr.sort((a: any, b: any) => (b?.updatedAt || b?.createdAt || 0) - (a?.updatedAt || a?.createdAt || 0));
        setItems(arr);
      } catch (e) {
        console.warn("History.list() failed:", e);
        setItems([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <div style={{ padding: 16, color: "#eee" }}>Chargement…</div>;
  }

  if (!items.length) {
    return <div style={{ padding: 16, color: "#eee" }}>Aucun match pour le moment.</div>;
  }

  return (
    <div style={{ padding: 16, maxWidth: 780, margin: "0 auto" }}>
      <h2 style={{ color: "#ffcf57", fontWeight: 900, marginBottom: 12 }}>Historique — Stats simples</h2>

      <div style={{ display: "grid", gap: 10 }}>
        {items.map((rec) => {
          const s = deriveSimpleStats(rec);
          const players: Array<{ id: string; name?: string }> = rec?.players || [];
          const when = new Date(rec?.createdAt || rec?.updatedAt || Date.now());
          return (
            <div
              key={rec.id}
              style={{
                border: "1px solid rgba(255,255,255,.08)",
                borderRadius: 12,
                background: "linear-gradient(180deg, rgba(25,25,28,.92), rgba(16,16,18,.96))",
                color: "#e9e9ee",
                padding: 12,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ fontWeight: 900 }}>
                  {s.kind.toUpperCase()} • {when.toLocaleString()}
                </div>
                <div style={{ opacity: 0.8 }}>
                  Gagnant :{" "}
                  <b>
                    {players.find((p) => p.id === s.winnerId)?.name ||
                      s.winnerId ||
                      "—"}
                  </b>
                </div>
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                {players.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr repeat(4, max-content)",
                      gap: 10,
                      alignItems: "center",
                      border: "1px solid rgba(255,255,255,.06)",
                      borderRadius: 10,
                      padding: "6px 8px",
                      background:
                        p.id === s.winnerId
                          ? "rgba(40,160,100,.12)"
                          : "rgba(255,255,255,.03)",
                    }}
                  >
                    <div style={{ fontWeight: 800, color: "#ffcf57" }}>
                      {p.name || p.id}
                    </div>
                    <Stat label="Moy/3D" value={fmt(s.avg3ByPlayer[p.id])} />
                    <Stat label="Darts" value={fmtInt(s.dartsByPlayer[p.id])} />
                    <Stat label="Best" value={fmtInt(s.bestVisitByPlayer[p.id])} />
                    <Stat label="Best CO" value={fmtInt(s.bestCheckoutByPlayer[p.id])} />
                  </div>
                ))}
              </div>

              {/* Ligne de bas de carte */}
              <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
                Checkouts (legs gagnés) : <b>{s.co ?? 0}</b>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "grid", textAlign: "right" }}>
      <div style={{ fontSize: 11, opacity: 0.7 }}>{label}</div>
      <div style={{ fontWeight: 900 }}>{value}</div>
    </div>
  );
}
function fmt(n?: number) {
  return Number.isFinite(n) ? (Math.round((n as number) * 100) / 100).toFixed(2) : "0.00";
}
function fmtInt(n?: number) {
  return Number.isFinite(n) ? String(Math.round(n as number)) : "0";
}
