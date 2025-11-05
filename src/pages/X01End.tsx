// ============================================
// src/pages/X01End.tsx — Fin de partie “maxi-stats” (LEG/MATCH) — compact + DBull + fallbacks
// ============================================
import React from "react";
import { History } from "../lib/history";

type PlayerLite = { id: string; name?: string; avatarDataUrl?: string | null };

type Props = {
  go: (tab: string, params?: any) => void;
  params?: { matchId?: string; resumeId?: string | null; rec?: any; showEnd?: boolean };
};

/* ====== DENSITÉ / RESPONSIVE ====== */
const D = { fsBody: 12, fsHead: 12, padCellV: 5, padCellH: 8, cardPad: 10, radius: 14 };
const mobileDenseCss = `
@media (max-width: 420px){
  .x-end h2{ font-size:16px; }
  .x-card h3{ font-size:13px; }
  .x-table{ font-size:11px; }
  .x-th, .x-td{ padding:4px 6px; }
}
`;

export default function X01End({ go, params }: Props) {
  const [rec, setRec] = React.useState<any | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (params?.rec) { if (mounted) setRec(params.rec); return; }
        if (params?.matchId) {
          const byId = (History as any)?.get?.(params.matchId);
          if (byId) { if (mounted) setRec(byId); return; }
        }
        const mem = (window as any)?.__appStore?.history as any[] | undefined;
        if (mem?.length) {
          if (params?.matchId) {
            const m = mem.find(r => r?.id === params.matchId);
            if (m) { if (mounted) setRec(m); return; }
          }
          const lastFin = mem.find(r => String(r?.status).toLowerCase() === "finished");
          if (lastFin) { if (mounted) setRec(lastFin); return; }
        }
        if (mounted) setErr("Impossible de charger l'enregistrement.");
      } catch (e) {
        console.warn("[X01End] load error:", e);
        if (mounted) setErr("Erreur de chargement.");
      }
    })();
    return () => { mounted = false; };
  }, [params?.matchId, params?.rec]);

  if (err) return <Shell go={go} title="Fin de partie"><Notice>{err}</Notice></Shell>;
  if (!rec)  return <Shell go={go}><Notice>Chargement…</Notice></Shell>;

  const finished = normalizeStatus(rec) === "finished";
  const when = n(rec.updatedAt ?? rec.createdAt ?? Date.now());
  const dateStr = new Date(when).toLocaleString();

  const players: PlayerLite[] = rec.players?.length ? rec.players : (rec.payload?.players || []);
  const winnerId: string | null =
    rec.winnerId ?? rec.payload?.winnerId ?? rec.summary?.winnerId ?? null;
  const winnerName =
    (winnerId && (players.find(p => p.id === winnerId)?.name || null)) || null;

  const matchSummary = rec.summary && rec.summary.kind === "x01" ? rec.summary : null;
  const legSummary   = !matchSummary ? buildSummaryFromLeg(rec) : null;

  const M = buildPerPlayerMetrics(rec, matchSummary || legSummary, players);
  const has = detectAvailability(M);

  const title =
    ((rec?.kind === "x01" || rec?.kind === "leg") ? "LEG" : String(rec?.kind || "Fin").toUpperCase())
    + " — " + dateStr;

  const resumeId = params?.resumeId ?? rec?.resumeId ?? rec?.payload?.resumeId ?? null;
  const canResume = !finished && !!resumeId;

  return (
    <Shell go={go} title={title} canResume={canResume} resumeId={resumeId}>
      <style dangerouslySetInnerHTML={{__html: mobileDenseCss}} />
      <Panel>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:10 }}>
          <div style={{ fontWeight: 800, color: "#e8e8ec", fontSize: 12 }}>
            Joueurs : {players.map(p => p?.name || "—").join(" · ") || "—"}
          </div>
          {winnerName ? (
            <div style={{ display:"inline-flex", alignItems:"center", gap:8, color:"#ffcf57", fontWeight:900 }}>
              <Trophy /><span>{winnerName}</span>
            </div>
          ) : null}
        </div>
      </Panel>

      {!matchSummary && legSummary ? (
        <InfoCard><b>Résumé (manche)</b> — reconstruit depuis les statistiques de la manche.</InfoCard>
      ) : null}

      {/* 1) VOLUMES */}
      <TableCard title="Volumes">
        <Table
          headers={[
            "Joueur","Avg/3D","Avg/1D","Best visit","Best CO","Darts","Visits","Pts","Pts/Vi",
            ...(has.first9 ? ["First9"] : []),
            ...(has.dartsToFinish ? ["Darts→CO"] : []),
            ...(has.highestNonCO ? ["Hi non-CO"] : []),
          ]}
          rows={players.map(p => {
            const m = M[p.id] || emptyMetrics(p);
            return [
              nameCell(m),
              f2(m.avg3), f2(m.avg1), f0(m.bestVisit), f0(m.bestCO),
              f0(m.darts), f0(m.visits), f0(m.points),
              m.visits > 0 ? f2(m.points / m.visits) : "—",
              ...(has.first9        ? [m.first9        != null ? f2(m.first9)        : "—"] : []),
              ...(has.dartsToFinish ? [m.dartsToFinish != null ? f0(m.dartsToFinish) : "—"] : []),
              ...(has.highestNonCO  ? [m.highestNonCO  != null ? f0(m.highestNonCO)  : "—"] : []),
            ];
          })}
        />
      </TableCard>

      {/* 2) POWER SCORING */}
      <TableCard title="Power scoring">
        <Table
          headers={["Joueur","180","140+","100+","60+","Tons (Σ)"]}
          rows={players.map(p => {
            const m = M[p.id] || emptyMetrics(p);
            const tonsTotal = m.t180 + m.t140 + m.t100;
            return [nameCell(m), f0(m.t180), f0(m.t140), f0(m.t100), f0(m.t60), f0(tonsTotal)];
          })}
        />
      </TableCard>

      {/* 3) CHECKOUT */}
      <TableCard title="Checkout">
        <Table
          headers={[
            "Joueur","Best CO","CO hits","CO att.","CO %",
            ...(has.avgCoDarts ? ["Avg darts@CO"] : []),
          ]}
          rows={players.map(p => {
            const m = M[p.id] || emptyMetrics(p);
            return [
              nameCell(m),
              f0(m.bestCO), f0(m.coHits), f0(m.coAtt), pct(m.coPct),
              ...(has.avgCoDarts ? [m.avgCoDarts != null ? f2(m.avgCoDarts) : "—"] : []),
            ];
          })}
        />
      </TableCard>

      {/* 4) DARTS USAGE */}
      <TableCard title="Darts usage">
        <Table
          headers={["Joueur","Darts","Singles","Singles %","Miss","Miss %","Bust","Bust %"]}
          rows={players.map(p => {
            const m = M[p.id] || emptyMetrics(p);
            const d = Math.max(0, m.darts || 0);
            // singles fallback (reconstruction)
            const singles = n(m.singles, Math.max(0, d - (n(m.doubles)+n(m.triples)+n(m.bulls)+n(m.dbulls)+n(m.misses)+n(m.busts))));
            const misses  = n(m.misses, 0);
            const busts   = n(m.busts, 0);
            const sp = d>0 ? (singles/d*100) : undefined;
            const mp = d>0 ? (misses /d*100) : undefined;
            const bp = d>0 ? (busts  /d*100) : undefined;
            return [nameCell(m), f0(d), f0(singles), pct(sp), f0(misses), pct(mp), f0(busts), pct(bp)];
          })}
        />
      </TableCard>

      {/* 5) IMPACTS */}
      <TableCard title="Précision (impacts)">
        <Table
          headers={[
            "Joueur",
            "Doubles","Dbl %",
            "Triples","Trpl %",
            "Bulls","Bulls %",
            "DBull","DBull %",
            ...(has.singles ? ["Singles"] : []),
            ...(has.misses  ? ["Misses"]  : []),
          ]}
          rows={players.map(p => {
            const m = M[p.id] || emptyMetrics(p);
            return [
              nameCell(m),
              f0(m.doubles), pct(m.doublePct),
              f0(m.triples), pct(m.triplePct),
              f0(m.bulls),   pct(m.bullPct),
              f0(m.dbulls),  pct(m.dbullPct),
              ...(has.singles ? [f0(m.singles || 0)] : []),
              ...(has.misses  ? [f0(m.misses  || 0)] : []),
            ];
          })}
        />
      </TableCard>

      {/* 6) RATES (si tentatives connues ou fallback) */}
      <TableCard title="Rates (si tentatives connues ou fallback)">
        <Table
          headers={["Joueur","Treble rate","Double rate","Bull rate","DBull rate","Checkout rate","Single rate","Bust rate"]}
          rows={players.map(p => {
            const m = M[p.id] || emptyMetrics(p);
            return [nameCell(m), pct(m.triplePct), pct(m.doublePct), pct(m.bullPct), pct(m.dbullPct), pct(m.coPct), pct(m.singleRate), pct(m.bustRate)];
          })}
        />
      </TableCard>
    </Shell>
  );
}

/* ===== Fallback LEG -> summary-like ===== */
function buildSummaryFromLeg(rec: any) {
  const leg = rec?.payload?.__legStats || rec?.__legStats;
  const per  = leg?.perPlayer;
  const list = leg?.players;
  const now = Date.now();

  const make = (rows: Array<{ id: string; name?: string }>, get: (id: string) => any) => {
    const players: any = {};
    for (const p of rows) {
      const s = get(p.id) || {};
      const darts   = n(s.dartsThrown ?? s.darts);
      const visits  = n(s.visits);
      const points  = n(s.pointsScored, (n(s.avg3) / 3) * (darts || visits * 3));
      const bestCO  = sanitizeCO(s.bestCheckoutScore ?? s.highestCheckout ?? s.bestCheckout);
      players[p.id] = {
        id: p.id, name: p.name || "—",
        avg3: n(s.avg3),
        bestVisit: n(s.bestVisit),
        bestCheckout: bestCO,
        darts: darts || (visits ? visits * 3 : 0),
        win: !!s.win || (rec?.winnerId ? rec.winnerId === p.id : false),
        buckets: s.buckets && Object.keys(s.buckets).length ? s.buckets : undefined,
        updatedAt: now, matches: 1, legs: 1,
        _sumPoints: points, _sumDarts: darts || (visits ? visits * 3 : 0), _sumVisits: visits || undefined,
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

  const ids: string[] = Object.keys(rec?.payload?.avg3 || rec?.avg3 || {});
  if (ids.length) {
    const rows = ids.map(id => ({ id, name: rec.players?.find((p: any) => p.id === id)?.name }));
    const get  = (id: string) => ({
      avg3:         pick(rec, [`payload.avg3.${id}`,       `avg3.${id}`]),
      bestVisit:    pick(rec, [`payload.bestVisit.${id}`,  `bestVisit.${id}`]),
      bestCheckout: sanitizeCO(pick(rec, [`payload.bestCheckout.${id}`, `bestCheckout.${id}`])),
      darts:        pick(rec, [`payload.darts.${id}`,      `darts.${id}`]),
      visits:       pick(rec, [`payload.visits.${id}`,     `visits.${id}`]),
      buckets:      undefined,
    });
    return make(rows, get);
  }
  return null;
}

/* ===== Metrics ===== */
type PlayerMetrics = {
  id: string; name: string;
  darts: number; visits: number; points: number; avg1: number; avg3: number;
  bestVisit: number; bestCO: number; first9?: number; dartsToFinish?: number; highestNonCO?: number;
  avgCoDarts?: number;
  t180: number; t140: number; t100: number; t60: number;
  doubles: number; triples: number; bulls: number; dbulls: number;
  singles?: number; misses?: number; busts?: number;
  doublePct?: number; triplePct?: number; bullPct?: number; dbullPct?: number;
  singleRate?: number; bustRate?: number;
  coHits: number; coAtt: number; coPct: number;
  segOuter?: number; segInner?: number; segDouble?: number; segTriple?: number; segMiss?: number;
};

function emptyMetrics(p: { id: string; name?: string }): PlayerMetrics {
  return {
    id: p.id, name: p.name || "—",
    darts: 0, visits: 0, points: 0, avg1: 0, avg3: 0,
    bestVisit: 0, bestCO: 0, first9: undefined, dartsToFinish: undefined, highestNonCO: undefined, avgCoDarts: undefined,
    t180: 0, t140: 0, t100: 0, t60: 0,
    doubles: 0, triples: 0, bulls: 0, dbulls: 0,
    singles: undefined, misses: undefined, busts: undefined,
    doublePct: undefined, triplePct: undefined, bullPct: undefined, dbullPct: undefined,
    singleRate: undefined, bustRate: undefined,
    coHits: 0, coAtt: 0, coPct: 0,
    segOuter: undefined, segInner: undefined, segDouble: undefined, segTriple: undefined, segMiss: undefined,
  };
}

function buildPerPlayerMetrics(rec: any, summary: any | null, players: PlayerLite[]) {
  const out: Record<string, PlayerMetrics> = {};
  const rich   = rec?.payload?.__legStats || rec?.__legStats || {};
  const per    = rich.perPlayer || {};
  const legacy = rec?.payload || rec || {};

  for (const pl of players) {
    const pid = pl.id;
    const m = emptyMetrics(pl);

    // summary
    const s = summary?.players?.[pid];
    if (s) {
      m.avg3 = n(s.avg3); m.avg1 = m.avg3 / 3;
      m.bestVisit = n(s.bestVisit);
      m.bestCO    = sanitizeCO(s.bestCheckout);
      m.darts     = n(s.darts);
      m.visits    = s._sumVisits ? n(s._sumVisits) : (m.darts ? Math.ceil(m.darts / 3) : 0);
      m.points    = n(s._sumPoints, (m.avg3/3) * m.darts);
      const b = s.buckets || {};
      m.t180 = n(b["180"]); m.t140 = n(b["140+"]); m.t100 = n(b["100+"]); m.t60 = n(b["60+"]);
    }

    // rich perPlayer / impacts / segments
    const r = per?.[pid] || {};
    const imp = r.impacts || {};
    m.first9        = v(r.first9Avg);
    m.highestNonCO  = v(r.highestNonCheckout);
    m.dartsToFinish = v(r.dartsToFinish);
    m.avgCoDarts    = v(r.avgCheckoutDarts);

    // bruts
    m.doubles = n(r.doubles, n(imp.doubles, m.doubles));
    m.triples = n(r.triples, n(imp.triples, m.triples));
    m.bulls   = n(r.bulls,   n(imp.bulls,   m.bulls));
    m.dbulls  = n(r.dbulls,  n(imp.dbulls,  m.dbulls)); // NEW
    m.singles = (r.singles ?? imp.singles ?? m.singles) as any;
    m.misses  = (r.misses  ?? imp.misses  ?? m.misses ) as any;
    m.busts   = (r.busts   ?? imp.busts   ?? m.busts  ) as any;

    // attempts + hits (pour % “vrais” si présents)
    const dblAtt = n(r.doubleAttempts ?? imp.doubleAttempts, 0);
    const trpAtt = n(r.tripleAttempts ?? imp.tripleAttempts, 0);
    const bulAtt = n(r.bullAttempts   ?? imp.bullAttempts,   0);
    const dbuAtt = n(r.dbullAttempts  ?? imp.dbullAttempts  ?? r.doubleBullAttempts ?? imp.doubleBullAttempts, 0);

    const dblHit = n(r.doubleHits     ?? imp.doubleHits,     0);
    const trpHit = n(r.tripleHits     ?? imp.tripleHits,     0);
    const bulHit = n(r.bullHits       ?? imp.bullHits,       0);
    const dbuHit = n(r.dbullHits      ?? imp.dbullHits      ?? r.doubleBullHits     ?? imp.doubleBullHits, 0);

    if (dblAtt > 0) m.doublePct = (dblHit / dblAtt) * 100;
    if (trpAtt > 0) m.triplePct = (trpHit / trpAtt) * 100;
    if (bulAtt > 0) m.bullPct   = (bulHit / bulAtt) * 100;
    if (dbuAtt > 0) m.dbullPct  = (dbuHit / dbuAtt) * 100;

    // fallback si pas d’attempts: rapportés aux darts jouées
    if (m.doublePct == null && m.darts) m.doublePct = (n(m.doubles)/m.darts)*100;
    if (m.triplePct == null && m.darts) m.triplePct = (n(m.triples)/m.darts)*100;
    if (m.bullPct   == null && m.darts) m.bullPct   = (n(m.bulls)/m.darts)*100;
    if (m.dbullPct  == null && m.darts) m.dbullPct  = (n(m.dbulls)/m.darts)*100;

    // optional: singles/bust rates (tentatives si dispo sinon fallback darts)
    const sngAtt = n(r.singleAttempts ?? imp.singleAttempts, 0);
    const bstAtt = n(r.bustAttempts   ?? imp.bustAttempts,   0);
    const sngHit = n(r.singleHits     ?? imp.singleHits,     0);
    const bstHit = n(r.bustHits       ?? imp.bustHits,       0);
    if (sngAtt > 0) m.singleRate = (sngHit / sngAtt) * 100;
    if (bstAtt > 0) m.bustRate   = (bstHit / bstAtt) * 100;
    if (m.singleRate == null && m.darts) m.singleRate = (n(m.singles)/m.darts)*100;
    if (m.bustRate   == null && m.darts) m.bustRate   = (n(m.busts)/m.darts)*100;

    // checkout
    m.coHits = n(r.checkoutHits,     m.coHits);
    m.coAtt  = n(r.checkoutAttempts, m.coAtt);
    if (m.coAtt > 0) m.coPct = (m.coHits / m.coAtt) * 100;

    // volumes complémentaires
    m.visits     = m.visits || n(r.visits, 0);
    m.points     = m.points || n(r.pointsScored, 0);
    m.avg3       = m.avg3   || n(r.avg3, 0); m.avg1 = m.avg1 || (m.avg3 ? m.avg3/3 : 0);
    m.bestVisit  = m.bestVisit || n(r.bestVisit, 0);
    m.bestCO     = m.bestCO    || sanitizeCO(r.bestCheckoutScore ?? r.highestCheckout ?? r.bestCheckout);

    // segments
    if (r.segments) {
      m.segOuter  = v(r.segments.outer);
      m.segInner  = v(r.segments.inner);
      m.segDouble = v(r.segments.double);
      m.segTriple = v(r.segments.triple);
      m.segMiss   = v(r.segments.miss);
    }

    // legacy power
    m.t180 = m.t180 || n(pick(legacy, [`h180.${pid}`, `t180.${pid}`]), 0);
    m.t140 = m.t140 || n(pick(legacy, [`h140.${pid}`, `t140.${pid}`]), 0);
    m.t100 = m.t100 || n(pick(legacy, [`h100.${pid}`, `t100.${pid}`]), 0);
    m.t60  = m.t60  || n(pick(legacy, [`h60.${pid}`,  `t60.${pid}` ]),  0);

    // legacy volumes
    m.darts  = m.darts  || n(pick(legacy, [`darts.${pid}`, `dartsThrown.${pid}`]), 0);
    m.visits = m.visits || n(pick(legacy, [`visits.${pid}`]), 0);
    m.points = m.points || n(pick(legacy, [`pointsScored.${pid}`, `points.${pid}`]), 0);
    m.avg3   = m.avg3   || n(pick(legacy, [`avg3.${pid}`, `avg3d.${pid}`]), 0); m.avg1 = m.avg1 || (m.avg3 ? m.avg3/3 : 0);
    m.bestVisit = m.bestVisit || n(pick(legacy, [`bestVisit.${pid}`]), 0);
    m.bestCO    = m.bestCO    || sanitizeCO(pick(legacy, [`bestCheckout.${pid}`, `highestCheckout.${pid}`, `bestCO.${pid}`]));

    // legacy impacts (beaucoup d’alias, y compris DBull / miss / bust)
    const dblC = n(pick(legacy,[`doubles.${pid}`, `doubleCount.${pid}`, `dbl.${pid}`]), 0);
    const trpC = n(pick(legacy,[`triples.${pid}`, `tripleCount.${pid}`, `trp.${pid}`]), 0);
    const bulC = n(pick(legacy,[`bulls.${pid}`,   `bullCount.${pid}`,   `bull.${pid}`]), 0);          // 25
    const dbuC = n(pick(legacy,[`dbulls.${pid}`,  `doubleBull.${pid}`,  `doubleBulls.${pid}`, `bull50.${pid}`]), 0); // 50
    const sngC = pick(legacy,[`singles.${pid}`, `single.${pid}`]);
    const misC = pick(legacy,[`misses.${pid}`, `miss.${pid}`]);
    const bstC = pick(legacy,[`busts.${pid}`,  `bust.${pid}`, `bustCount.${pid}`]);

    if (!m.doubles) m.doubles = dblC;
    if (!m.triples) m.triples = trpC;
    if (!m.bulls)   m.bulls   = bulC;
    if (!m.dbulls)  m.dbulls  = dbuC;
    if (m.singles == null && sngC != null) m.singles = n(sngC, 0);
    if (m.misses  == null && misC != null) m.misses  = n(misC, 0);
    if (m.busts   == null && bstC != null) m.busts   = n(bstC, 0);

    // legacy checkout
    m.coHits = m.coHits || n(pick(legacy, [`checkoutHits.${pid}`]), 0);
    m.coAtt  = m.coAtt  || n(pick(legacy, [`checkoutAttempts.${pid}`]), 0);
    if (m.coPct == null) m.coPct = m.coAtt > 0 ? (m.coHits / m.coAtt) * 100 : 0;

    // dérivés
    if (!m.points && m.avg3 && m.darts) m.points = Math.round((m.avg3/3) * m.darts);
    if (!m.visits && m.darts)           m.visits = Math.ceil(m.darts / 3);

    out[pid] = m;
  }
  return out;
}

/* ===== Détection colonnes optionnelles ===== */
function detectAvailability(M: Record<string, PlayerMetrics>) {
  const vals = Object.values(M);
  const any = (k: keyof PlayerMetrics) =>
    vals.some(v => v[k] != null && Number(v[k] as any) !== 0);
  const segAny = ["segOuter","segInner","segDouble","segTriple","segMiss"].some(k => any(k as any));
  const impactsAny =
    any("doubles") || any("triples") || any("bulls") || any("dbulls") ||
    any("doublePct") || any("triplePct") || any("bullPct") || any("dbullPct");

  return {
    first9:        any("first9"),
    dartsToFinish: any("dartsToFinish"),
    highestNonCO:  any("highestNonCO"),
    avgCoDarts:    any("avgCoDarts"),
    singles:       any("singles"),
    misses:        any("misses"),
    segments:      segAny,
    rates:         any("doublePct") || any("triplePct") || any("bullPct") || any("dbullPct") || any("coPct") || any("singleRate") || any("bustRate"),
    impacts:       impactsAny,
  };
}

/* ===== UI ===== */
function TableCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Panel className="x-card" style={{ padding: D.cardPad }}>
      <h3 style={{ margin:"0 0 6px", fontSize:D.fsHead+1, letterSpacing:0.2, color:"#ffcf57" }}>{title}</h3>
      {children}
    </Panel>
  );
}
function Table({ headers, rows }: { headers:(string|React.ReactNode)[]; rows:(Array<string|number|React.ReactNode>)[]; }) {
  return (
    <div className="x-table" style={{ overflowX:"auto", border:"1px solid rgba(255,255,255,.08)", borderRadius:D.radius }}>
      <table style={{ width:"100%", borderCollapse:"separate", borderSpacing:0, fontSize:D.fsBody }}>
        <thead>
          <tr>
            {headers.map((h,i)=>(
              <th key={i} className="x-th"
                  style={{ textAlign:i===0?"left":"right", padding:`${D.padCellV}px ${D.padCellH}px`,
                           color:"#ffcf57", fontWeight:800, background:"rgba(255,255,255,.04)",
                           position:"sticky", top:0, whiteSpace:"nowrap" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r,ri)=>(
            <tr key={ri}>
              {r.map((c,ci)=>(
                <td key={ci} className="x-td"
                    style={{ textAlign:ci===0?"left":"right", padding:`${D.padCellV}px ${D.padCellH}px`,
                             color:"#e8e8ec", whiteSpace:"nowrap", fontVariantNumeric:"tabular-nums",
                             borderTop: ri===0 ? "none" : "1px solid rgba(255,255,255,.05)" }}>
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
function Shell({ go, title, children, canResume, resumeId }:{
  go:(t:string,p?:any)=>void; title?:string; children?:React.ReactNode; canResume?:boolean; resumeId?:string|null;
}) {
  return (
    <div className="x-end" style={{ padding:12, maxWidth:640, margin:"0 auto" }}>
      <button onClick={()=>go("stats",{tab:"history"})} style={btn()}>← Retour</button>
      <h2 style={{ margin:"10px 0 8px", letterSpacing:0.3 }}>{title || "Fin de partie"}</h2>
      {children}
      <div style={{ display:"flex", gap:8, marginTop:12 }}>
        <button onClick={()=>go("stats",{tab:"history"})} style={btn()}>← Historique</button>
        {canResume && resumeId ? (
          <button onClick={()=>go("x01",{ resumeId })} style={btnGold()}>Reprendre</button>
        ) : null}
      </div>
    </div>
  );
}
function Panel({ children, style, className }:{children:React.ReactNode; style?:React.CSSProperties; className?:string}) {
  return (
    <div className={className} style={{
      padding:D.cardPad, borderRadius:D.radius, border:"1px solid rgba(255,255,255,.08)",
      background:"radial-gradient(120% 140% at 0% 0%, rgba(255,195,26,.06), transparent 55%), linear-gradient(180deg, rgba(22,22,26,.96), rgba(14,14,16,.98))",
      boxShadow:"0 18px 46px rgba(0,0,0,.35)", ...style,
    }}>
      {children}
    </div>
  );
}
function InfoCard({ children }:{children:React.ReactNode}) {
  return <Panel style={{ color:"#bbb", padding:D.cardPad }}>{children}</Panel>;
}
function Notice({ children }:{children:React.ReactNode}) {
  return <Panel><div style={{ color:"#bbb" }}>{children}</div></Panel>;
}
function Trophy(props:any){
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} {...props}>
      <path fill="currentColor" d="M6 2h12v2h3a1 1 0 0 1 1 1v1a5 5 0 0 1-5 5h-1.1A6 6 0 0 1 13 13.9V16h3v2H8v-2h3v-2.1A6 6 0 0 1 8.1 11H7A5 5 0 0 1 2 6V5a1 1 0 0 1 1-1h3V2Z"/>
    </svg>
  );
}

/* ===== Utils ===== */
function normalizeStatus(rec:any):"finished"|"in_progress"{
  const raw = String(rec?.status ?? rec?.payload?.status ?? "").toLowerCase();
  if (raw === "finished") return "finished";
  if (raw === "inprogress" || raw === "in_progress") return "in_progress";
  const sum = rec?.summary ?? rec?.payload ?? {};
  if (sum?.finished === true || sum?.result?.finished === true) return "finished";
  return "in_progress";
}
function sanitizeCO(v:any):number{ const num = Number(v); if(!Number.isFinite(num)) return 0; const r = Math.round(num); if (r===50) return 50; if (r>=2 && r<=170) return r; return 0; }
function nameCell(m:PlayerMetrics){ return <span style={{fontWeight:800,color:"#ffcf57"}}>{m.name}</span>; }
function btn():React.CSSProperties{ return { borderRadius:10, padding:"6px 10px", border:"1px solid rgba(255,255,255,.12)", background:"transparent", color:"#e8e8ec", fontWeight:700, cursor:"pointer", fontSize:12 }; }
function btnGold():React.CSSProperties{ return { borderRadius:10, padding:"6px 10px", border:"1px solid rgba(255,180,0,.3)", background:"linear-gradient(180deg,#ffc63a,#ffaf00)", color:"#141417", fontWeight:900, boxShadow:"0 10px 22px rgba(255,170,0,.28)", fontSize:12 }; }
function n(x:any,d=0){ const v=Number(x); return Number.isFinite(v)?v:d; }
function v(x:any){ const vv=Number(x); return Number.isFinite(vv)&&vv!==0?vv:undefined; }
function f2(x:any){ const v=Number(x); return Number.isFinite(v)?v.toFixed(2):"0.00"; }
function f0(x:any){ const v=Number(x); return Number.isFinite(v)?(v|0):0; }
function pct(x?:number){ const v=Number(x); return Number.isFinite(v)?`${Math.round(Math.max(0,Math.min(100,v)))}%`:"—"; }
function pick(obj:any, paths:string[], def?:any){
  for (const p of paths){
    try{
      const segs=p.split(".");
      let cur:any=obj; let ok=true;
      for(const s of segs){ if(cur==null){ok=false;break;} if(s in cur){cur=cur[s];} else {ok=false;break;} }
      if(ok) return cur;
    }catch{/* ignore */}
  }
  return def;
}
