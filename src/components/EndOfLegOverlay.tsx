// ============================================
// src/components/EndOfLegOverlay.tsx
// Overlay "Classement de la manche" — compact + libellés FR
// (Version intégrée aux nouvelles stats: accepte LegResult *ou* LegStats)
// - Accordéons, tables compactes, labels FR
// - AUCUNE dépendance à StatsSelectors (autonome)
// - mergeLegToBasics() appelé au clic sur "Sauvegarder"
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
import { getBasicProfileStats } from "../lib/statsBridge";

/* ---- Types légers (compat) ---- */
type PlayerMini = { id: string; name: string; avatarDataUrl?: string | null };

/* ---- Ancien schéma (compat) ---- */
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
};

type Props = {
  open: boolean;
  // Peut être l'ancien LegacyLegResult OU le nouveau LegStats
  result: LegacyLegResult | LegStats | null;
  playersById: Record<string, PlayerMini>;
  onClose: () => void;
  onReplay?: () => void;
  onSave?: (res: LegacyLegResult | LegStats) => void;
};

/* ====== WRAPPER (sans hooks) ====== */
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
    <OverlayInner
      result={result}
      playersById={playersById}
      onClose={onClose}
      onReplay={onReplay}
      onSave={onSave}
    />
  );
}

/* ---------------------------------------------
   ADAPTATEURS & CALCULS côté "nouvelles stats"
   (autonomes: pas de StatsSelectors requis)
----------------------------------------------*/
function isLegStats(x: any): x is LegStats {
  return x && typeof x === "object" && x.perPlayer && x.players && Array.isArray(x.players);
}

// Score restant approximé: startScore - totalScored (>=0)
function computeRemainingApprox(leg: LegStats, pid: PlayerId) {
  const st = leg.perPlayer[pid];
  const approx = Math.max(0, (leg.startScore ?? 0) - (st?.totalScored ?? 0));
  return approx;
}

// Moyenne /3: on prend (totalScored / visits), puis *3
function computeAvg3FromNew(leg: LegStats, pid: PlayerId) {
  const st = leg.perPlayer[pid];
  const visits = st?.visits ?? 0;
  if (!visits) return 0;
  const perVisit = (st?.totalScored ?? 0) / visits;
  return perVisit; // ta logique d’app semblait déjà considérer "avg3" = par volée
}

// Best visit: on tente plusieurs clés usuelles
function computeBestVisitNew(leg: LegStats, pid: PlayerId) {
  const st: any = leg.perPlayer[pid] ?? {};
  return (
    st.bestVisit ??
    st.best ??
    st.maxVisit ??
    st.bins?.maxVisit ??
    0
  );
}

// Leaderboard: 1) restant = 0 d’abord (gagnant), 2) restant croissant, 3) avg3 décroissant
function leaderboardNew(leg: LegStats): string[] {
  const ids = leg.players.map((p) => p.id);
  return ids.sort((a, b) => {
    const ra = computeRemainingApprox(leg, a);
    const rb = computeRemainingApprox(leg, b);
    if ((ra === 0) !== (rb === 0)) return ra === 0 ? -1 : 1;
    if (ra !== rb) return ra - rb;
    const aa = computeAvg3FromNew(leg, a);
    const ab = computeAvg3FromNew(leg, b);
    return ab - aa;
  });
}

function legToRowsViaNewStats(leg: LegStats, nameOf: (id: string) => string) {
  const order = leaderboardNew(leg);
  return order.map((pid, idx) => {
    const s: any = leg.perPlayer[pid] ?? {};
    const remaining = computeRemainingApprox(leg, pid);
    const avg3 = computeAvg3FromNew(leg, pid);
    const best = computeBestVisitNew(leg, pid);

    const rate = (k: string) => Number(s?.rates?.[k] ?? 0);
    const bin = (k: string) => Number(s?.bins?.[k] ?? 0);

    const darts = Number(s?.darts ?? 0);
    const pct = (hits: number) => (darts > 0 ? ((hits / darts) * 100).toFixed(1) + "%" : "0.0%");

    const ob = rate("bullHits");  // Outer Bull
    const ib = rate("dbullHits"); // Inner Bull

    return {
      pid,
      rank: idx + 1,
      name: nameOf(pid),
      remaining,
      avg3,
      best,
      darts,
      visits: Number(s?.visits ?? 0),
      x180: bin("180"),
      doubles: rate("dblHits"),
      triples: rate("triHits"),
      ob,
      ib,
      bulls: ob + ib,
      h60: bin("60+"),
      h100: bin("100+"),
      h140: bin("140+"),
      h180: bin("180"),
      coCount: Number(s?.co?.coHits ?? 0),
      coDartsAvg: Number(s?.co?.avgCODarts ?? 0),
      highestCO: Number(s?.co?.highestCO ?? 0),
      pDB: pct(rate("dblHits")),
      pTP: pct(rate("triHits")),
      pBull: pct(ob),
      pDBull: pct(ib),
    };
  });
}

/* ---------------------------------------------
   Adaptateur "legacy"
----------------------------------------------*/
function avgArray(arr?: number[]) {
  return arr && arr.length
    ? Math.round((arr.reduce((s, x) => s + x, 0) / arr.length) * 100) / 100
    : 0;
}

function legToRowsViaLegacy(res: LegacyLegResult, nameOf: (id: string) => string) {
  const ids = Object.keys(res.remaining || {});
  const order = Array.isArray(res.order) && res.order.length ? res.order.slice() : ids.slice().sort((a, b) => {
    const ra = res.remaining?.[a] ?? Number.POSITIVE_INFINITY;
    const rb = res.remaining?.[b] ?? Number.POSITIVE_INFINITY;
    if ((ra === 0) !== (rb === 0)) return ra === 0 ? -1 : 1;
    const aa = res.avg3?.[a] ?? 0;
    const ab = res.avg3?.[b] ?? 0;
    return ab - aa;
  });

  const get = (obj: Record<string, number | undefined> | undefined, k: string) => obj?.[k] ?? 0;

  return order.map((pid, i) => {
    const ob = res.hitsBySector?.[pid]?.["OB"] ?? 0;
    const ib = res.hitsBySector?.[pid]?.["IB"] ?? 0;
    const darts = get(res.darts, pid);
    const pct = (a: number, b: number) => (b > 0 ? ((a / b) * 100).toFixed(1) + "%" : "0.0%");

    return {
      pid,
      rank: i + 1,
      name: nameOf(pid),
      remaining: get(res.remaining, pid),
      avg3: get(res.avg3, pid),
      best: res.bestVisit?.[pid] ?? 0,
      darts,
      visits: get(res.visits, pid),
      x180: res.x180?.[pid] ?? 0,
      doubles: res.doubles?.[pid] ?? 0,
      triples: res.triples?.[pid] ?? 0,
      ob,
      ib,
      bulls: ob + ib,
      h60: res.h60?.[pid] ?? 0,
      h100: res.h100?.[pid] ?? 0,
      h140: res.h140?.[pid] ?? 0,
      h180: res.h180?.[pid] ?? 0,
      coCount: res.checkoutDartsByPlayer?.[pid]?.length ?? 0,
      coDartsAvg: avgArray(res.checkoutDartsByPlayer?.[pid]),
      highestCO: res.bestCheckout?.[pid] ?? 0,
      pDB: pct(res.doubles?.[pid] ?? 0, darts),
      pTP: pct(res.triples?.[pid] ?? 0, darts),
      pBull: pct(ob, darts),
      pDBull: pct(ib, darts),
    };
  });
}

/* ====== INNER (avec hooks) ====== */
function OverlayInner({
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
    (id?: string | null) => playersById[id || ""]?.name ?? (id ? id : "—"),
    [playersById]
  );
  const avatarOf = React.useCallback(
    (id?: string | null) => playersById[id || ""]?.avatarDataUrl ?? null,
    [playersById]
  );

  // ---- helpers numériques & % ----
  const num = (n?: number | null) =>
    typeof n === "number" && isFinite(n) ? n : 0;
  const fmt2 = (n?: number | null) =>
    typeof n === "number" && isFinite(n) ? (Math.round(n * 100) / 100).toFixed(2) : "0.00";

  // ---- rows + ordre via nouvelle API ou legacy
  const rows = React.useMemo(() => {
    if (isLegStats(result)) return legToRowsViaNewStats(result, nameOf);
    return legToRowsViaLegacy(result as LegacyLegResult, nameOf);
  }, [result, nameOf]);

  // ---- winner / meta
  const winnerId = React.useMemo(() => {
    if (isLegStats(result)) return result.winnerId ?? rows[0]?.pid ?? null;
    return (result as LegacyLegResult).winnerId ?? rows[0]?.pid ?? null;
  }, [result, rows]);

  const legNo = isLegStats(result) ? (result.legNo as any) : (result as LegacyLegResult).legNo;
  const finishedAt = isLegStats(result)
    ? ((result as any).finishedAt ?? Date.now())
    : (result as LegacyLegResult).finishedAt;

  // ---- Best-of pour Résumé
  const minDarts = Math.min(...rows.map((r) => (r.darts > 0 ? r.darts : Infinity)));
  const minDartsRow = rows.find((r) => r.darts === minDarts);

  const bestAvg = Math.max(...rows.map((r) => r.avg3 || 0));
  const bestAvgRow = rows.find((r) => r.avg3 === bestAvg);

  const bestVol = Math.max(...rows.map((r) => r.best || 0));
  const bestVolRow = rows.find((r) => r.best === bestVol);

  const parsePct = (s: string) => {
    const n = parseFloat(String(s).replace("%", ""));
    return isFinite(n) ? n : 0;
  };

  const bestPDB = Math.max(...rows.map((r) => parsePct(r.pDB)));
  const bestPDBRow = rows.find((r) => parsePct(r.pDB) === bestPDB) ?? null;

  const bestPTP = Math.max(...rows.map((r) => parsePct(r.pTP)));
  const bestPTPRow = rows.find((r) => parsePct(r.pTP) === bestPTP) ?? null;

  const bestBullTotal = Math.max(...rows.map((r) => r.bulls || 0));
  const bestBullRow = rows.find((r) => r.bulls === bestBullTotal);

  // ---- Graph data (guards)
  const barData = React.useMemo(
    () => rows.map((r) => ({ name: r.name, avg3: Number(fmt2(r.avg3)) })),
    [rows]
  );

  // Radar (legacy uniquement)
  const radarKeys = React.useMemo(() => {
    if (!isLegStats(result)) {
      const res = result as LegacyLegResult;
      const first = rows[0]?.pid;
      const m = res.hitsBySector || {};
      if (!first || !m[first]) return null;
      const entries = Object.entries(m[first])
        .filter(([k]) => k !== "MISS")
        .sort((a, b) => (b[1] as number) - (a[1] as number))
        .slice(0, 12)
        .map(([k]) => k);
      return entries.length ? entries : null;
    }
    return null;
  }, [result, rows]);

  // ---- handler "Sauvegarder": MERGE + callback + close
  function handleSave() {
    try {
      mergeLegToBasics(result as any); // ← alimente le pont stats basiques
    } catch {}
    try {
      onSave?.(result);
    } catch {}
    onClose();
  }

  // ---- UI
  return (
    <div
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
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
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
        onClick={(e) => e.stopPropagation()}
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
            Manche terminée — {new Date(finishedAt ?? Date.now()).toLocaleTimeString()}
          </div>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} title="Fermer" style={btn("transparent", "#ddd", "#ffffff22")}>
            ✕
          </button>
        </div>

        {/* Corps */}
        <div style={{ padding: 10, paddingTop: 8 }}>
          {/* Classement (liste compacte) */}
          <div
            style={{
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,.07)",
              background: "linear-gradient(180deg, rgba(28,28,32,.65), rgba(18,18,20,.65))",
              marginBottom: 10,
            }}
          >
            {rows.map((r) => {
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
                    {r.rank}
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
                      <img
                        src={avatar}
                        alt=""
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
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

          {/* ===== Accordéons ===== */}
          <Accordion title="Résumé de la partie" defaultOpen>
            <SummaryRows
              winnerName={nameOf(winnerId || "")}
              minDartsRow={rows.find((rr) => rr.darts === Math.min(...rows.map((r) => (r.darts > 0 ? r.darts : Infinity))))}
              bestAvgRow={rows.find((rr) => rr.avg3 === Math.max(...rows.map((r) => r.avg3 || 0)))}
              bestVolRow={rows.find((rr) => rr.best === Math.max(...rows.map((r) => r.best || 0)))}
              bestPDBRow={rows.length ? rows.slice().sort((a, b) => parseFloat(String(b.pDB)) - parseFloat(String(a.pDB)))[0] : null}
              bestPTPRow={rows.length ? rows.slice().sort((a, b) => parseFloat(String(b.pTP)) - parseFloat(String(a.pTP)))[0] : null}
              bestBullRow={rows.length ? rows.slice().sort((a, b) => (b.bulls || 0) - (a.bulls || 0))[0] : null}
              fmt2={fmt2}
            />
          </Accordion>

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
                      <TD>{fmt2(r.avg3)}</TD>
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
                      <TD>{r.coCount ? fmt2(r.coDartsAvg) : "—"}</TD>
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
                  {rows.map((r) => (
                    <tr key={`global-${r.pid}`} style={rowLine}>
                      <TD>{r.rank}</TD>
                      <TDStrong>{r.name}</TDStrong>
                      <TD>{fmt2(r.avg3)}</TD>
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

/* ---------- Résumé bloc ---------- */
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
          isFinite(minDartsRow?.darts) ? (
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

/* ---------- Accordéon ---------- */
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

/* ---------- Hook & Guards Charts ---------- */
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

/* ---------- UI helpers ---------- */
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
    <td
      style={{
        padding: "6px 8px",
        fontSize: 12,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </td>
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
