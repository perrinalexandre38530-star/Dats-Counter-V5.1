// ============================================
// src/pages/X01End.tsx — Fin de partie ultra-complète (LEG/MATCH)
// - Tables stylées : Volumes • Power Scoring • Checkout • Précision
// - Stats bonus : 180/140+/100+/60+, Doubles/Triples/Bulls (+ % si dispo)
//   Visits, Points, Avg/1D, Avg/3D, First9, Best visit, Best CO,
//   Highest non-checkout (si dispo), Darts to Finish (si dispo)
// - Lecture robuste summary -> __legStats -> legacy payload/result
// - Bouton "Reprendre" masqué si partie terminée
// ============================================
import React from "react";
import { History } from "../lib/history";

type PlayerLite = { id: string; name?: string; avatarDataUrl?: string | null };

type Props = {
  go: (tab: string, params?: any) => void;
  params?: {
    matchId?: string;
    resumeId?: string | null;
    rec?: any;          // record passé directement
    showEnd?: boolean;
  };
};

export default function X01End({ go, params }: Props) {
  const [rec, setRec] = React.useState<any | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (params?.rec) { mounted && setRec(params.rec); return; }
        if (params?.matchId) {
          const byId = (History as any)?.get?.(params.matchId);
          if (byId) { mounted && setRec(byId); return; }
        }
        const mem = (window as any)?.__appStore?.history as any[] | undefined;
        if (mem?.length) {
          if (params?.matchId) {
            const m = mem.find((r) => r?.id === params.matchId);
            if (m) { mounted && setRec(m); return; }
          }
          const lastFin = [...mem].find((r) => String(r?.status).toLowerCase() === "finished");
          if (lastFin) { mounted && setRec(lastFin); return; }
        }
        mounted && setErr("Impossible de charger l'enregistrement.");
      } catch (e) {
        console.warn("[X01End] load error:", e);
        mounted && setErr("Erreur de chargement.");
      }
    })();
    return () => { mounted = false; };
  }, [params?.matchId, params?.rec]);

  if (err) {
    return (
      <Shell go={go} title="Fin de partie">
        <Notice>{err}</Notice>
      </Shell>
    );
  }
  if (!rec) return <Shell go={go}><Notice>Chargement…</Notice></Shell>;

  const status = normalizeStatus(rec);
  const finished = status === "finished";

  const when = num(rec.updatedAt ?? rec.createdAt ?? Date.now());
  const dateStr = new Date(when).toLocaleString();
  const players: PlayerLite[] =
    rec.players?.length ? rec.players : (rec.payload?.players || []);

  const winnerId: string | null =
    rec.winnerId ?? rec.payload?.winnerId ?? rec.summary?.winnerId ?? null;
  const winnerName =
    (winnerId && (players.find((p) => p.id === winnerId)?.name || null)) || null;

  // 1) Summary normalisé (playerStats.ts)
  const matchSummary = rec.summary && rec.summary.kind === "x01" ? rec.summary : null;

  // 2) Fallback depuis __legStats / legacy
  const legSummary = !matchSummary ? buildSummaryFromLeg(rec) : null;

  const title =
    (rec?.kind === "x01" || rec?.kind === "leg" ? "LEG" : String(rec?.kind || "Fin").toUpperCase()) +
    " — " + dateStr;

  // ====== Extraction d’un bloc "metrics" par joueur (fusion de toutes les sources) ======
  const metrics = buildPerPlayerMetrics(rec, matchSummary || legSummary, players);

  return (
    <Shell go={go} title={title} canResume={!finished} resumeId={params?.resumeId}>
      {/* Bandeau titre + vainqueur */}
      <Panel>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div style={{ fontWeight: 800, color: "#e8e8ec" }}>
            Joueurs : {players.map((p) => p?.name || "—").join(" · ") || "—"}
          </div>
          {winnerName && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#ffcf57", fontWeight: 900 }}>
              <Trophy /> <span>{winnerName}</span>
            </div>
          )}
        </div>
      </Panel>

      {/* Info si fallback manche */}
      {!matchSummary && legSummary && (
        <InfoCard>
          <b>Résumé (manche)</b> — reconstruit depuis les statistiques de la manche.
        </InfoCard>
      )}

      {/* TABLE 1 — Volumes */}
      <TableCard title="Volumes">
        <Table
          headers={["Joueur", "Avg/3D", "Avg/1D", "Best visit", "Best CO", "Darts", "Visits", "Points", "First9", "Darts to finish"]}
          rows={players.map((p) => {
            const m = metrics[p.id] || emptyMetrics(p);
            return [
              nameCell(m),
              n2(m.avg3),
              n2(m.avg1),
              n0(m.bestVisit),
              n0(m.bestCO),
              n0(m.darts),
              n0(m.visits),
              n0(m.points),
              m.first9 ? n2(m.first9) : "—",
              m.dartsToFinish ? n0(m.dartsToFinish) : "—",
            ];
          })}
        />
      </TableCard>

      {/* TABLE 2 — Power scoring */}
      <TableCard title="Power scoring">
        <Table
          headers={["Joueur", "180", "140+", "100+", "60+"]}
          rows={players.map((p) => {
            const m = metrics[p.id] || emptyMetrics(p);
            return [nameCell(m), n0(m.t180), n0(m.t140), n0(m.t100), n0(m.t60)];
          })}
        />
      </TableCard>

      {/* TABLE 3 — Checkout */}
      <TableCard title="Checkout">
        <Table
          headers={["Joueur", "Best CO", "CO hits", "CO att.", "CO %", "Highest non-CO"]}
          rows={players.map((p) => {
            const m = metrics[p.id] || emptyMetrics(p);
            return [
              nameCell(m),
              n0(m.bestCO),
              n0(m.coHits),
              n0(m.coAtt),
              pct(m.coPct),
              m.highestNonCO ? n0(m.highestNonCO) : "—",
            ];
          })}
        />
      </TableCard>

      {/* TABLE 4 — Précision (impacts) */}
      <TableCard title="Précision (impacts)">
        <Table
          headers={["Joueur", "Doubles", "Dbl %", "Triples", "Trpl %", "Bulls", "Bulls %"]}
          rows={players.map((p) => {
            const m = metrics[p.id] || emptyMetrics(p);
            return [
              nameCell(m),
              n0(m.doubles),
              pct(m.doublePct),
              n0(m.triples),
              pct(m.triplePct),
              n0(m.bulls),
              pct(m.bullPct),
            ];
          })}
        />
      </TableCard>
    </Shell>
  );
}

/* ====================== Normalisation "summary" depuis LEG/legacy ====================== */
function buildSummaryFromLeg(rec: any) {
  const leg = rec?.payload?.__legStats || rec?.__legStats;
  const per = leg?.perPlayer;
  const list = leg?.players;

  const now = Date.now();
  const make = (rows: Array<{ id: string; name?: string }>, get: (id: string) => any) => {
    const players: any = {};
    for (const p of rows) {
      const s = get(p.id) || {};
      const darts = num(s.dartsThrown ?? s.darts);
      const visits = num(s.visits);
      const points = num(s.pointsScored, (num(s.avg3) / 3) * (darts || visits * 3));
      const rawCO = s.bestCheckoutScore ?? s.highestCheckout ?? s.bestCheckout;
      const bestCO = sanitizeCheckout(rawCO);

      players[p.id] = {
        id: p.id,
        name: p.name || "—",
        avg3: num(s.avg3),
        bestVisit: num(s.bestVisit),
        bestCheckout: bestCO,
        darts: darts || (visits ? visits * 3 : 0),
        win: !!s.win || (rec?.winnerId ? rec.winnerId === p.id : false),
        buckets: s.buckets && Object.keys(s.buckets).length ? s.buckets : undefined,
        updatedAt: now,
        matches: 1,
        legs: 1,
        _sumPoints: points,
        _sumDarts: darts || (visits ? visits * 3 : 0),
        _sumVisits: visits || undefined,
      };
    }
    return { kind: "x01", winnerId: rec?.winnerId ?? null, players, updatedAt: now };
  };

  if (per && Array.isArray(list)) {
    return make(
      list.map((id: string) => ({ id, name: rec.players?.find((p: any) => p.id === id)?.name })),
      (id: string) => per[id] || {}
    );
  }

  // Legacy (avg3/darts/visits/bestVisit/bestCheckout directement sur payload/result)
  const ids: string[] = Object.keys(rec?.payload?.avg3 || rec?.avg3 || {});
  if (ids.length) {
    const rows = ids.map((id) => ({ id, name: rec.players?.find((p: any) => p.id === id)?.name }));
    const get = (id: string) => ({
      avg3: pick(rec, ["payload.avg3."+id, "avg3."+id]),
      bestVisit: pick(rec, ["payload.bestVisit."+id, "bestVisit."+id]),
      bestCheckout: sanitizeCheckout(
        pick(rec, ["payload.bestCheckout."+id, "bestCheckout."+id])
      ),
      darts: pick(rec, ["payload.darts."+id, "darts."+id]),
      visits: pick(rec, ["payload.visits."+id, "visits."+id]),
      buckets: undefined,
    });
    return make(rows, get);
  }
  return null;
}

/* ====================== Fusion/Extraction métriques par joueur ====================== */
type PlayerMetrics = {
  id: string; name: string;
  // volumes
  darts: number; visits: number; points: number; avg1: number; avg3: number;
  bestVisit: number; bestCO: number; first9?: number; dartsToFinish?: number;
  // power
  t180: number; t140: number; t100: number; t60: number;
  // impacts
  doubles: number; triples: number; bulls: number;
  doublePct?: number; triplePct?: number; bullPct?: number;
  // checkout
  coHits: number; coAtt: number; coPct: number; highestNonCO?: number;
};

function emptyMetrics(p: { id: string; name?: string }): PlayerMetrics {
  return {
    id: p.id, name: p.name || "—",
    darts: 0, visits: 0, points: 0, avg1: 0, avg3: 0,
    bestVisit: 0, bestCO: 0, first9: undefined, dartsToFinish: undefined,
    t180: 0, t140: 0, t100: 0, t60: 0,
    doubles: 0, triples: 0, bulls: 0,
    doublePct: undefined, triplePct: undefined, bullPct: undefined,
    coHits: 0, coAtt: 0, coPct: 0, highestNonCO: undefined,
  };
}

function buildPerPlayerMetrics(rec: any, summary: any | null, players: PlayerLite[]) {
  const out: Record<string, PlayerMetrics> = {};
  const per = rec?.payload?.__legStats?.perPlayer || rec?.__legStats?.perPlayer || {};
  const legacy = rec?.payload || rec || {};

  for (const pl of players) {
    const pid = pl.id;
    const base = emptyMetrics(pl);

    // ---- from summary (playerStats.ts / LEG summary) ----
    const s = summary?.players?.[pid];
    if (s) {
      base.avg3 = num(s.avg3);
      base.avg1 = base.avg3 / 3;
      base.bestVisit = num(s.bestVisit);
      base.bestCO = sanitizeCheckout(s.bestCheckout);
      base.darts = num(s.darts);
      base.visits = s._sumVisits ? num(s._sumVisits) : (base.darts ? Math.ceil(base.darts / 3) : 0);
      base.points = num(s._sumPoints);
      // buckets
      const b = s.buckets || {};
      base.t180 = num(b["180"]);
      base.t140 = num(b["140+"]);
      base.t100 = num(b["100+"]);
      base.t60  = num(b["60+"]);
    }

    // ---- from rich perPlayer ----
    const r = per?.[pid] || {};
    base.first9 = num(r.first9Avg, base.first9 || 0) || undefined;
    base.highestNonCO = num(r.highestNonCheckout, base.highestNonCO || 0) || undefined;
    base.dartsToFinish = num(r.dartsToFinish, base.dartsToFinish || 0) || undefined;

    base.doubles = num(r.doubles, base.doubles);
    base.triples = num(r.triples, base.triples);
    base.bulls   = num(r.bulls, base.bulls);

    // attempts/accuracy if available
    const dblAtt = num(r.doubleAttempts, 0);
    const trpAtt = num(r.tripleAttempts, 0);
    const bulAtt = num(r.bullAttempts, 0);
    base.doublePct = dblAtt > 0 ? (num(r.doubleHits, 0) / dblAtt) * 100 : base.doublePct;
    base.triplePct = trpAtt > 0 ? (num(r.tripleHits, 0) / trpAtt) * 100 : base.triplePct;
    base.bullPct   = bulAtt > 0 ? (num(r.bullHits, 0) / bulAtt) * 100 : base.bullPct;

    // checkout
    base.coHits = num(r.checkoutHits, base.coHits);
    base.coAtt  = num(r.checkoutAttempts, base.coAtt);
    base.coPct  = base.coAtt > 0 ? Math.round((base.coHits / base.coAtt) * 100) : base.coPct;

    // volumes fallback if missing
    base.visits = base.visits || num(r.visits, 0);
    base.points = base.points || num(r.pointsScored, 0);
    base.avg3   = base.avg3 || num(r.avg3, 0);
    base.avg1   = base.avg1 || (base.avg3 ? base.avg3 / 3 : 0);
    base.bestVisit = base.bestVisit || num(r.bestVisit, 0);
    base.bestCO = base.bestCO || sanitizeCheckout(r.bestCheckoutScore ?? r.highestCheckout ?? r.bestCheckout);

    // ---- legacy payload fields ----
    base.t180 = base.t180 || num(pick(legacy, ["h180."+pid, "h180?.[pid]"]), 0);
    base.t140 = base.t140 || num(pick(legacy, ["h140."+pid, "h140?.[pid]"]), 0);
    base.t100 = base.t100 || num(pick(legacy, ["h100."+pid, "h100?.[pid]"]), 0);
    base.t60  = base.t60  || num(pick(legacy, ["h60."+pid,  "h60?.[pid]"]),  0);

    base.darts  = base.darts  || num(pick(legacy, ["darts."+pid]), 0);
    base.visits = base.visits || num(pick(legacy, ["visits."+pid]), 0);
    base.points = base.points || num(pick(legacy, ["pointsScored."+pid]), 0);
    base.avg3   = base.avg3   || num(pick(legacy, ["avg3."+pid]), 0);
    base.avg1   = base.avg1   || (base.avg3 ? base.avg3 / 3 : 0);
    base.bestVisit = base.bestVisit || num(pick(legacy, ["bestVisit."+pid]), 0);
    base.bestCO    = base.bestCO    || sanitizeCheckout(pick(legacy, ["bestCheckout."+pid]));

    base.coHits = base.coHits || num(pick(legacy, ["checkoutHits."+pid]), 0);
    base.coAtt  = base.coAtt  || num(pick(legacy, ["checkoutAttempts."+pid]), 0);
    base.coPct  = base.coPct  || (base.coAtt > 0 ? Math.round((base.coHits / base.coAtt) * 100) : 0);

    out[pid] = base;
  }

  return out;
}

/* =========================== UI : Tables stylées =========================== */
function TableCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Panel style={{ padding: 12 }}>
      <h3 style={{ margin: "0 0 8px", fontSize: 15, letterSpacing: 0.2, color: "#ffcf57" }}>
        {title}
      </h3>
      {children}
    </Panel>
  );
}

function Table({
  headers,
  rows,
}: {
  headers: (string | React.ReactNode)[];
  rows: (Array<string | number | React.ReactNode>)[];
}) {
  return (
    <div
      style={{
        overflowX: "auto",
        border: "1px solid rgba(255,255,255,.08)",
        borderRadius: 12,
      }}
    >
      <table
        style={{
          width: "100%",
          borderCollapse: "separate",
          borderSpacing: 0,
          fontSize: 12.5,
        }}
      >
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th
                key={i}
                style={{
                  textAlign: i === 0 ? "left" : "right",
                  padding: "8px 10px",
                  color: "#ffcf57",
                  fontWeight: 800,
                  background: "rgba(255,255,255,.04)",
                  position: "sticky",
                  top: 0,
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} style={{ borderTop: "1px solid rgba(255,255,255,.05)" }}>
              {r.map((c, ci) => (
                <td
                  key={ci}
                  style={{
                    textAlign: ci === 0 ? "left" : "right",
                    padding: "6px 10px",
                    color: "#e8e8ec",
                    whiteSpace: "nowrap",
                    fontVariantNumeric: "tabular-nums",
                    borderTop: ri === 0 ? "none" : "1px solid rgba(255,255,255,.05)",
                  }}
                >
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ================== Shell & styles ================== */
function Shell({ go, title, children, canResume, resumeId }: any) {
  return (
    <div style={{ padding: 16, maxWidth: 640, margin: "0 auto" }}>
      <button onClick={() => go("stats", { tab: "history" })} style={btn()}>← Retour</button>
      <h2 style={{ margin: "12px 0 10px", letterSpacing: 0.3 }}>{title || "Fin de partie"}</h2>
      {children}
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button onClick={() => go("stats", { tab: "history" })} style={btn()}>← Retour à l’historique</button>
        {canResume && resumeId && (
          <button onClick={() => go("x01", { resumeId })} style={btnGold()}>Reprendre</button>
        )}
      </div>
    </div>
  );
}

function Panel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,.08)",
        background:
          "radial-gradient(120% 140% at 0% 0%, rgba(255,195,26,.06), transparent 55%), linear-gradient(180deg, rgba(22,22,26,.96), rgba(14,14,16,.98))",
        boxShadow: "0 18px 46px rgba(0,0,0,.35)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function InfoCard({ children }: { children: React.ReactNode }) {
  return (
    <Panel style={{ color: "#bbb", padding: 10, margin: "8px 0" }}>
      {children}
    </Panel>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <Panel>
      <div style={{ color: "#bbb" }}>{children}</div>
    </Panel>
  );
}

/* ================== Icons ================== */
function Trophy(props: any) {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} {...props}>
      <path fill="currentColor" d="M6 2h12v2h3a1 1 0 0 1 1 1v1a5 5 0 0 1-5 5h-1.1A6 6 0 0 1 13 13.9V16h3v2H8v-2h3v-2.1A6 6 0 0 1 8.1 11H7A5 5 0 0 1 2 6V5a1 1 0 0 1 1-1h3V2Z"/>
    </svg>
  );
}

/* ================== Utils ================== */
function normalizeStatus(rec: any): "finished" | "in_progress" {
  const s = String(rec?.status || "").toLowerCase();
  if (s === "finished") return "finished";
  if (s === "inprogress" || s === "in_progress") return "in_progress";
  const sum = rec?.summary || rec?.payload || {};
  if (sum?.finished === true || sum?.result?.finished === true) return "finished";
  return "in_progress";
}
function sanitizeCheckout(v: any): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  const r = Math.round(n);
  if (r === 50) return 50;
  if (r >= 2 && r <= 170) return r;
  return 0;
}
function nameCell(m: PlayerMetrics) {
  return <span style={{ fontWeight: 800, color: "#ffcf57" }}>{m.name}{/* (win handled in header) */}</span>;
}
function btn(): React.CSSProperties {
  return { borderRadius: 10, padding: "6px 12px", border: "1px solid rgba(255,255,255,.12)", background: "transparent", color: "#e8e8ec", fontWeight: 700, cursor: "pointer" };
}
function btnGold(): React.CSSProperties {
  return { borderRadius: 10, padding: "6px 12px", border: "1px solid rgba(255,180,0,.3)", background: "linear-gradient(180deg,#ffc63a,#ffaf00)", color: "#141417", fontWeight: 900, cursor: "pointer", boxShadow: "0 10px 22px rgba(255,170,0,.28)" };
}
function num(x: any, d = 0) { const n = Number(x); return Number.isFinite(n) ? n : d; }
function n2(x: any) { const v = Number(x); return Number.isFinite(v) ? v.toFixed(2) : "0.00"; }
function n0(x: any) { const n = Number(x); return Number.isFinite(n) ? (n | 0) : 0; }
function pct(x?: number) { const v = Number(x); return Number.isFinite(v) ? `${Math.round(Math.max(0, Math.min(100, v)))}%` : "—"; }
function pick(obj: any, paths: string[], def?: any) {
  for (const p of paths) {
    try {
      const segs = p.split(".");
      let cur = obj;
      let ok = true;
      for (const s of segs) {
        if (cur == null) { ok = false; break; }
        if (s in cur) cur = cur[s]; else { ok = false; break; }
      }
      if (ok) return cur;
    } catch {}
  }
  return def;
}
