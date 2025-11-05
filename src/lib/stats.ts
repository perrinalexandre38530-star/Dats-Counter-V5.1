// ============================================
// src/lib/stats.ts — Socle de statistiques
// - Exports robustes et stables pour éviter les crashs
// - Stats basiques par profil à partir de l'historique
// - computeLegStats/aggregateMatch compatibles X01Play + playerStats
// ============================================

/* ---------- Types publics ---------- */
export type BasicProfileStats = {
  games: number;        // parties jouées (tous jeux confondus)
  legs: number;         // manches enregistrées
  wins: number;         // victoires (winnerId === profileId)
  avg3d: number;        // moyenne par 3 darts (approx via points/darts)
  bestVisit: number;    // meilleure volée (0..180)
  h60: number;          // 60+
  h100: number;         // 100+
  h140: number;         // 140+
  h180: number;         // 180
  updatedAt: number;    // timestamp de calcul
};

export type VisitSegment = { v: number; mult: 1 | 2 | 3 }; // optionnel
export type Visit = {
  playerId: string;
  visitNo: number;
  score: number;            // points marqués sur la volée (0 si bust)
  segments: null | VisitSegment[]; // optionnel ; si null, impacts=0
  bust: boolean;
  isCheckout: boolean;
  dartsUsed?: number;       // 1..3 quand checkout, sinon 3
  remainingAfter: number;   // reste APRÈS la volée
};

export type LegInput = {
  startScore: number;
  players: string[];     // ids des joueurs
  visits: Visit[];       // journal des volées triées par visitNo (global)
  finishedAt: number;
  legNo: number;
  winnerId: string | null;
};

export type PerPlayerLegStats = {
  // Volumes
  darts: number;
  points: number;
  visits: number;
  avg3d: number;          // moyenne /3 darts
  avg1d?: number;         // moyenne /1 dart (dérivé)
  bestVisit: number;

  // Power scoring
  h60: number;
  h100: number;
  h140: number;
  h180: number;
  tonsTotal?: number;     // h100 + h140 + h180

  // Impacts (si segments fournis)
  doubles?: number;
  triples?: number;
  bulls?: number;         // simples bulls (25)
  bullsEye?: number;      // double bull (50)
  doubleRate?: number;    // % sur lancers (0..100)
  tripleRate?: number;
  bullRate?: number;
  bullEyeRate?: number;

  // Checkouts
  bestCheckout?: number;  // reste AVANT la volée qui termine (max)
  coHits?: number;        // nb de checkouts réussis
  coAtt?: number;         // nb d’opportunités (heuristique)
  coPct?: number;         // % hits/att

  // Nouveaux champs/alias pour compat
  avg3: number;                 // alias de avg3d
  dartsThrown: number;          // alias de darts
  buckets?: Record<string, number>; // "0-59","60-99","100+","140+","180"
};

export type LegStats = {
  legNo: number;
  players: string[];
  winnerId: string | null;
  finishedAt: number;
  perPlayer: Record<string, PerPlayerLegStats>;
};

/* ---------- Helpers locaux ---------- */
function now() { return Date.now(); }
function safeNumber(n: any, d = 0) { const v = Number(n); return Number.isFinite(v) ? v : d; }
function pct(n: number, d: number) { return d > 0 ? +( (n * 100) / d ).toFixed(2) : 0; }

/* ---------- Accès HISTORIQUE (tolérant) ---------- */
type AnyRecord = any;

async function loadAllHistory(): Promise<AnyRecord[]> {
  try {
    // @ts-ignore
    const { History } = await import("./history");

    if (typeof History?.list === "function") {
      const r = History.list();
      return Array.isArray(r) ? r : await r;
    }
    if (typeof History?.all === "function") {
      const r = History.all();
      return Array.isArray(r) ? r : await r;
    }
    if (typeof History?.getAll === "function") {
      const r = History.getAll();
      return Array.isArray(r) ? r : await r;
    }
    if (typeof History?.entries === "function") {
      const r = History.entries();
      return Array.isArray(r) ? r : await r;
    }

    if (Array.isArray((History as any)?._cache)) return (History as any)._cache;
    return [];
  } catch {
    return [];
  }
}

/* ---------- Agrégateur basique par PROFIL ---------- */
export async function getBasicProfileStats(profileId: string): Promise<BasicProfileStats> {
  const recs = await loadAllHistory();

  let games = 0, legs = 0, wins = 0;
  let totalPoints = 0, totalDarts = 0, bestVisit = 0;
  let h60 = 0, h100 = 0, h140 = 0, h180 = 0;

  for (const r of recs) {
    try {
      const kind = r?.kind ?? r?.payload?.kind ?? "";
      const status = r?.status ?? r?.payload?.status ?? "";
      const players: string[] =
        r?.players?.map((p: any) => p?.id || p) ??
        r?.payload?.players?.map((p: any) => p?.id || p) ??
        r?.payload?.state?.players?.map((p: any) => p?.id || p) ??
        [];

      if (!players.includes(profileId)) continue;

      // Partie finie (match)
      const finished =
        status === "finished" ||
        r?.payload?.status === "finished" ||
        (r?.winnerId ?? r?.payload?.winnerId);

      if (finished && (kind === "x01" || kind === "cricket" || kind === "match" || r?.winnerId)) {
        games += 1;
        if ((r?.winnerId ?? r?.payload?.winnerId) === profileId) wins += 1;
      }

      // Données de manche (plus précises)
      const leg = r?.payload?.leg ?? r?.payload; // autoriser payload direct type LegStats
      const perPlayer = leg?.perPlayer;
      if (perPlayer && typeof perPlayer === "object") {
        legs += 1;
        const me = perPlayer[profileId];
        if (me) {
          totalPoints += safeNumber(me.points);
          totalDarts += safeNumber(me.darts);
          bestVisit = Math.max(bestVisit, safeNumber(me.bestVisit));
          h60 += safeNumber(me.h60);
          h100 += safeNumber(me.h100);
          h140 += safeNumber(me.h140);
          h180 += safeNumber(me.h180);
        }
      } else {
        // Ancien format
        const dartsMap = r?.darts ?? r?.payload?.darts;
        const visitsMap = r?.visits ?? r?.payload?.visits;
        const bestVisitMap = r?.bestVisit ?? r?.payload?.bestVisit;
        const h60Map = r?.h60 ?? r?.payload?.h60;
        const h100Map = r?.h100 ?? r?.payload?.h100;
        const h140Map = r?.h140 ?? r?.payload?.h140;
        const h180Map = r?.h180 ?? r?.payload?.h180;

        if (dartsMap || visitsMap || bestVisitMap) {
          legs += 1;
          const d = safeNumber(dartsMap?.[profileId]);
          const v = safeNumber(visitsMap?.[profileId]);
          const a3 = safeNumber(r?.avg3?.[profileId] ?? r?.payload?.avg3?.[profileId]);
          const pts = a3 * (v || (d ? Math.ceil(d / 3) : 0));

          totalDarts += d;
          totalPoints += pts;
          bestVisit = Math.max(bestVisit, safeNumber(bestVisitMap?.[profileId]));
          h60  += safeNumber(h60Map?.[profileId]);
          h100 += safeNumber(h100Map?.[profileId]);
          h140 += safeNumber(h140Map?.[profileId]);
          h180 += safeNumber(h180Map?.[profileId]);
        }
      }
    } catch { /* ignore */ }
  }

  const avg3d = totalDarts > 0 ? +(((totalPoints / totalDarts) * 3).toFixed(2)) : 0;

  return {
    games, legs, wins,
    avg3d, bestVisit,
    h60, h100, h140, h180,
    updatedAt: now(),
  };
}

/* ---------- Utilitaire multi-profils ---------- */
export async function getBasicStatsForProfiles(ids: string[]) {
  const out: Record<string, BasicProfileStats> = {};
  await Promise.all(ids.map(async (id) => { out[id] = await getBasicProfileStats(id); }));
  return out;
}

/* =================================================
   Compat X01Play : computeLegStats / aggregateMatch
   ================================================= */
export function computeLegStats(input: LegInput): LegStats {
  const perPlayer: Record<string, PerPlayerLegStats> = {};
  const byPlayer: Record<string, Visit[]> = {};
  for (const v of input.visits) (byPlayer[v.playerId] ||= []).push(v);

  for (const pid of input.players) {
    const arr = (byPlayer[pid] || []).sort((a,b)=>a.visitNo-b.visitNo);

    // Volumes
    let darts = 0, points = 0, visits = 0, bestVisit = 0;

    // Power scoring
    let h60 = 0, h100 = 0, h140 = 0, h180 = 0;

    // Impacts
    let doubles = 0, triples = 0, bulls = 0, bullsEye = 0;

    // Checkouts
    let bestCheckout = 0;
    let coHits = 0, coAtt = 0;

    // Pour checkout & heuristiques : "reste AVANT volée" (on part du startScore)
    let prevRemaining = input.startScore;

    for (const v of arr) {
      visits += 1;
      const used = v.dartsUsed ?? 3;
      darts += used;
      points += v.score;

      // Power-scoring (par volée)
      if (v.score > bestVisit) bestVisit = v.score;
      if (v.score >= 60) h60 += 1;
      if (v.score >= 100) h100 += 1;
      if (v.score >= 140) h140 += 1;
      if (v.score === 180) h180 += 1;

      // Impacts (si segments fournis)
      if (Array.isArray(v.segments)) {
        for (const s of v.segments) {
          if (s.v === 25) {
            if (s.mult === 2) bullsEye += 1;
            else bulls += 1;
          } else {
            if (s.mult === 3) triples += 1;
            else if (s.mult === 2) doubles += 1;
          }
        }
      }

      // Heuristique Checkouts :
      // - Tentative : si le reste AVANT la volée <= 170 (borne classique des routes)
      // - Réussite : isCheckout === true
      if (prevRemaining <= 170) coAtt += 1;
      if (v.isCheckout) {
        coHits += 1;
        bestCheckout = Math.max(bestCheckout, prevRemaining);
      }

      // maj du "reste avant volée" pour la prochaine
      prevRemaining = v.remainingAfter;
    }

    const avg3d = darts > 0 ? +(((points / darts) * 3).toFixed(2)) : 0;
    const avg1d = darts > 0 ? +( (points / darts).toFixed(2) ) : 0;

    // Buckets pour histogramme (par visites)
    const buckets: Record<string, number> = {};
    const sixtyTo99 = Math.max(0, h60 - h100);            // >=60 mais <100
    const hundredPlus = Math.max(0, h100 - h140 - h180);  // >=100 mais <140 (hors 140+ et 180)
    const oneFortyPlus = h140;                            // 140+
    const oneEighty = h180;                               // 180
    const known = sixtyTo99 + hundredPlus + oneFortyPlus + oneEighty;
    const zeroTo59 = Math.max(0, visits - known);

    buckets["0-59"]  = zeroTo59;
    buckets["60-99"] = sixtyTo99;
    buckets["100+"]  = hundredPlus;
    buckets["140+"]  = oneFortyPlus;
    buckets["180"]   = oneEighty;

    const tonsTotal = h100 + h140 + h180;
    const coPct = pct(coHits, coAtt);

    perPlayer[pid] = {
      // volumes
      darts,
      points,
      visits,
      avg3d,
      avg1d,
      bestVisit,

      // power scoring
      h60, h100, h140, h180,
      tonsTotal,

      // impacts
      doubles, triples, bulls, bullsEye,
      doubleRate: pct(doubles, darts),
      tripleRate: pct(triples, darts),
      bullRate: pct(bulls, darts),
      bullEyeRate: pct(bullsEye, darts),

      // checkouts
      bestCheckout: bestCheckout || undefined,
      coHits,
      coAtt,
      coPct,

      // alias/compléments attendus ailleurs
      avg3: avg3d,
      dartsThrown: darts,
      buckets,
    };
  }

  return {
    legNo: input.legNo,
    players: input.players,
    winnerId: input.winnerId ?? null,
    finishedAt: input.finishedAt,
    perPlayer,
  };
}

export function aggregateMatch(legs: LegStats[], players: string[]) {
  const agg: any = { perPlayer: {}, legs: legs.length };
  for (const pid of players) {
    agg.perPlayer[pid] = {
      // volumes
      darts: 0, points: 0, visits: 0,
      avg3d: 0, avg3: 0, avg1d: 0,
      dartsThrown: 0,
      bestVisit: 0, bestCheckout: 0,

      // power scoring
      h60: 0, h100: 0, h140: 0, h180: 0, tonsTotal: 0,

      // impacts
      doubles: 0, triples: 0, bulls: 0, bullsEye: 0,
      doubleRate: 0, tripleRate: 0, bullRate: 0, bullEyeRate: 0,

      // checkouts
      coHits: 0, coAtt: 0, coPct: 0,

      // buckets
      buckets: {} as Record<string, number>,
    };
  }

  for (const L of legs) {
    for (const pid of players) {
      const s = L.perPlayer[pid];
      if (!s) continue;
      const t = agg.perPlayer[pid];

      // volumes
      t.darts += s.darts;
      t.points += s.points;
      t.visits += s.visits;
      t.bestVisit = Math.max(t.bestVisit, s.bestVisit);
      t.bestCheckout = Math.max(t.bestCheckout || 0, s.bestCheckout || 0);

      // power scoring
      t.h60 += s.h60; t.h100 += s.h100; t.h140 += s.h140; t.h180 += s.h180;
      t.tonsTotal += (s.tonsTotal || (s.h100 + s.h140 + s.h180));

      // impacts
      t.doubles += s.doubles || 0;
      t.triples += s.triples || 0;
      t.bulls += s.bulls || 0;
      t.bullsEye += s.bullsEye || 0;

      // checkouts
      t.coHits += s.coHits || 0;
      t.coAtt += s.coAtt || 0;

      // buckets merge
      if (s.buckets) {
        for (const k of Object.keys(s.buckets)) {
          t.buckets[k] = (t.buckets[k] || 0) + safeNumber(s.buckets[k]);
        }
      }
    }
  }

  // dérivés finaux
  for (const pid of players) {
    const t = agg.perPlayer[pid];
    t.avg3d = t.darts > 0 ? +(((t.points / t.darts) * 3).toFixed(2)) : 0;
    t.avg3 = t.avg3d;
    t.avg1d = t.darts > 0 ? +( (t.points / t.darts).toFixed(2) ) : 0;
    t.dartsThrown = t.darts;

    t.doubleRate = pct(t.doubles, t.darts);
    t.tripleRate = pct(t.triples, t.darts);
    t.bullRate = pct(t.bulls, t.darts);
    t.bullEyeRate = pct(t.bullsEye, t.darts);

    t.coPct = pct(t.coHits, t.coAtt);
  }
  return agg;
}

/* ---------- Petits alias de compat éventuelle ---------- */
export const StatsSelectors = {}; // pour éviter un import cassant si présent ailleurs
export async function saveMatchStats(_rec:any){ /* no-op pour compat si importé */ }
