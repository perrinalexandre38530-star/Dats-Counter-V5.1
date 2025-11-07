// ============================================
// src/pages/X01End.tsx
// Fin de partie “maxi-stats” (LEG/MATCH) — version colonnes = joueurs
// + DBull, % corrects, fallbacks robustes
// + Cible circulaire (polar) par numéros 1..20 + Bull/DBull/Miss
// ============================================
import React from "react";
import { History } from "../lib/history";

/* ================================
   Types basiques
================================ */
type PlayerLite = { id: string; name?: string; avatarDataUrl?: string | null };

type Props = {
  go: (tab: string, params?: any) => void;
  params?: { matchId?: string; resumeId?: string | null; rec?: any; showEnd?: boolean };
};

/* ================================
   Densité / responsive
================================ */
const D = { fsBody: 12, fsHead: 12, padCellV: 6, padCellH: 10, cardPad: 10, radius: 14 };
const mobileDenseCss = `
@media (max-width: 420px){
  .x-end h2{ font-size:16px; }
  .x-card h3{ font-size:13px; }
  .x-table{ font-size:11px; }
  .x-th, .x-td{ padding:4px 6px; }
  .selector button{ font-size:11px; padding:4px 8px; }
}
`;

/* ================================
   Composant principal
================================ */
export default function X01End({ go, params }: Props) {
  // --- Hooks toujours au même ordre ---
  const [rec, setRec] = React.useState<any | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  // cible: ne pas dépendre de rec au moment de l'initialisation
  const [chartPid, setChartPid] = React.useState<string>("");

  // chargement de l'enregistrement (ne change pas l'ordre des hooks)
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

  // données dérivées — protégées quand rec est null
  const finished = normalizeStatus(rec ?? {}) === "finished";
  const when = n(rec?.updatedAt ?? rec?.createdAt ?? Date.now());
  const dateStr = new Date(when).toLocaleString();

  const players: PlayerLite[] = React.useMemo(() => {
    if (!rec) return [];
    return rec.players?.length ? rec.players : (rec.payload?.players || []);
  }, [rec]);

  const winnerId: string | null =
    rec?.winnerId ?? rec?.payload?.winnerId ?? rec?.summary?.winnerId ?? null;
  const winnerName =
    (winnerId && (players.find(p => p.id === winnerId)?.name || null)) || null;

  const matchSummary = rec?.summary && rec?.summary.kind === "x01" ? rec.summary : null;
  const legSummary   = !matchSummary ? buildSummaryFromLeg(rec) : null;

  const M = React.useMemo(() => {
    return rec ? buildPerPlayerMetrics(rec, matchSummary || legSummary, players) : {};
  }, [rec, matchSummary, legSummary, players]);

  const has = detectAvailability(M);

  const title =
    (((rec?.kind === "x01" || rec?.kind === "leg") ? "LEG" : String(rec?.kind || "Fin").toUpperCase())
     + " — " + dateStr);

  const resumeId = params?.resumeId ?? rec?.resumeId ?? rec?.payload?.resumeId ?? null;
  const canResume = !!resumeId && !finished;

  // garder chartPid cohérent avec la liste des joueurs dès qu'elle change
  React.useEffect(() => {
    if (!players.length) return;
    setChartPid(prev => (players.find(p => p.id === prev) ? prev : (players[0]?.id || "")));
  }, [players]);

  // --- Rendus (aucun hook après ceci) ---
  if (err) return <Shell go={go} title="Fin de partie"><Notice>{err}</Notice></Shell>;
  if (!rec)  return <Shell go={go}><Notice>Chargement…</Notice></Shell>;

  const chartPlayer = players.find(p => p.id === chartPid);
  const chartMetrics = chartPlayer ? (M[chartPlayer.id] || emptyMetrics(chartPlayer)) : null;
  
  /* ========= Tableaux COL-MAJOR (colonnes = joueurs) ========= */
  const cols = players.map(p => ({ key: p.id, title: p.name || "—" }));

  const tableStyle: React.CSSProperties = {
    width:"100%", borderCollapse:"separate", borderSpacing:0, fontSize:D.fsBody
  };

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

      {/* ===== 1) VOLUMES (lignes) ===== */}
      <CardTable title="Volumes">
        <TableColMajor
          columns={cols}
          rowGroups={[
            {
              rows: [
                { label:"Avg/3D",  get:(m)=>f2(m.avg3) },
                { label:"Avg/1D",  get:(m)=>f2(m.avg1) },
                { label:"Best visit", get:(m)=>f0(m.bestVisit) },
                { label:"Best CO", get:(m)=>f0(m.bestCO) },
                { label:"Darts",   get:(m)=>f0(m.darts) },
                { label:"Visits",  get:(m)=>f0(m.visits) },
                { label:"Points",  get:(m)=>f0(m.points) },
                { label:"Score/visit", get:(m)=> m.visits>0 ? f2(m.points/m.visits) : "—" },
                ...(has.first9        ? [{ label:"First9", get:(m)=> m.first9!=null?f2(m.first9):"—"}] : []),
                ...(has.dartsToFinish ? [{ label:"Darts→CO", get:(m)=> m.dartsToFinish!=null?f0(m.dartsToFinish):"—"}] : []),
                ...(has.highestNonCO  ? [{ label:"Hi non-CO", get:(m)=> m.highestNonCO!=null?f0(m.highestNonCO):"—"}] : []),
              ]
            }
          ]}
          dataMap={M}
          tableStyle={tableStyle}
        />
      </CardTable>

      {/* ===== 2) POWER SCORING (ordre 60,100,140+,180) ===== */}
      <CardTable title="Power scoring">
        <TableColMajor
          columns={cols}
          rowGroups={[
            { rows: [
              { label:"60+",  get:(m)=>f0(m.t60)  },
              { label:"100+", get:(m)=>f0(m.t100) },
              { label:"140+", get:(m)=>f0(m.t140) },
              { label:"180",  get:(m)=>f0(m.t180) },
              { label:"Tons (Σ)", get:(m)=>f0(m.t180 + m.t140 + m.t100) },
            ]},
          ]}
          dataMap={M}
          tableStyle={tableStyle}
        />
      </CardTable>

      {/* ===== 3) CHECKOUT ===== */}
      <CardTable title="Checkout">
        <TableColMajor
          columns={cols}
          rowGroups={[
            { rows: [
              { label:"Best CO", get:(m)=>f0(m.bestCO) },
              { label:"CO hits", get:(m)=>f0(m.coHits) },
              { label:"CO att.", get:(m)=>f0(m.coAtt) },
              { label:"CO %",    get:(m)=>pct(m.coPct) },
              ...(has.avgCoDarts ? [{ label:"Avg darts@CO", get:(m)=> m.avgCoDarts!=null?f2(m.avgCoDarts):"—" }] : []),
            ]},
          ]}
          dataMap={M}
          tableStyle={tableStyle}
        />
      </CardTable>

      {/* ===== 4) DARTS USAGE ===== */}
      <CardTable title="Darts usage">
        <TableColMajor
          columns={cols}
          rowGroups={[
            { rows: [
              { label:"Darts",   get:(m)=>f0(m.darts) },
              { label:"Singles", get:(m)=> {
                  const d = Math.max(0, m.darts||0);
                  const singles = n(m.singles, Math.max(0, d - (n(m.doubles)+n(m.triples)+n(m.bulls)+n(m.dbulls)+n(m.misses)+n(m.busts))));
                  return f0(singles);
                } },
              { label:"Singles %", get:(m)=>{
                  const d = Math.max(0, m.darts||0);
                  const singles = n(m.singles, Math.max(0, d - (n(m.doubles)+n(m.triples)+n(m.bulls)+n(m.dbulls)+n(m.misses)+n(m.busts))));
                  return pct(d>0 ? (singles/d*100) : undefined);
                }},
              { label:"Miss",     get:(m)=>f0(m.misses||0) },
              { label:"Miss %",   get:(m)=>pct( (m.darts>0) ? (n(m.misses)/m.darts*100) : undefined ) },
              { label:"Bust",     get:(m)=>f0(m.busts||0) },
              { label:"Bust %",   get:(m)=>pct( (m.darts>0) ? (n(m.busts)/m.darts*100) : undefined ) },
            ]},
          ]}
          dataMap={M}
          tableStyle={tableStyle}
        />
      </CardTable>

      {/* ===== 5) PRÉCISION (IMPACTS) ===== */}
      <CardTable title="Précision (impacts)">
        <TableColMajor
          columns={cols}
          rowGroups={[
            { rows: [
              { label:"Doubles",  get:(m)=>f0(m.doubles) },
              { label:"Dbl %",    get:(m)=>pct(m.doublePct) },
              { label:"Triples",  get:(m)=>f0(m.triples) },
              { label:"Trpl %",   get:(m)=>pct(m.triplePct) },
              { label:"Bulls",    get:(m)=>f0(m.bulls) },
              { label:"Bulls %",  get:(m)=>pct(m.bullPct) },
              { label:"DBull",    get:(m)=>f0(m.dbulls) },
              { label:"DBull %",  get:(m)=>pct(m.dbullPct) },
              ...(has.singles ? [{ label:"Singles (hits)", get:(m)=>f0(m.singles||0) }] : []),
              ...(has.misses  ? [{ label:"Misses (hits)",  get:(m)=>f0(m.misses ||0) }] : []),
            ]},
          ]}
          dataMap={M}
          tableStyle={tableStyle}
        />
      </CardTable>

      {/* ===== 6) RATES ===== */}
      <CardTable title="Rates (si tentatives connues ou fallback)">
        <TableColMajor
          columns={cols}
          rowGroups={[
            { rows: [
              { label:"Treble rate",  get:(m)=>pct(m.triplePct) },
              { label:"Double rate",  get:(m)=>pct(m.doublePct) },
              { label:"Bull rate",    get:(m)=>pct(m.bullPct) },
              { label:"DBull rate",   get:(m)=>pct(m.dbullPct) },
              { label:"Checkout rate",get:(m)=>pct(m.coPct) },
              { label:"Single rate",  get:(m)=>pct(m.singleRate) },
              { label:"Bust rate",    get:(m)=>pct(m.bustRate) },
            ]},
          ]}
          dataMap={M}
          tableStyle={tableStyle}
        />
      </CardTable>

      {/* ===== 7) CIBLE CIRCULAIRE POLAIRE ===== */}
      {chartMetrics ? (
        <Panel className="x-card">
          <h3 style={{ margin:"0 0 6px", fontSize:D.fsHead+1, letterSpacing:0.2, color:"#ffcf57" }}>
            Graphique cible circulaire
          </h3>
          <div className="selector" style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:8 }}>
            {players.map(p => (
              <button key={p.id}
                onClick={()=>setChartPid(p.id)}
                style={{
                  padding:"6px 10px", borderRadius:999,
                  border: p.id===chartPid ? "1px solid rgba(255,200,60,.6)" : "1px solid rgba(255,255,255,.18)",
                  background: p.id===chartPid ? "linear-gradient(180deg,#ffc63a,#ffaf00)" : "transparent",
                  color: p.id===chartPid ? "#141417" : "#e8e8ec", fontWeight:800, cursor:"pointer"
                }}>
                {p.name || "—"}
              </button>
            ))}
          </div>
          <TargetPolar m={chartMetrics} />
          <div style={{ marginTop:8, color:"#bbb", fontSize:12 }}>
            Chaque point = total pondéré sur le numéro (S×1, D×2, T×3 ; Bull×1, DBull×2 ; Miss=point séparé),
            normalisé sur le max de la manche. Les points sont reliés pour “former” la manche.
          </div>
        </Panel>
      ) : null}
    </Shell>
  );
}

/* ================================
   Fallback LEG -> summary-like
================================ */
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

/* ================================
   Metrics & extraction robuste
================================ */
type ByNumber = Record<string, { inner?: number; outer?: number; double?: number; triple?: number; miss?: number; bull?: number; dbull?: number }>;

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
  byNumber?: ByNumber; // NEW: pour la cible polaire
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
    byNumber: undefined,
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

    // ===== 1) summary (rapide)
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

    // ===== 2) perPlayer riche
    const r = per?.[pid] || {};
    const imp = r.impacts || {};
    m.first9        = v(r.first9Avg);
    m.highestNonCO  = v(r.highestNonCheckout);
    m.dartsToFinish = v(r.dartsToFinish);
    m.avgCoDarts    = v(r.avgCheckoutDarts);

    // bruts (hits)
    m.doubles = n(r.doubles, n(imp.doubles, m.doubles));
    m.triples = n(r.triples, n(imp.triples, m.triples));
    m.bulls   = n(r.bulls,   n(imp.bulls,   m.bulls));
    m.dbulls  = n(r.dbulls,  n(imp.dbulls,  m.dbulls));
    m.singles = (r.singles ?? imp.singles ?? m.singles) as any;
    m.misses  = (r.misses  ?? imp.misses  ?? m.misses ) as any;
    m.busts   = (r.busts   ?? imp.busts   ?? m.busts  ) as any;

    // checkout
    m.coHits = n(r.checkoutHits,     m.coHits);
    m.coAtt  = n(r.checkoutAttempts, m.coAtt);

    // volumes complémentaires
    m.visits     = m.visits || n(r.visits, 0);
    m.points     = m.points || n(r.pointsScored, 0);
    m.avg3       = m.avg3   || n(r.avg3, 0); 
    m.avg1       = m.avg1   || (m.avg3 ? m.avg3/3 : 0);
    m.bestVisit  = m.bestVisit || n(r.bestVisit, 0);
    m.bestCO     = m.bestCO    || sanitizeCO(r.bestCheckoutScore ?? r.highestCheckout ?? r.bestCheckout);

    // segments (agrégés)
    if (r.segments) {
      m.segOuter  = v(r.segments.outer);
      m.segInner  = v(r.segments.inner);
      m.segDouble = v(r.segments.double);
      m.segTriple = v(r.segments.triple);
      m.segMiss   = v(r.segments.miss);
    }

    // ---- NEW: byNumber (toutes variantes connues)
    const byNum =
      r.byNumber ||
      imp.byNumber ||
      r.target?.byNumber ||
      r.perNumber ||
      undefined;
    if (byNum && typeof byNum === "object") m.byNumber = byNum as any;

    // ===== 3) legacy (compat)
    m.t180 = m.t180 || n(pick(legacy, [`h180.${pid}`, `t180.${pid}`]), 0);
    m.t140 = m.t140 || n(pick(legacy, [`h140.${pid}`, `t140.${pid}`]), 0);
    m.t100 = m.t100 || n(pick(legacy, [`h100.${pid}`, `t100.${pid}`]), 0);
    m.t60  = m.t60  || n(pick(legacy, [`h60.${pid}`,  `t60.${pid}` ]),  0);

    m.darts  = m.darts  || n(pick(legacy, [`darts.${pid}`, `dartsThrown.${pid}`]), 0);
    m.visits = m.visits || n(pick(legacy, [`visits.${pid}`]), 0);
    m.points = m.points || n(pick(legacy, [`pointsScored.${pid}`, `points.${pid}`]), 0);
    m.avg3   = m.avg3   || n(pick(legacy, [`avg3.${pid}`, `avg3d.${pid}`]), 0);
    if (!m.avg1 && m.avg3) m.avg1 = m.avg3/3;
    m.bestVisit = m.bestVisit || n(pick(legacy, [`bestVisit.${pid}`]), 0);
    m.bestCO    = m.bestCO    || sanitizeCO(pick(legacy, [`bestCheckout.${pid}`, `highestCheckout.${pid}`, `bestCO.${pid}`]));

    const dblC = n(pick(legacy,[`doubles.${pid}`, `doubleCount.${pid}`, `dbl.${pid}`]), 0);
    const trpC = n(pick(legacy,[`triples.${pid}`, `tripleCount.${pid}`, `trp.${pid}`]), 0);
    const bulC = n(pick(legacy,[`bulls.${pid}`,   `bullCount.${pid}`,   `bull.${pid}`]), 0);
    const dbuC = n(pick(legacy,[`dbulls.${pid}`,  `doubleBull.${pid}`,  `doubleBulls.${pid}`, `bull50.${pid}`]), 0);
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

    m.coHits = m.coHits || n(pick(legacy, [`checkoutHits.${pid}`]), 0);
    m.coAtt  = m.coAtt  || n(pick(legacy, [`checkoutAttempts.${pid}`]), 0);

    // ===== 4) dérivés & ORDONNANCE : d'abord darts/visits, ensuite %
    if (!m.points && m.avg3 && m.darts) m.points = Math.round((m.avg3/3) * m.darts);
    if (!m.visits && m.darts)           m.visits = Math.ceil(m.darts / 3);

    // si darts encore à 0, tente un fallback minimal (hits connus)
    if (!m.darts) {
      const hitsKnown = n(m.singles,0)+n(m.doubles,0)+n(m.triples,0)+n(m.bulls,0)+n(m.dbulls,0)+n(m.misses,0);
      if (hitsKnown > 0) m.darts = hitsKnown;
    }

    const darts = Math.max(0, n(m.darts,0));

    // % basés prioritairement sur attempts → sinon fallback hits/darts
    const dblAtt = n(r.doubleAttempts ?? imp.doubleAttempts, 0);
    const trpAtt = n(r.tripleAttempts ?? imp.tripleAttempts, 0);
    const bulAtt = n(r.bullAttempts   ?? imp.bullAttempts,   0);
    const dbuAtt = n(r.dbullAttempts  ?? imp.dbullAttempts  ?? r.doubleBullAttempts ?? imp.doubleBullAttempts, 0);

    const dblHit = n(r.doubleHits     ?? imp.doubleHits,     m.doubles);
    const trpHit = n(r.tripleHits     ?? imp.tripleHits,     m.triples);
    const bulHit = n(r.bullHits       ?? imp.bullHits,       m.bulls);
    const dbuHit = n(r.dbullHits      ?? imp.dbullHits      ?? r.doubleBullHits     ?? imp.doubleBullHits, m.dbulls);

    m.doublePct = (dblAtt > 0) ? (dblHit / dblAtt) * 100 : (darts ? (n(m.doubles)/darts)*100 : undefined);
    m.triplePct = (trpAtt > 0) ? (trpHit / trpAtt) * 100 : (darts ? (n(m.triples)/darts)*100 : undefined);
    m.bullPct   = (bulAtt > 0) ? (bulHit / bulAtt) * 100 : (darts ? (n(m.bulls)/darts)*100   : undefined);
    m.dbullPct  = (dbuAtt > 0) ? (dbuHit / dbuAtt) * 100 : (darts ? (n(m.dbulls)/darts)*100  : undefined);

    // singles/busts (attempts → fallback)
    const sngAtt = n(r.singleAttempts ?? imp.singleAttempts, 0);
    const bstAtt = n(r.bustAttempts   ?? imp.bustAttempts,   0);
    const sngHit = n(r.singleHits     ?? imp.singleHits,     n(m.singles,0));
    const bstHit = n(r.bustHits       ?? imp.bustHits,       n(m.busts,0));
    m.singleRate = (sngAtt > 0) ? (sngHit / sngAtt) * 100 : (darts ? (n(m.singles)/darts)*100 : undefined);
    m.bustRate   = (bstAtt > 0) ? (bstHit / bstAtt) * 100 : (darts ? (n(m.busts)/darts)*100   : undefined);

    // CO%
    if (m.coAtt > 0) m.coPct = (m.coHits / m.coAtt) * 100;

    // ===== 5) données de cible (si segments manquent → fallback global)
    const singlesFallback = Math.max(0, darts - (n(m.doubles)+n(m.triples)+n(m.bulls)+n(m.dbulls)+n(m.misses)));
    if (m.singles == null) m.singles = singlesFallback;

    if (m.segOuter == null || m.segInner == null) {
      const sng = n(m.singles, 0);
      m.segOuter = n(m.segOuter, Math.round(sng*0.55));
      m.segInner = n(m.segInner, sng - n(m.segOuter,0));
    }
    if (m.segDouble == null) m.segDouble = n(m.doubles, 0);
    if (m.segTriple == null) m.segTriple = n(m.triples, 0);
    if (m.segMiss   == null) m.segMiss   = n(m.misses,  0);

    out[pid] = m;
  }
  return out;
}

/* ================================
   Détection colonnes optionnelles
================================ */
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

/* ================================
   UI de base
================================ */
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
function CardTable({ title, children }:{ title:string; children:React.ReactNode }) {
  return (
    <Panel className="x-card" style={{ padding: D.cardPad }}>
      <h3 style={{ margin:"0 0 6px", fontSize:D.fsHead+1, letterSpacing:0.2, color:"#ffcf57" }}>{title}</h3>
      {children}
    </Panel>
  );
}
function Notice({ children }:{children:React.ReactNode}) {
  return <Panel><div style={{ color:"#bbb" }}>{children}</div></Panel>;
}
function InfoCard({ children }:{children:React.ReactNode}) {
  return <Panel style={{ color:"#bbb" }}>{children}</Panel>;
}
function Trophy(props:any){
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} {...props}>
      <path fill="currentColor" d="M6 2h12v2h3a1 1 0 0 1 1 1v1a5 5 0 0 1-5 5h-1.1A6 6 0 0 1 13 13.9V16h3v2H8v-2h3v-2.1A6 6 0 0 1 8.1 11H7A5 5 0 0 1 2 6V5a1 1 0 0 1 1-1h3V2Z"/>
    </svg>
  );
}

/* ================================
   Table COL-MAJOR (lignes = stats)
================================ */
type Col = { key: string; title: string };
type RowDef = { label: string; get: (m: PlayerMetrics) => string | number };

function TableColMajor({
  columns, rowGroups, dataMap, tableStyle
}: {
  columns: Col[];
  rowGroups: { rows: RowDef[] }[];
  dataMap: Record<string, PlayerMetrics>;
  tableStyle?: React.CSSProperties;
}) {
  return (
    <div className="x-table" style={{ overflowX:"auto", border:"1px solid rgba(255,255,255,.08)", borderRadius:D.radius }}>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th className="x-th" style={thStyle(true)}>Stat</th>
            {columns.map((c) => (
              <th key={c.key} className="x-th" style={thStyle(false)}>
                <span style={{fontWeight:900, color:"#ffcf57"}}>{c.title}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rowGroups.flatMap((g, gi) =>
            g.rows.map((r, ri) => (
              <tr key={`r-${gi}-${ri}`}>
                <td className="x-td" style={tdStyle(true)}>{r.label}</td>
                {columns.map((c) => {
                  const m = dataMap[c.key] || emptyMetrics({ id:c.key });
                  return (
                    <td key={c.key} className="x-td" style={tdStyle(false)}>
                      {r.get(m)}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
function thStyle(isRowHeader:boolean):React.CSSProperties{
  return {
    textAlign: isRowHeader?"left":"right",
    padding:`${D.padCellV}px ${D.padCellH}px`,
    color:"#ffcf57", fontWeight:800, background:"rgba(255,255,255,.04)", position:"sticky", top:0,
    whiteSpace:"nowrap"
  };
}
function tdStyle(isRowHeader:boolean):React.CSSProperties{
  return {
    textAlign:isRowHeader?"left":"right",
    padding:`${D.padCellV}px ${D.padCellH}px`,
    color:"#e8e8ec", whiteSpace:"nowrap", fontVariantNumeric:"tabular-nums",
    borderTop:"1px solid rgba(255,255,255,.05)"
  };
}

/* ================================
   Cible polaire — pondérée S×1, D×2, T×3 (+ Bull/DBull), Miss séparé
================================ */
function TargetPolar({ m }: { m: PlayerMetrics }) {
  const size = 340;
  const cx = size/2, cy = size/2;
  const Rmax = 140; // rayon utile (bords)
  const labels = [20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5]; // ordre réel autour de la cible

  // Lecture byNumber si dispo
  const BY = (m.byNumber || {}) as ByNumber;

  // Pondération par numéro
  const weighted = (nu: number) => {
    const row = (BY[String(nu)] || BY[`n${nu}`] || {}) as any;
    const singles = n(row.inner) + n(row.outer);
    const dbl = n(row.double);
    const trp = n(row.triple);
    const bull = n(row.bull);
    const dbull = n(row.dbull);
    // S×1 + D×2 + T×3 + Bull×1 + DBull×2
    return singles*1 + dbl*2 + trp*3 + bull*1 + dbull*2;
  };

  const counts: number[] = labels.map(weighted);

  // Miss & centre
  const missCount  = n((BY as any)?.miss, n(m.segMiss, n(m.misses)));
  const bullSum    = n((BY as any)?.bull, n(m.bulls));
  const dbullSum   = n((BY as any)?.dbull, n(m.dbulls));

  // Échelle — max sur l’ensemble
  const maxVal = Math.max(1, ...counts, missCount, bullSum + 2*dbullSum);
  const scale = (v:number)=> (v / maxVal) * Rmax;

  // Points polaires (theta en radians, 0° vers le haut, sens horaire)
  const toXY = (r:number, thetaDeg:number) => {
    const a = (thetaDeg - 90) * Math.PI/180; // démarrage en haut
    return { x: cx + r*Math.cos(a), y: cy + r*Math.sin(a) };
  };

  // positions des 20 numéros
  const step = 360/labels.length;
  const points = counts.map((v, i) => {
    const r = scale(v);
    const pos = toXY(r, i*step);
    return { ...pos, r, i, v };
  });

  // polyligne (connecte les 20 numéros)
  const poly = points.map(p => `${p.x},${p.y}`).join(" ");

  // Lignes et labels périphériques
  const rim = labels.map((nu, i) => {
    const posTick = toXY(Rmax, i*step);
    const posLab  = toXY(Rmax+16, i*step);
    return (
      <g key={`lab-${nu}`}>
        <circle cx={posTick.x} cy={posTick.y} r={2} fill="rgba(255,255,255,.35)" />
        <text x={posLab.x} y={posLab.y}
          fontSize="11" textAnchor="middle" alignmentBaseline="middle"
          fill="#e8e8ec" style={{fontWeight:800}}>
          {nu}
        </text>
      </g>
    );
  });

  // points visuels sur les numéros
  const hitDots = points.map((p, idx) => (
    <g key={`dot-${idx}`}>
      <circle cx={p.x} cy={p.y} r={3.5} fill="#ffcf57" />
    </g>
  ));

  // bull / dbull au centre (rayons distincts)
  const rb = Math.max(4, scale(bullSum*1));   // Bull×1
  const rdb = Math.max(2, scale(dbullSum*2)); // DBull×2
  const missPos = toXY(scale(missCount), 300); // Miss vers le bas

  return (
    <div style={{ display:"flex", justifyContent:"center" }}>
      <svg width="100%" height={size} viewBox={`0 0 ${size} ${size}`} style={{ maxWidth: 480 }}>
        {/* fond */}
        <defs>
          <radialGradient id="bg" cx="50%" cy="40%">
            <stop offset="0%" stopColor="#2a2a30"/>
            <stop offset="100%" stopColor="#16161a"/>
          </radialGradient>
        </defs>
        <rect x="0" y="0" width={size} height={size} fill="url(#bg)" rx={16} />

        {/* cercles guides */}
        {[0.25,0.5,0.75,1].map((t,i)=>(
          <circle key={i} cx={cx} cy={cy} r={Rmax*t} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth={1}/>
        ))}

        {/* repères & labels numéros */}
        {rim}

        {/* polyligne & points */}
        <polyline points={poly} fill="rgba(255,207,87,.12)" stroke="#ffcf57" strokeWidth={2} />
        {hitDots}

        {/* Bull / DBull */}
        <circle cx={cx} cy={cy} r={rb} fill="rgba(255,255,255,.2)" stroke="rgba(255,255,255,.35)" strokeWidth={1}/>
        <circle cx={cx} cy={cy} r={rdb} fill="#ffcf57" />
        <text x={cx} y={cy-8} textAnchor="middle" fontSize="11" fill="#e8e8ec" style={{fontWeight:700}}>Bull {bullSum}</text>
        <text x={cx} y={cy+10} textAnchor="middle" fontSize="11" fill="#ffcf57" style={{fontWeight:900}}>DBull {dbullSum}</text>

        {/* Miss */}
        <circle cx={missPos.x} cy={missPos.y} r={3.5} fill="#ffcf57" />
        <text x={toXY(Rmax+24,300).x} y={toXY(Rmax+24,300).y} textAnchor="middle" fontSize="11" fill="#e8e8ec" style={{fontWeight:800}}>
          Miss {missCount}
        </text>
      </svg>
    </div>
  );
}

/* ================================
   Utils
================================ */
function normalizeStatus(rec:any):"finished"|"in_progress"{
  const raw = String(rec?.status ?? rec?.payload?.status ?? "").toLowerCase();
  if (raw === "finished") return "finished";
  if (raw === "inprogress" || raw === "in_progress") return "in_progress";
  const sum = rec?.summary ?? rec?.payload ?? {};
  if (sum?.finished === true || sum?.result?.finished === true) return "finished";
  return "in_progress";
}
function sanitizeCO(v:any):number{ const num = Number(v); if(!Number.isFinite(num)) return 0; const r = Math.round(num); if (r===50) return 50; if (r>=2 && r<=170) return r; return 0; }
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
