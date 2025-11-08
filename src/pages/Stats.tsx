// ============================================
// src/pages/Stats.tsx — Historique + Stats (lecture IDB)
// ============================================
import React from "react";
import { History } from "../lib/history";

type Row = {
  id: string;
  kind?: string;
  status?: "in_progress" | "finished";
  players?: { id: string; name?: string }[];
  winnerId?: string | null;
  createdAt?: number;
  updatedAt?: number;
  summary?: {
    legs?: number;
    darts?: number;
    avg3ByPlayer?: Record<string, number>;
    co?: number;
  } | null;
};

export default function StatsPage() {
  const [rows, setRows] = React.useState<Row[] | null>(null);

  const load = React.useCallback(async () => {
    try {
      const list = await History.list();
      setRows(list as Row[]);
    } catch {
      setRows([]);
    }
  }, []);

  React.useEffect(() => {
    load();
    const onUpd = () => load();
    window.addEventListener("dc-history-updated", onUpd);
    return () => window.removeEventListener("dc-history-updated", onUpd);
  }, [load]);

  if (rows === null) {
    return <div style={{ padding: 16, color: "#aaa" }}>Chargement…</div>;
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ fontWeight: 900, fontSize: 20, marginBottom: 12 }}>Historique</div>

      {!rows.length && (
        <div style={{ opacity: 0.7 }}>Aucune partie enregistrée pour l’instant.</div>
      )}

      {rows.map((r) => {
        const when = r.createdAt ? new Date(r.createdAt).toLocaleString() : "";
        const co = r.summary?.co ?? 0;
        return (
          <div
            key={r.id}
            style={{
              borderRadius: 12,
              background: "rgba(255,255,255,0.04)",
              padding: 12,
              marginBot// ============================================
              // src/pages/Stats.tsx
              // Page unique : agrégats par joueur + liste des derniers matchs
              // ============================================
              import React from "react";
              import { deriveFromHistory } from "../lib/scanHistory";
              
              export default function Stats() {
                const [loading, setLoading] = React.useState(true);
                const [totals, setTotals] = React.useState<Record<string, any>>({});
                const [matches, setMatches] = React.useState<any[]>([]);
              
                React.useEffect(() => {
                  (async () => {
                    const { matches, totalsByPlayer } = await deriveFromHistory();
                    setTotals(totalsByPlayer);
                    setMatches(matches);
                    setLoading(false);
                  })();
                }, []);
              
                if (loading) {
                  return <div style={wrap}><h2>Stats</h2><div style={dim}>Chargement…</div></div>;
                }
              
                const rows = Object.values(totals).sort((a: any, b: any) =>
                  (b.avg3 || 0) - (a.avg3 || 0)
                );
              
                return (
                  <div style={wrap}>
                    <h2 style={{margin: "8px 0 12px"}}>Stats par joueur</h2>
                    {rows.length === 0 ? (
                      <div style={dim}>Aucune partie terminée.</div>
                    ) : (
                      <div style={table}>
                        <div style={thead}>
                          <span>Joueur</span><span>Moy/3D</span><span>Darts</span><span>Visits</span>
                          <span>Best</span><span>Best CO</span><span>CO Hits</span><span>Victoires</span>
                        </div>
                        {rows.map((r: any) => (
                          <div key={r.id} style={trow}>
                            <span style={{fontWeight:800}}>{r.name}</span>
                            <span>{r.avg3.toFixed(2)}</span>
                            <span>{r.darts}</span>
                            <span>{r.visits}</span>
                            <span>{r.bestVisit}</span>
                            <span>{r.bestCheckout}</span>
                            <span>{r.coHits}</span>
                            <span>{r.wins}/{r.matches}</span>
                          </div>
                        ))}
                      </div>
                    )}
              
                    <h3 style={{margin: "18px 0 10px"}}>Derniers matchs</h3>
                    {matches.length === 0 ? (
                      <div style={dim}>—</div>
                    ) : (
                      <div style={{display:"grid", gap:8}}>
                        {matches.slice(0, 20).map(m => (
                          <div key={m.id} style={card}>
                            <div style={{display:"flex", justifyContent:"space-between", marginBottom:6}}>
                              <div style={{fontWeight:800}}>Match #{m.id.slice(-6)}</div>
                              <div style={{opacity:.8}}>
                                {new Date(m.date).toLocaleString()}
                              </div>
                            </div>
                            <div style={{display:"grid", gridTemplateColumns:"1fr 80px 80px 80px 90px", gap:6, fontSize:13}}>
                              <div style={{opacity:.7}}>Joueur</div>
                              <div style={{opacity:.7}}>Moy/3D</div>
                              <div style={{opacity:.7}}>Darts</div>
                              <div style={{opacity:.7}}>Visits</div>
                              <div style={{opacity:.7}}>Best / Best CO</div>
                              {m.players.map((p: any) => {
                                const per = m.per[p.id] || {};
                                return (
                                  <React.Fragment key={p.id}>
                                    <div style={{fontWeight: p.id===m.winnerId ? 800 : 600, color: p.id===m.winnerId ? "#7fe2a9" : "#ffcf57"}}>
                                      {p.name || p.id}
                                      {p.id===m.winnerId ? "  (Vainqueur)" : ""}
                                    </div>
                                    <div>{(per.avg3 ?? 0).toFixed?.(2) ?? "0.00"}</div>
                                    <div>{per.darts ?? 0}</div>
                                    <div>{per.visits ?? (per.darts ? Math.ceil((per.darts||0)/3) : 0)}</div>
                                    <div>{(per.bestVisit ?? 0)} / {(per.bestCheckout ?? 0)}</div>
                                  </React.Fragment>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }
              
              const wrap: React.CSSProperties = {
                maxWidth: 880, margin: "0 auto", padding: 16, color: "#eaeaf0"
              };
              const dim: React.CSSProperties = { opacity: .7 };
              const table: React.CSSProperties = { display:"grid", gap:6 };
              const thead: React.CSSProperties = {
                display:"grid", gridTemplateColumns:"1fr 80px 80px 80px 80px 80px 80px 90px",
                gap:6, fontSize:13, opacity:.75
              };
              const trow: React.CSSProperties = {
                display:"grid", gridTemplateColumns:"1fr 80px 80px 80px 80px 80px 80px 90px",
                gap:6, padding:"6px 8px",
                background:"rgba(255,255,255,.04)", border:"1px solid rgba(255,255,255,.06)", borderRadius:8
              };
              const card: React.CSSProperties = {
                padding:10, borderRadius:10,
                background:"linear-gradient(180deg, rgba(22,22,26,.96), rgba(14,14,16,.98))",
                border:"1px solid rgba(255,255,255,.08)"
              };
              tom: 10,
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div style={{ fontWeight: 700 }}>{r.kind?.toUpperCase() || "MATCH"}</div>
              <div style={{ opacity: 0.7 }}>{when}</div>
            </div>
            <div style={{ marginTop: 6, opacity: 0.9, fontSize: 13 }}>
              {r.players?.map((p) => (
                <span key={p.id} style={{ marginRight: 8 }}>
                  {p.name || p.id}{r.winnerId === p.id ? " 🏆" : ""}
                </span>
              ))}
            </div>
            <div style={{ marginTop: 8, fontSize: 13, opacity: 0.9 }}>
              Legs: {r.summary?.legs ?? 0} · Darts: {r.summary?.darts ?? 0} · CO: {co}
            </div>
          </div>
        );
      })}
    </div>
  );
}
