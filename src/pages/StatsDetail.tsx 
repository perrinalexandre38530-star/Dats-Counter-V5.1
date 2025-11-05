// ============================================
// src/pages/StatsDetail.tsx — Détail d’une partie (style noir/or)
// Lit l'historique (History.list() ou store.history) et affiche
// un tableau de fin de manche façon "overlay de fin".
// - Si status === "in_progress" -> bouton "Ouvrir la partie" (resume)
// ============================================

import React from "react";
import type { Store } from "../lib/types";
import ProfileAvatar from "../components/ProfileAvatar";

// ---------- Thème local ----------
const T = {
  gold: "#F6C256",
  text: "#FFFFFF",
  text70: "rgba(255,255,255,.70)",
  edge: "rgba(255,255,255,.10)",
  card: "linear-gradient(180deg,rgba(17,18,20,.94),rgba(13,14,17,.92))",
};

// ---------- Types très permissifs ----------
type PlayerLite = { id: string; name?: string; avatarDataUrl?: string | null };
type SavedMatch = {
  id: string;
  resumeId?: string;
  kind?: "x01" | "cricket" | string;
  status?: "in_progress" | "finished" | string;
  players?: PlayerLite[];
  winnerId?: string | null;
  createdAt?: number;
  updatedAt?: number;
  summary?: any;     // objet sauvegardé en fin de manche
  payload?: any;     // état étendu si dispo
};

// ---------- Helpers sûrs ----------
const toArr = <T,>(v: any): T[] => (Array.isArray(v) ? (v as T[]) : []);
const toObj = <T,>(v: any): T => (v && typeof v === "object" ? (v as T) : ({} as T));
const N = (x: any, d = 0) => (Number.isFinite(Number(x)) ? Number(x) : d);
const fmtDate = (ts?: number) =>
  new Date(N(ts, Date.now())).toLocaleString();

function initialFrom(name?: string) {
  const n = (name || "").trim();
  if (!n) return "—";
  const p = n.split(/\s+/);
  return (p[0][0] + (p[1]?.[0] || "")).toUpperCase();
}

function getPlayer(players: PlayerLite[], id?: string | null) {
  if (!id) return undefined;
  return players.find((p) => p.id === id);
}

// ---------- Extraction souple depuis summary ----------
// On accepte plusieurs variantes de structure pour rester compatible.
function buildViewModel(rec: SavedMatch) {
  const players = toArr<PlayerLite>(rec.players);
  const S = toObj<any>(rec.summary);

  // Classement (ordre + scores si dispo)
  // Recherche dans : summary.result.order | summary.ranking | summary.order
  const rawOrder: any[] =
    toArr<any>(S?.result?.order) ??
    toArr<any>(S?.ranking) ??
    toArr<any>(S?.order);

  // Fallback si pas d’ordre : juste l’ordre de players
  const order = rawOrder.length
    ? rawOrder.map((it) => {
        const pid = String(it.id ?? it.playerId ?? it.pid ?? it);
        const score = Number(it.score ?? it.points ?? it.pts ?? 0);
        return { playerId: pid, score };
      })
    : players.map((p) => ({ playerId: p.id, score: 0 }));

  // Petits KPIs — on pioche dans plusieurs clefs possibles
  // Chaque champ accepte multiples alias pour survivre aux refactors
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const v = S?.[k];
      if (v != null) return v;
      // Essaye dans summary.stats.* , summary.meta.*
      const v2 = S?.stats?.[k] ?? S?.meta?.[k];
      if (v2 != null) return v2;
    }
    return undefined;
  };

  // Par joueur : summary.players[pid] | summary.perPlayer[pid] | summary[pid]
  const perPlayer = (pid: string) => {
    const pp =
      toObj<any>(S?.players)?.[pid] ??
      toObj<any>(S?.perPlayer)?.[pid] ??
      toObj<any>(S?.[pid]);
    return toObj<any>(pp);
  };

  // KPIs globaux affichés dans “Résumé”
  const resume = {
    winnerId:
      S?.winnerId ??
      S?.winner ??
      rec.winnerId ??
      order[0]?.playerId ??
      null,
    minDartsSide:
      pick("minDartsSide", "minDartsPlayer") || null,
    minDarts:
      pick("minDarts", "fewestDarts") || null,
    bestVisitSide:
      pick("bestVisitSide", "bestVisitPlayer") || null,
    bestVisit:
      pick("bestVisit", "maxVisit", "bestScore") || null,
    bestAvg3Side:
      pick("bestAvg3Side", "bestAverage3Player") || null,
    bestAvg3:
      pick("bestAvg3", "average3Best", "avg3Best") ?? null,
    bestDbPctSide: pick("bestDbPctSide", "bestDoublePctPlayer") ?? null,
    bestDbPct: pick("bestDbPct", "doublePctBest", "pctDoubleBest") ?? null,
    bestTpPctSide: pick("bestTpPctSide", "bestTriplePctPlayer") ?? null,
    bestTpPct: pick("bestTpPct", "triplePctBest", "pctTripleBest") ?? null,
    bestBullSide: pick("bestBullSide", "bestBullPlayer") ?? null,
    bestBull: pick("bestBull", "bullBest") ?? null,
  };

  // Tableaux par joueur (Stats rapides / Darts / Globales)
  const rows = order.map(({ playerId }) => {
    const p = getPlayer(players, playerId) || { id: playerId, name: "Joueur" };
    const pp = perPlayer(playerId);

    return {
      playerId,
      name: p.name || "Joueur",
      avatar: p.avatarDataUrl || null,

      // “rapides”
      visits: N(pp.visits ?? pp.turns ?? pp.rounds ?? 0),
      darts: N(pp.darts ?? pp.throws ?? 0),
      avg3: Number(
        pp.avg3 ?? pp.average3 ?? pp.avg_3 ?? pp.avg3Darts ?? 0
      ),
      co: N(pp.co ?? pp.checkout ?? 0),
      _60: N(pp.hit60 ?? pp["60+"] ?? 0),
      _100: N(pp.hit100 ?? pp["100+"] ?? 0),
      _140: N(pp.hit140 ?? pp["140+"] ?? 0),
      _180: N(pp.hit180 ?? pp["180"] ?? 0),

      // “darts”
      db: N(pp.db ?? pp.double ?? 0),
      tp: N(pp.tp ?? pp.triple ?? 0),
      bull: N(pp.bull ?? 0),
      dbull: N(pp.dbull ?? pp.doubleBull ?? 0),

      // “globales”
      avg1: Number(pp.avg1 ?? pp.average1 ?? 0),
      winRate: Number(pp.winRatePct ?? pp.winPct ?? 0),
      dbPct: Number(pp.dbPct ?? pp.doublePct ?? 0),
      tpPct: Number(pp.tpPct ?? pp.triplePct ?? 0),
    };
  });

  return { players, order, resume, rows };
}

// ---------- Styles ----------
const page: React.CSSProperties = {
  minHeight: "100dvh",
  paddingBottom: 96,
  color: T.text,
  background: "radial-gradient(90% 120% at 50% -10%, #141517 0%, #0b0c0e 60%, #0b0c0e 100%)",
};

const header: React.CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 30,
  background: "rgba(10,10,12,.6)",
  backdropFilter: "blur(10px)",
  borderBottom: `1px solid ${T.edge}`,
};

const row: React.CSSProperties = {
  background: T.card,
  border: `1px solid ${T.edge}`,
  borderRadius: 16,
  padding: 12,
  boxShadow: "0 10px 26px rgba(0,0,0,.35)",
};

const sectionTitle: React.CSSProperties = {
  fontWeight: 800,
  color: T.gold,
  letterSpacing: 0.2,
  padding: "6px 10px",
  borderRadius: 10,
  border: `1px solid ${T.edge}`,
  background: "rgba(255,255,255,.04)",
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
};

const grid2: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 8,
};

const pill: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "4px 10px",
  borderRadius: 999,
  border: `1px solid ${T.edge}`,
  background: "rgba(255,255,255,.06)",
  fontSize: 12,
};

const table: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 13,
};

const thtd: React.CSSProperties = {
  borderBottom: `1px solid ${T.edge}`,
  padding: "8px 10px",
  textAlign: "left",
};

// ---------- Icônes inline ----------
const IconTrophy = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill={T.gold}>
    <path d="M6 2h12v2h3a1 1 0 0 1 1 1v1a5 5 0 0 1-5 5h-1.1A6 6 0 0 1 13 13.9V16h3v2H8v-2h3v-2.1A6 6 0 0 1 8.1 11H7A5 5 0 0 1 2 6V5a1 1 0 0 1 1-1h3V2Z"/>
  </svg>
);

// ---------- Page ----------
export default function StatsDetail({
  store,
  matchId,
  go,
}: {
  store: Store;
  matchId: string;
  go: (to: string, params?: any) => void;
}) {
  const [record, setRecord] = React.useState<SavedMatch | null>(null);

  React.useEffect(() => {
    (async () => {
      // 1) History API si dispo
      try {
        const API = (window as any).History;
        if (API?.list) {
          const list = await API.list();
          const hit = toArr<SavedMatch>(list).find((r) => r.id === matchId);
          if (hit) return setRecord(hit);
        }
      } catch {}
      // 2) Fallback store.history
      try {
        const anyStore = store as any;
        const hit = toArr<SavedMatch>(anyStore?.history).find(
          (r) => r.id === matchId
        );
        if (hit) return setRecord(hit);
      } catch {}
      setRecord(null);
    })();
  }, [store, matchId]);

  if (!record) {
    return (
      <div style={page}>
        <div style={header}>
          <div style={{ padding: 12 }}>
            <button
              onClick={() => go("stats")}
              style={{ ...pill, background: T.gold, color: "#141517", fontWeight: 700 }}
            >
              ← Retour
            </button>
          </div>
        </div>
        <div style={{ padding: 16 }}>
          <div style={{ ...row, color: T.text70 }}>
            Aucune donnée trouvée pour cette partie.
          </div>
        </div>
      </div>
    );
  }

  const vm = buildViewModel(record);
  const isInProgress = (record.status || "").toLowerCase().includes("progress");

  return (
    <div style={page}>
      <div style={header}>
        <div style={{ padding: 12, display: "flex", gap: 8, alignItems: "center" }}>
          <button
            onClick={() => go("stats")}
            style={{ ...pill, background: T.gold, color: "#141517", fontWeight: 800 }}
          >
            ← Retour
          </button>

          {isInProgress && (
            <button
              onClick={() =>
                go("x01", { resumeId: record.resumeId || record.id })
              }
              style={{
                ...pill,
                background: "rgba(255,180,0,.15)",
                border: "1px solid rgba(255,180,0,.35)",
                color: T.gold,
                fontWeight: 700,
              }}
            >
              ▶ Reprendre (en cours)
            </button>
          )}

          <div style={{ marginLeft: "auto", opacity: 0.8, fontSize: 12 }}>
            {String(record.kind || "X01").toUpperCase()} — {fmtDate(record.updatedAt ?? record.createdAt)}
          </div>
        </div>
      </div>

      <div style={{ padding: 12, display: "grid", gap: 12 }}>

        {/* ===== Classement ===== */}
        <section style={row}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={sectionTitle}>Classement</div>
            <div style={{ color: T.text70, fontSize: 12 }}>
              {isInProgress ? "Manche en cours" : "Manche terminée"}
            </div>
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            {vm.order.map((o, idx) => {
              const p = getPlayer(vm.players, o.playerId) || { id: o.playerId, name: "Joueur" };
              const med = idx + 1;
              return (
                <div
                  key={p.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "40px 48px 1fr auto",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 10px",
                    borderRadius: 12,
                    background: "rgba(255,255,255,.03)",
                    border: `1px solid ${T.edge}`,
                  }}
                >
                  <div style={{
                    width: 36, height: 28, borderRadius: 8,
                    display: "grid", placeItems: "center",
                    background: med === 1 ? "rgba(246,194,86,.15)" : "rgba(255,255,255,.06)",
                    color: med === 1 ? T.gold : T.text70, fontWeight: 800
                  }}>
                    {med}
                  </div>

                  {/* Avatar */}
                  <div style={{ width: 48, height: 48, borderRadius: "50%", overflow: "hidden", boxShadow: "0 0 0 2px rgba(0,0,0,.35)" }}>
                    <ProfileAvatar id={p.id} size={48} />
                  </div>

                  <div style={{ fontWeight: 800 }}>{p.name || "Joueur"}</div>
                  <div style={{ fontWeight: 800, color: T.gold }}>{o.score ?? 0}</div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ===== Résumé ===== */}
        <section style={row}>
          <div style={{ marginBottom: 10 }}>
            <div style={sectionTitle}>Résumé de la partie</div>
          </div>

          <div style={grid2}>
            {/* Colonne gauche */}
            <div style={{ display: "grid", gap: 8 }}>
              <KpiLine
                label="Vainqueur"
                left
                valueNode={
                  vm.resume.winnerId ? (
                    <span style={{ color: T.gold, fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <IconTrophy />
                      {getPlayer(vm.players, vm.resume.winnerId)?.name || "—"}
                    </span>
                  ) : "—"
                }
              />
              <KpiLine label="Best Moy./3D" value={vm.resume.bestAvg3} side={vm.resume.bestAvg3Side} />
              <KpiLine label="Best %DB" value={vm.resume.bestDbPct} side={vm.resume.bestDbPctSide} suffix="%" />
              <KpiLine label="Best BULL" value={vm.resume.bestBull} side={vm.resume.bestBullSide} />
            </div>

            {/* Colonne droite */}
            <div style={{ display: "grid", gap: 8 }}>
              <KpiLine label="Min Darts" value={vm.resume.minDarts} side={vm.resume.minDartsSide} />
              <KpiLine label="Best Volée" value={vm.resume.bestVisit} side={vm.resume.bestVisitSide} />
              <KpiLine label="Best %TP" value={vm.resume.bestTpPct} side={vm.resume.bestTpPctSide} suffix="%" />
              <div />
            </div>
          </div>
        </section>

        {/* ===== Stats rapides ===== */}
        <section style={row}>
          <div style={{ marginBottom: 10 }}><div style={sectionTitle}>Stats rapides</div></div>
          <table style={table}>
            <thead>
              <tr>
                <th style={{ ...thtd, width: 140 }}>Joueur</th>
                <th style={thtd}>Volées</th>
                <th style={thtd}>Darts</th>
                <th style={thtd}>Moy./3D</th>
                <th style={thtd}>CO</th>
                <th style={thtd}>60+</th>
                <th style={thtd}>100+</th>
                <th style={thtd}>140+</th>
                <th style={thtd}>180</th>
              </tr>
            </thead>
            <tbody>
              {vm.rows.map((r) => (
                <tr key={r.playerId}>
                  <td style={thtd}>
                    <span style={{ fontWeight: 700 }}>{r.name}</span>
                  </td>
                  <td style={thtd}>{r.visits}</td>
                  <td style={thtd}>{r.darts}</td>
                  <td style={thtd}>{r.avg3.toFixed ? r.avg3.toFixed(2) : r.avg3}</td>
                  <td style={thtd}>{r.co}</td>
                  <td style={thtd}>{r._60}</td>
                  <td style={thtd}>{r._100}</td>
                  <td style={thtd}>{r._140}</td>
                  <td style={thtd}>{r._180}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* ===== Stats Darts ===== */}
        <section style={row}>
          <div style={{ marginBottom: 10 }}><div style={sectionTitle}>Stats Darts</div></div>
          <table style={table}>
            <thead>
              <tr>
                <th style={{ ...thtd, width: 140 }}>Joueur</th>
                <th style={thtd}>DB</th>
                <th style={thtd}>TP</th>
                <th style={thtd}>Bull</th>
                <th style={thtd}>DBull</th>
              </tr>
            </thead>
            <tbody>
              {vm.rows.map((r) => (
                <tr key={r.playerId}>
                  <td style={thtd}><b>{r.name}</b></td>
                  <td style={thtd}>{r.db}</td>
                  <td style={thtd}>{r.tp}</td>
                  <td style={thtd}>{r.bull}</td>
                  <td style={thtd}>{r.dbull}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* ===== Stats globales ===== */}
        <section style={row}>
          <div style={{ marginBottom: 10 }}><div style={sectionTitle}>Stats globales</div></div>
          <table style={table}>
            <thead>
              <tr>
                <th style={{ ...thtd, width: 140 }}>Joueur</th>
                <th style={thtd}>Moy./1D</th>
                <th style={thtd}>Moy./3D</th>
                <th style={thtd}>%DB</th>
                <th style={thtd}>%TP</th>
                <th style={thtd}>Win%</th>
              </tr>
            </thead>
            <tbody>
              {vm.rows.map((r) => (
                <tr key={r.playerId}>
                  <td style={thtd}><b>{r.name}</b></td>
                  <td style={thtd}>{(r.avg1 ?? 0).toFixed ? (r.avg1 as number).toFixed(2) : r.avg1 ?? 0}</td>
                  <td style={thtd}>{r.avg3.toFixed ? r.avg3.toFixed(2) : r.avg3}</td>
                  <td style={thtd}>{(r.dbPct ?? 0).toFixed ? (r.dbPct as number).toFixed(1) : r.dbPct ?? 0}%</td>
                  <td style={thtd}>{(r.tpPct ?? 0).toFixed ? (r.tpPct as number).toFixed(1) : r.tpPct ?? 0}%</td>
                  <td style={thtd}>{(r.winRate ?? 0).toFixed ? (r.winRate as number).toFixed(1) : r.winRate ?? 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}

// ---------- Lignes KPI (label + valeur + “côté” joueur gagnant du KPI) ----------
function KpiLine({
  label,
  value,
  valueNode,
  side,
  suffix,
  left,
}: {
  label: string;
  value?: any;
  valueNode?: React.ReactNode;
  side?: string | null;
  suffix?: string;
  left?: boolean;
}) {
  const val =
    valueNode ??
    (value == null || value === ""
      ? "—"
      : `${value}${suffix || ""}`);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: left ? "1fr auto" : "1fr auto",
        gap: 8,
        alignItems: "center",
        border: `1px solid ${T.edge}`,
        borderRadius: 12,
        padding: "8px 10px",
        background: "rgba(255,255,255,.03)",
      }}
    >
      <div style={{ color: T.text70 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ fontWeight: 800 }}>{val}</div>
        {side ? (
          <span
            style={{
              ...pill,
              padding: "2px 8px",
              color: T.gold,
              borderColor: "rgba(255,180,0,.35)",
              background: "rgba(255,180,0,.10)",
            }}
            title="Meilleur joueur sur ce critère"
          >
            {side}
          </span>
        ) : null}
      </div>
    </div>
  );
}
