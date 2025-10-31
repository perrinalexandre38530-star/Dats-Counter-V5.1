// ============================================
// src/lib/stats.ts — Socle de statistiques
// - Exports robustes et stables pour éviter les crashs
// - Stats basiques par profil à partir de l'historique
// - Stubs safe pour computeLegStats / aggregateMatch (compat X01Play)
// ============================================

/* ---------- Types publics ---------- */
export type BasicProfileStats = {
  games: number;        // parties jouées (tous jeux confondus)
  legs: number;         // manches enregistrées
  wins: number;         // victoires (quand winnerId === profileId)
  avg3d: number;        // moyenne par 3 darts (approx via points/darts)
  bestVisit: number;    // meilleure volée (0..180)
  h60: number;          // 60+
  h100: number;         // 100+
  h140: number;         // 140+
  h180: number;         // 180
  updatedAt: number;    // timestamp de calcul
};

export type Visit = {
  playerId: string;
  visitNo: number;
  score: number;          // points marqués sur la volée (0 si bust)
  segments: null | any;   // compat future si tu renseignes les segments
  bust: boolean;
  isCheckout: boolean;
  dartsUsed?: number;     // 1..3 quand checkout, sinon 3
  remainingAfter: number;
};

export type LegInput = {
  startScore: number;
  players: string[];     // ids des joueurs
  visits: Visit[];       // journal des volées triées par visitNo
  finishedAt: number;
  legNo: number;
  winnerId: string | null;
};

export type LegStats = {
  legNo: number;
  players: string[];
  winnerId: string | null;
  finishedAt: number;

  perPlayer: Record<string, {
    darts: number;
    points: number;
    visits: number;
    avg3d: number;
    bestVisit: number;
    h60: number;
    h100: number;
    h140: number;
    h180: number;
  }>;
};

/* ---------- Helpers locaux ---------- */
function now() { return Date.now(); }
function safeNumber(n: any, d = 0) { return Number.isFinite(n) ? Number(n) : d; }

/* ---------- Accès HISTORIQUE (tolérant) ---------- */
type AnyRecord = any;

// On ne connaît pas exactement l'API de History dans ton projet.
// On essaye plusieurs signatures connues : list(), all(), getAll(), entries(), etc.
async function loadAllHistory(): Promise<AnyRecord[]> {
  try {
    // @ts-ignore
    const { History } = await import("./history");
    const cands: any[] = [];

    // tentatives sync
    if (Array.isArray(History?.list)) cands.push(History.list);
    if (Array.isArray(History?.all)) cands.push(History.all);
    if (typeof History?.list === "function") {
      const r = History.list();
      if (Array.isArray(r)) return r;
      if (r && typeof r.then === "function") return await r;
    }
    if (typeof History?.all === "function") {
      const r = History.all();
      if (Array.isArray(r)) return r;
      if (r && typeof r.then === "function") return await r;
    }
    if (typeof History?.getAll === "function") {
      const r = History.getAll();
      if (Array.isArray(r)) return r;
      if (r && typeof r.then === "function") return await r;
    }
    if (typeof History?.entries === "function") {
      const r = History.entries();
      if (Array.isArray(r)) return r;
      if (r && typeof r.then === "function") return await r;
    }

    // fallback : clé IndexedDB/LS si ton History la publie
    if (Array.isArray((History as any)?._cache)) return (History as any)._cache;

    return [];
  } catch {
    return [];
  }
}

/* ---------- Agrégateur basique par PROFIL ---------- */
export async function getBasicProfileStats(profileId: string): Promise<BasicProfileStats> {
  const recs = await loadAllHistory();

  // On parcourt toutes les entrées sauvegardées (parties finies ou manches)
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

      // Heuristique "une entrée = une partie" si c'est un match
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
        // Ancien format… on tente des champs "classiques"
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
    } catch {
      // on ignore les entrées foireuses
    }
  }

  const avg3d = totalDarts > 0 ? +( (totalPoints / totalDarts) * 3 ).toFixed(2) : 0;

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
   (stubs sûrs qui donnent déjà des chiffres corrects)
   ================================================= */
export function computeLegStats(input: LegInput): LegStats {
  const perPlayer: LegStats["perPlayer"] = {};
  const byPlayer: Record<string, Visit[]> = {};
  for (const v of input.visits) {
    (byPlayer[v.playerId] ||= []).push(v);
  }
  for (const pid of input.players) {
    const arr = (byPlayer[pid] || []).sort((a,b)=>a.visitNo-b.visitNo);
    let darts = 0, points = 0, visits = 0, bestVisit = 0;
    let h60 = 0, h100 = 0, h140 = 0, h180 = 0;

    for (const v of arr) {
      visits += 1;
      const used = v.dartsUsed ?? 3;
      darts += used;
      points += v.score;
      if (v.score > bestVisit) bestVisit = v.score;
      if (v.score >= 60) h60 += 1;
      if (v.score >= 100) h100 += 1;
      if (v.score >= 140) h140 += 1;
      if (v.score === 180) h180 += 1;
    }
    const avg3d = darts > 0 ? +( (points / darts) * 3 ).toFixed(2) : 0;
    perPlayer[pid] = { darts, points, visits, avg3d, bestVisit, h60, h100, h140, h180 };
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
      darts: 0, points: 0, visits: 0, bestVisit: 0, h60: 0, h100: 0, h140: 0, h180: 0, avg3d: 0,
    };
  }
  for (const L of legs) {
    for (const pid of players) {
      const s = L.perPlayer[pid];
      if (!s) continue;
      const t = agg.perPlayer[pid];
      t.darts += s.darts;
      t.points += s.points;
      t.visits += s.visits;
      t.bestVisit = Math.max(t.bestVisit, s.bestVisit);
      t.h60 += s.h60; t.h100 += s.h100; t.h140 += s.h140; t.h180 += s.h180;
    }
  }
  for (const pid of players) {
    const t = agg.perPlayer[pid];
    t.avg3d = t.darts > 0 ? +( (t.points / t.darts) * 3 ).toFixed(2) : 0;
  }
  return agg;
}

/* ---------- Petits alias de compat éventuelle ---------- */
export const StatsSelectors = {}; // pour éviter un import cassant si présent ailleurs
export async function saveMatchStats(_rec:any){ /* no-op pour compat si importé */ }
