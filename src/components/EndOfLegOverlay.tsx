// ============================================
// src/components/EndOfLegOverlay.tsx
// Overlay "Classement de la manche" — compact + labels FR
// (Compat total: accepte LegacyLegResult *ou* LegStats, sans rien modifier ailleurs)
// - AUCUNE écriture dans le pont ni profils (zéro side effects)
// - Calcule/fait des fallbacks pour toutes les valeurs manquantes
// - Graphs protégés (montage conditionnel)
// ============================================

import React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
} from "recharts";

import type { LegStats, PlayerId } from "../lib/stats";

// --- Types légers (compat) ---
type PlayerMini = { id: string; name: string; avatarDataUrl?: string | null };

// --- Ancien schéma (compat) ---
export type LegacyLegResult = {
  legNo: number;
  winnerId: string;
  order?: string[];
  finishedAt: number;
  remaining: Record<string, number>;
  darts: Record<string, number>;
  visits: Record<string, number>;
  avg3: Record<string, number>;
  bestVisit?: Record<string, number>;
  bestCheckout?: Record<string, number | null>;
  x180?: Record<string, number>;
  doubles?: Record<string, number>;
  triples?: Record<string, number>;
  bulls?: Record<string, number>;
  visitSumsByPlayer?: Record<string, number[]>;
  checkoutDartsByPlayer?: Record<string, number[]>;
  hitsBySector?: Record<string, Record<string, number>>; // inclut "OB" et "IB"
  h60?: Record<string, number>;
  h100?: Record<string, number>;
  h140?: Record<string, number>;
  h180?: Record<string, number>;
  // Champs “patch” qu’on a déjà vus dans votre projet:
  coHits?: Record<string, number>;
  coAtt?: Record<string, number>;
  points?: Record<string, number>;
  // variantes de noms
  misses?: Record<string, number>;
  busts?: Record<string, number>;
  dbulls?: Record<string, number>;
  miss?: Record<string, number>;
  bust?: Record<string, number>;
  dbull?: Record<string, number>;
  missPct?: Record<string, number>;
  bustPct?: Record<string, number>;
  dbullPct?: Record<string, number>;
};

// --- Props ---
type Props = {
  open: boolean;
  result: LegacyLegResult | LegStats | null;
  playersById: Record<string, PlayerMini>;
  onClose: () => void;
  onReplay?: () => void;
  onSave?: (res: LegacyLegResult | LegStats) => void;
};

// ---------- Utils ----------
const n = (v: any) => (typeof v === "number" && isFinite(v) ? v : 0);
const f2 = (v: any) =>
  typeof v === "number" && isFinite(v) ? (Math.round(v * 100) / 100).toFixed(2) : "0.00";

const pctFmt = (hits: number, den: number) =>
  den > 0 ? `${((hits / den) * 100).toFixed(1)}%` : "0.0%";

function isLegStatsObj(x: any): x is LegStats {
  return x && typeof x === "object" && x.perPlayer && (x.players?.length ?? 0) > 0;
}

// ---------- Adapteurs NOUVELLES STATS ----------
function idsFromNew(leg: LegStats): string[] {
  // parfois leg.players = string[] ou {id,name}[]
  if (Array.isArray(leg.players) && typeof leg.players[0] === "string") {
    return leg.players as unknown as string[];
  }
  return (leg.players as Array<{ id: string }>).map((p) => p.id);
}

function remainingFromNew(leg: LegStats, pid: string) {
  const st: any = leg.perPlayer?.[pid] ?? {};
  const start = n((leg as any).startScore ?? (leg as any).start ?? 501);
  const scored = n(st.totalScored ?? st.points ?? st.pointsSum);
  const approx = Math.max(0, start - scored);
  // direct si présent
  return n(st.remaining ?? approx);
}

function visitsFromNew(leg: LegStats, pid: string) {
  const st: any = leg.perPlayer?.[pid] ?? {};
  // visits direct sinon darts/3 arrondi sup
  const d = n(st.darts ?? st.dartsThrown);
  return n(st.visits ?? (d ? Math.ceil(d / 3) : 0));
}

function avg3FromNew(leg: LegStats, pid: string) {
  const st: any = leg.perPlayer?.[pid] ?? {};
  // sources possibles
  if (typeof st.avg3 === "number") return st.avg3;
  const v = visitsFromNew(leg, pid);
  const scored = n(st.totalScored ?? st.points ?? st.pointsSum);
  if (v > 0) return scored / v; // dans votre app, avg3 est “par volée”
  const d = n(st.darts ?? st.dartsThrown);
  return d > 0 ? (scored / d) * 3 : 0;
}

function bestVisitFromNew(leg: LegStats, pid: string) {
  const st: any = leg.perPlayer?.[pid] ?? {};
  return n(st.bestVisit ?? st.best ?? st.maxVisit ?? st.bins?.maxVisit);
}

function powerBucketsFromNew(leg: LegStats, pid: string) {
  const st: any = leg.perPlayer?.[pid] ?? {};
  const b = st.bins || {};
  return {
    h60: n(b["60+"] ?? b["60"] ?? 0),
    h100: n(b["100+"] ?? 0),
    h140: n(b["140+"] ?? 0),
    h180: n(b["180"] ?? 0),
  };
}

function impactsFromNew(leg: LegStats, pid: string) {
  const st: any = leg.perPlayer?.[pid] ?? {};
  // “rates” sont des compteurs dans vos captures (pas des %)
  const r = st.rates || {};
  const darts = n(st.darts ?? st.dartsThrown);
  const doubles = n(st.doubles ?? r.dblHits ?? 0);
  const triples = n(st.triples ?? r.triHits ?? 0);
  const ob = n(st.ob ?? r.bullHits ?? 0);
  const ib = n(st.ib ?? r.dbullHits ?? 0);
  const bulls = ob + ib;
  return {
    doubles,
    triples,
    ob,
    ib,
    bulls,
    pDB: pctFmt(doubles, darts),
    pTP: pctFmt(triples, darts),
    pBull: pctFmt(ob, darts),
    pDBull: pctFmt(ib, darts),
  };
}

function checkoutFromNew(leg: LegStats, pid: string) {
  const st: any = leg.perPlayer?.[pid] ?? {};
  const co = st.co || {};
  const count = n(co.coHits ?? co.hits ?? 0);
  const avg = n(co.avgCODarts ?? co.avgDarts ?? 0);
  const hi = n(co.highestCO ?? co.best ?? 0);
  return { coCount: count, coDartsAvg: avg, highestCO: hi };
}

function rowFromNew(leg: LegStats, pid: string, nameOf: (id: string) => string) {
  const darts = n((leg as any).perPlayer?.[pid]?.darts ?? (leg as any).perPlayer?.[pid]?.dartsThrown ?? 0);
  const visits = visitsFromNew(leg, pid);
  const avg3 = avg3FromNew(leg, pid);
  const best = bestVisitFromNew(leg, pid);
  const remaining = remainingFromNew(leg, pid);
  const p = powerBucketsFromNew(leg, pid);
  const imp = impactsFromNew(leg, pid);
  const co = checkoutFromNew(leg, pid);
  return {
    pid,
    name: nameOf(pid),
    remaining,
    avg3,
    best,
    darts,
    visits,
    h60: p.h60,
    h100: p.h100,
    h140: p.h140,
    h180: p.h180,
    doubles: imp.doubles,
    triples: imp.triples,
    ob: imp.ob,
    ib: imp.ib,
    bulls: imp.bulls,
    pDB: imp.pDB,
    pTP: imp.pTP,
    pBull: imp.pBull,
    pDBull: imp.pDBull,
    coCount: co.coCount,
    coDartsAvg: co.coDartsAvg,
    highestCO: co.highestCO,
  };
}

function sortOrderNew(leg: LegStats, ids: string[]) {
  return ids.slice().sort((a, b) => {
    const ra = remainingFromNew(leg, a);
    const rb = remainingFromNew(leg, b);
    if ((ra === 0) !== (rb === 0)) return ra === 0 ? -1 : 1;
    if (ra !== rb) return ra - rb;
    const aa = avg3FromNew(leg, a);
    const ab = avg3FromNew(leg, b);
    return ab - aa;
  });
}

// ---------- Adapteur LEGACY ----------
function val(obj: Record<string, number> | undefined, k: string) {
  return obj ? n(obj[k]) : 0;
}

function rowFromLegacy(res: LegacyLegResult, pid: string, nameOf: (id: string) => string) {
  const darts = val(res.darts, pid);
  const visits = val(res.visits, pid) || (darts ? Math.ceil(darts / 3) : 0);
  const avg3 =
    typeof res.avg3?.[pid] === "number"
      ? n(res.avg3[pid])
      : darts > 0
      ? (n(res.points?.[pid]) / darts) * 3
      : 0;

  const obRaw =
    res.hitsBySector?.[pid]?.["OB"] ??
    res.bulls?.[pid] /* si on a seulement bulls total, on split 50/50 pour l’affichage */ ??
    0;
  const ibRaw = res.hitsBySector?.[pid]?.["IB"] ?? res.dbull?.[pid] ?? res.dbulls?.[pid] ?? 0;

  const ob = n(obRaw);
  const ib = n(ibRaw);
  const bulls = ob + ib;

  const doubles = n(res.doubles?.[pid]);
  const triples = n(res.triples?.[pid]);

  const h60 = n(res.h60?.[pid] ?? 0);
  const h100 = n(res.h100?.[pid] ?? 0);
  const h140 = n(res.h140?.[pid] ?? 0);
  const h180 = n(res.h180?.[pid] ?? res.x180?.[pid] ?? 0);

  const coCount = n(res.coHits?.[pid] ?? res.checkoutDartsByPlayer?.[pid]?.length ?? 0);
  const coDartsAvgArr = res.checkoutDartsByPlayer?.[pid];
  const coDartsAvg = coCount && coDartsAvgArr?.length ? f2(coDartsAvgArr.reduce((s, x) => s + x, 0) / coDartsAvgArr.length) : 0;
  const highestCO = n(res.bestCheckout?.[pid] ?? 0);

  return {
    pid,
    name: nameOf(pid),
    remaining: n(res.remaining?.[pid]),
    avg3,
    best: n(res.bestVisit?.[pid] ?? 0),
    darts,
    visits,
    h60,
    h100,
    h140,
    h180,
    doubles,
    triples,
    ob,
    ib,
    bulls,
    pDB: pctFmt(doubles, darts),
    pTP: pctFmt(triples, darts),
    pBull: pctFmt(ob, darts),
    pDBull: pctFmt(ib, darts),
    coCount,
    coDartsAvg: typeof coDartsAvg === "number" ? coDartsAvg : n(parseFloat(String(coDartsAvg))),
    highestCO,
  };
}

function sortOrderLegacy(res: LegacyLegResult, ids: string[]) {
  const order =
    Array.isArray(res.order) && res.order.length
      ? res.order.slice()
      : ids.slice().sort((a, b) => {
          const ra = n(res.remaining?.[a]);
          const rb = n(res.remaining?.[b]);
          if ((ra === 0) !== (rb === 0)) return ra === 0 ? -1 : 1;
          const aa = n(res.avg3?.[a]);
          const ab = n(res.avg3?.[b]);
          return ab - aa;
        });
  return order;
}

// ---------- Composant principal ----------
export default function EndOfLegOverlay({
  open,
  result,
  playersById,
  onClose,
  onReplay,
  onSave,
}: Props) {
  if (!open || !result) return null;
  return (
    <Inner
      result={result}
      playersById={playersById}
      onClose={onClose}
      onReplay={onReplay}
      onSave={onSave}
    />
  );
}

function Inner({
  result,
  playersById,
  onClose,
  onReplay,
  onSave,
}: {
  result: LegacyLegResult | LegStats;
  playersById: Record<string, PlayerMini>;
  onClose: () => void;
  onReplay?: () => void;
  onSave?: (res: LegacyLegResult | LegStats) => void;
}) {
  const nameOf = React.useCallback(
    (id?: string | null) => playersById[id || ""]?.name ?? (id || "—"),
    [playersById]
  );
  const avatarOf = React.useCallback(
    (id?: string | null) => playersById[id || ""]?.avatarDataUrl ?? null,
    [playersById]
  );

  // --- rows ---
  const rows = React.useMemo(() => {
    if (isLegStatsObj(result)) {
      const ids = idsFromNew(result);
      const ord = sortOrderNew(result, ids);
      return ord.map((pid) => rowFromNew(result, pid, nameOf));
    } else {
      const r = result as LegacyLegResult;
      const ids = Object.keys(r.remaining || r.avg3 || {});
      const ord = sortOrderLegacy(r, ids);
      return ord.map((pid) => rowFromLegacy(r, pid, nameOf));
    }
  }, [result, nameOf]);

  const legNo = (isLegStatsObj(result) ? (result as any).legNo : (result as LegacyLegResult).legNo) ?? 1;
  const finishedAt = isLegStatsObj(result)
    ? (result as any).finishedAt ?? Date.now()
    : (result as LegacyLegResult).finishedAt ?? Date.now();
  const winnerId = isLegStatsObj(result)
    ? ((result as any).winnerId ?? rows[0]?.pid ?? null)
    : ((result as LegacyLegResult).winnerId ?? rows[0]?.pid ?? null);

  // --- Best-of pour le résumé ---
  const minDarts = Math.min(...rows.map((r) => (r.darts > 0 ? r.darts : Infinity)));
  const minDartsRow = rows.find((r) => r.darts === minDarts);
  const bestAvg = Math.max(...rows.map((r) => r.avg3 || 0));
  const bestAvgRow = rows.find((r) => r.avg3 === bestAvg) || null;
  const bestVol = Math.max(...rows.map((r) => r.best || 0));
  const bestVolRow = rows.find((r) => r.best === bestVol) || null;

  // Pourcentages : déjà formatés, on en tire un ordre simple
  const bestPDBRow = rows.slice().sort((a, b) => parseFloat(String(b.pDB)) - parseFloat(String(a.pDB)))[0] || null;
  const bestPTPRow = rows.slice().sort((a, b) => parseFloat(String(b.pTP)) - parseFloat(String(a.pTP)))[0] || null;
  const bestBullRow = rows.slice().sort((a, b) => (b.bulls || 0) - (a.bulls || 0))[0] || null;

  // Graph bar
  const barData = React.useMemo(
    () => rows.map((r) => ({ name: r.name, avg3: Number(f2(r.avg3)) })),
    [rows]
  );

  // Radar (legacy uniquement si secteurs dispos)
  const radarKeys = React.useMemo(() => {
    if (!isLegStatsObj(result)) {
      const res = result as LegacyLegResult;
      const first = rows[0]?.pid;
      const m = res.hitsBySector || {};
      if (!first || !m[first]) return null;
      const entries = Object.entries(m[first])
        .filter(([k]) => k !== "MISS")
        .sort((a, b) => (n(b[1]) - n(a[1])))
        .slice(0, 12)
        .map(([k]) => k);
      return entries.length ? entries : null;
    }
    return null;
  }, [result, rows]);

  // Actions
  const handleSave = () => {
    // ⚠️ Pas d’écriture dans vos stores ici pour éviter les crashs
    try {
      onSave?.(result);
    } catch {}
    onClose();
  };

  // --- UI ---
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,.55)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 12,
        color: "#e7e7e7",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(980px, 96vw)",
          maxHeight: "92vh",
          overflow: "auto",
          borderRadius: 14,
          background: "linear-gradient(180deg, #17181c, #101116)",
          border: "1px solid rgba(255,255,255,.08)",
          boxShadow: "0 16px 44px rgba(0,0,0,.45)",
          fontSize: 12,
        }}
      >
        {/* Header */}
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 1,
            background: "linear-gradient(180deg, #1a1b20, #13141a)",
            borderBottom: "1px solid rgba(255,255,255,.08)",
            padding: "8px 10px",
            borderTopLeftRadius: 14,
            borderTopRightRadius: 14,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <div style={{ fontWeight: 900, color: "#f0b12a", fontSize: 14 }}>
            Classement de la manche #{legNo}
          </div>
          <div style={{ opacity: 0.7, fontSize: 11, marginLeft: 6 }}>
            Manche terminée — {new Date(finishedAt).toLocaleTimeString()}
          </div>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} title="Fermer" style={btn("transparent", "#ddd", "#ffffff22")}>
            ✕
          </button>
        </div>

        {/* Corps */}
        <div style={{ padding: 10, paddingTop: 8 }}>
          {/* Classement */}
          <div
            style={{
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,.07)",
              background: "linear-gradient(180deg, rgba(28,28,32,.65), rgba(18,18,20,.65))",
              marginBottom: 10,
            }}
          >
            {rows.map((r, idx) => {
              const avatar = avatarOf(r.pid);
              const finished = (r.remaining ?? 0) === 0;
              return (
                <div
                  key={r.pid}
                  style={{
                    padding: "6px 8px",
                    display: "grid",
                    gridTemplateColumns: "26px 36px 1fr auto",
                    alignItems: "center",
                    gap: 8,
                    borderBottom: "1px solid rgba(255,255,255,.06)",
                  }}
                >
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 6,
                      background: "rgba(255,255,255,.06)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 800,
                      color: "#ffcf57",
                      fontSize: 12,
                    }}
                  >
                    {idx + 1}
                  </div>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      overflow: "hidden",
                      background: "rgba(255,255,255,.08)",
                    }}
                  >
                    {avatar ? (
                      <img src={avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#999",
                          fontWeight: 700,
                        }}
                      >
                        ?
                      </div>
                    )}
                  </div>
                  <div style={{ fontWeight: 800, color: "#ffcf57", fontSize: 13 }}>{r.name}</div>
                  <div style={{ fontWeight: 900, color: finished ? "#7fe2a9" : "#ffcf57" }}>
                    {finished ? "0" : r.remaining ?? "—"}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Résumé */}
          <Accordion title="Résumé de la partie" defaultOpen>
            <SummaryRows
              winnerName={nameOf(winnerId || "")}
              minDartsRow={minDartsRow || null}
              bestAvgRow={bestAvgRow}
              bestVolRow={bestVolRow}
              bestPDBRow={bestPDBRow}
              bestPTPRow={bestPTPRow}
              bestBullRow={bestBullRow}
              fmt2={f2}
            />
          </Accordion>

          {/* Stats rapides */}
          <Accordion title="Stats rapides">
            <div style={{ overflowX: "auto" }}>
              <table style={tableBase}>
                <thead>
                  <tr>
                    <TH>Joueur</TH>
                    <TH>Volées</TH>
                    <TH>Darts</TH>
                    <TH>Moy./3D</TH>
                    <TH>60+</TH>
                    <TH>100+</TH>
                    <TH>140+</TH>
                    <TH>180</TH>
                    <TH>Best Visit</TH>
                    <TH>CO best</TH>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={`fast-${r.pid}`} style={rowLine}>
                      <TDStrong>{r.name}</TDStrong>
                      <TD>{r.visits}</TD>
                      <TD>{r.darts}</TD>
                      <TD>{f2(r.avg3)}</TD>
                      <TD>{r.h60}</TD>
                      <TD>{r.h100}</TD>
                      <TD>{r.h140}</TD>
                      <TD>{r.h180}</TD>
                      <TD>{r.best}</TD>
                      <TD>{r.highestCO ?? 0}</TD>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Accordion>

          {/* Stats Darts */}
          <Accordion title="Stats Darts">
            <div style={{ overflowX: "auto" }}>
              <table style={tableBase}>
                <thead>
                  <tr>
                    <TH>Joueur</TH>
                    <TH>CO</TH>
                    <TH>Darts CO</TH>
                    <TH>DB</TH>
                    <TH>TP</TH>
                    <TH>Bull</TH>
                    <TH>DBull</TH>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={`darts-${r.pid}`} style={rowLine}>
                      <TDStrong>{r.name}</TDStrong>
                      <TD>{r.coCount}</TD>
                      <TD>{r.coCount ? r.coDartsAvg : "—"}</TD>
                      <TD>{r.doubles}</TD>
                      <TD>{r.triples}</TD>
                      <TD>{r.ob}</TD>
                      <TD>{r.ib}</TD>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Accordion>

          {/* Stats globales */}
          <Accordion title="Stats globales">
            <div style={{ overflowX: "auto" }}>
              <table style={{ ...tableBase, minWidth: 620 }}>
                <thead>
                  <tr>
                    <TH>#</TH>
                    <TH>Joueur</TH>
                    <TH>Moy./3D</TH>
                    <TH>Pts Max</TH>
                    <TH>Darts</TH>
                    <TH>%DB</TH>
                    <TH>%TP</TH>
                    <TH>%Bull</TH>
                    <TH>%DBull</TH>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={`global-${r.pid}`} style={rowLine}>
                      <TD>{i + 1}</TD>
                      <TDStrong>{r.name}</TDStrong>
                      <TD>{f2(r.avg3)}</TD>
                      <TD>{r.best}</TD>
                      <TD>{r.darts}</TD>
                      <TD>{r.pDB}</TD>
                      <TD>{r.pTP}</TD>
                      <TD>{r.pBull}</TD>
                      <TD>{r.pDBull}</TD>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Accordion>

          {/* Graphs */}
          <Accordion title="Graphiques — hits par secteur & moyennes">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <ChartCard>
                <ChartMountGuard minW={220} minH={220}>
                  {() =>
                    radarKeys ? (
                      <ResponsiveContainer width="100%" height={230}>
                        <RadarChart
                          data={radarKeys.map((k) => ({
                            sector: k,
                            v: (result as LegacyLegResult)?.hitsBySector?.[rows[0]?.pid ?? ""]?.[k] ?? 0,
                          }))}
                        >
                          <PolarGrid />
                          <PolarAngleAxis dataKey="sector" />
                          <Radar name="Hits" dataKey="v" />
                        </RadarChart>
                      </ResponsiveContainer>
                    ) : (
                      <ChartPlaceholder />
                    )
                  }
                </ChartMountGuard>
              </ChartCard>

              <ChartCard>
                <ChartMountGuard minW={220} minH={220}>
                  {() => (
                    <ResponsiveContainer width="100%" height={230}>
                      <BarChart data={barData}>
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="avg3" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </ChartMountGuard>
              </ChartCard>
            </div>
          </Accordion>

          {/* Actions */}
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginTop: 10 }}>
            {onReplay && (
              <button onClick={onReplay} style={btn("transparent", "#ddd", "#ffffff22")}>
                Rejouer la manche
              </button>
            )}
            {result && (
              <button onClick={handleSave} style={btn("linear-gradient(180deg, #f0b12a, #c58d19)", "#141417")}>
                Sauvegarder
              </button>
            )}
            <button onClick={onClose} style={btn("transparent", "#ddd", "#ffffff22")}>
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Résumé ----------
function SummaryRows({
  winnerName,
  minDartsRow,
  bestAvgRow,
  bestVolRow,
  bestPDBRow,
  bestPTPRow,
  bestBullRow,
  fmt2,
}: any) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
      <KV label="Vainqueur" value={winnerName} strong />
      <KV
        label="Min Darts"
        value={
          minDartsRow ? (
            <span>
              <b style={{ color: "#ffcf57" }}>{minDartsRow.name}</b> — {minDartsRow.darts}
            </span>
          ) : (
            "—"
          )
        }
        right
      />
      <KV
        label="Best Moy./3D"
        value={
          bestAvgRow ? (
            <span>
              <b style={{ color: "#ffcf57" }}>{bestAvgRow.name}</b> — {fmt2(bestAvgRow.avg3)}
            </span>
          ) : (
            "—"
          )
        }
      />
      <KV
        label="Best Volée"
        value={
          bestVolRow ? (
            <span>
              <b style={{ color: "#ffcf57" }}>{bestVolRow.name}</b> — {bestVolRow.best}
            </span>
          ) : (
            "—"
          )
        }
        right
      />
      <KV
        label="Best %DB"
        value={
          bestPDBRow ? (
            <span>
              <b style={{ color: "#ffcf57" }}>{bestPDBRow.name}</b> — {bestPDBRow.pDB}
            </span>
          ) : (
            "—"
          )
        }
      />
      <KV
        label="Best %TP"
        value={
          bestPTPRow ? (
            <span>
              <b style={{ color: "#ffcf57" }}>{bestPTPRow.name}</b> — {bestPTPRow.pTP}
            </span>
          ) : (
            "—"
          )
        }
        right
      />
      <KV
        label="Best BULL"
        value={
          bestBullRow ? (
            <span>
              <b style={{ color: "#ffcf57" }}>{bestBullRow.name}</b> — {bestBullRow.bulls}
              <span style={{ opacity: 0.8 }}> ({bestBullRow.ob} + {bestBullRow.ib})</span>
            </span>
          ) : (
            "—"
          )
        }
      />
    </div>
  );
}

// ---------- UI helpers ----------
function Accordion({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div
      style={{
        marginTop: 8,
        borderRadius: 10,
        border: "1px solid rgba(255,255,255,.08)",
        background: "linear-gradient(180deg, rgba(28,28,32,.65), rgba(18,18,20,.65))",
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          textAlign: "left",
          padding: "8px 10px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "transparent",
          border: "none",
          color: "#e7e7e7",
          cursor: "pointer",
          fontWeight: 900,
          fontSize: 12,
        }}
      >
        <span style={{ color: "#f0b12a" }}>{title}</span>
        <div style={{ flex: 1 }} />
        <span
          style={{
            width: 22,
            height: 22,
            borderRadius: 5,
            border: "1px solid rgba(255,255,255,.12)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform .15s",
          }}
        >
          ▾
        </span>
      </button>
      <div
        style={{
          overflow: "hidden",
          transition: "grid-template-rows 180ms ease",
          display: "grid",
          gridTemplateRows: open ? "1fr" : "0fr",
        }}
      >
        <div style={{ overflow: "hidden", padding: open ? "0 10px 10px" : "0 10px 0" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function useSizeReady<T extends HTMLElement>(minW = 220, minH = 220) {
  const ref = React.useRef<T | null>(null);
  const [ready, setReady] = React.useState(false);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      setReady(w >= minW && h >= minH);
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [minW, minH]);
  return { ref, ready };
}

function ChartMountGuard({
  children,
  minW = 220,
  minH = 220,
}: {
  children: (containerRef: React.RefObject<HTMLDivElement>) => React.ReactNode;
  minW?: number;
  minH?: number;
}) {
  const { ref, ready } = useSizeReady<HTMLDivElement>(minW, minH);
  return (
    <div ref={ref} style={{ width: "100%", minHeight: minH }}>
      {ready ? children(ref) : <ChartPlaceholder />}
    </div>
  );
}

function ChartCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,.08)",
        borderRadius: 10,
        background: "rgba(255,255,255,.03)",
        padding: 6,
        minHeight: 200,
        minWidth: 260,
      }}
    >
      {children}
    </div>
  );
}

function ChartPlaceholder() {
  return (
    <div
      style={{
        height: 230,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: 0.6,
        fontStyle: "italic",
      }}
    >
      Préparation du graphe…
    </div>
  );
}

const tableBase: React.CSSProperties = {
  width: "100%",
  borderCollapse: "separate",
  borderSpacing: 0,
  minWidth: 520,
  fontSize: 12,
};
const rowLine: React.CSSProperties = {
  borderBottom: "1px solid rgba(255,255,255,.06)",
};

function TH({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        textAlign: "left",
        padding: "6px 8px",
        fontSize: 11,
        color: "#ffcf57",
        fontWeight: 900,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}
function TD({ children }: { children: React.ReactNode }) {
  return (
    <td style={{ padding: "6px 8px", fontSize: 12, whiteSpace: "nowrap" }}>{children}</td>
  );
}
function TDStrong({ children }: { children: React.ReactNode }) {
  return (
    <td
      style={{
        padding: "6px 8px",
        fontSize: 12,
        fontWeight: 800,
        color: "#ffcf57",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </td>
  );
}

function KV({
  label,
  value,
  right,
  strong,
}: {
  label: string;
  value: React.ReactNode;
  right?: boolean;
  strong?: boolean;
}) {
  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,.08)",
        borderRadius: 8,
        padding: "6px 8px",
        background: "rgba(255,255,255,.03)",
        display: "flex",
        gap: 8,
        justifyContent: right ? "space-between" : "flex-start",
        fontSize: 12,
      }}
    >
      <div style={{ opacity: 0.8 }}>{label}</div>
      <div style={{ marginLeft: "auto", fontWeight: strong ? 900 : 700, color: "#ffcf57" }}>
        {value}
      </div>
    </div>
  );
}

function btn(bg: string, fg: string, border?: string): React.CSSProperties {
  return {
    appearance: "none" as React.CSSProperties["appearance"],
    padding: "8px 12px",
    borderRadius: 10,
    border: `1px solid ${border ?? "transparent"}`,
    background: bg,
    color: fg,
    fontWeight: 800,
    cursor: "pointer",
    fontSize: 12,
  };
}
