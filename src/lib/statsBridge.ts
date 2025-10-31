// ============================================
// src/lib/statsBridge.ts — Pont History ⇄ Stats
// - commitLegStatsOnce: enregistre LegStats pour un match donné (id)
// - getMatchStats: agrège toutes les manches d'un match
// - getBasicProfileStats: stats basiques globales d'un profil (tous matchs)
// - selectors utilitaires pour UI (Accueil / Profils / Overlay / StatsHub)
// ============================================
import { computeLegStats, aggregateMatch, type LegStats, type PlayerId, type MatchStats } from "./stats";

// ---- Adapteurs "faibles" vers ta couche History ----
// On suppose ces fonctions disponibles dans ton projet.
// Ajuste les imports si besoin.
import { History } from "./history";

// Structure minimale stockée côté History (ex.: par matchId)
type SavedLeg = LegStats & { matchId: string };

export async function commitLegStatsOnce(opts: {
  matchId: string;
  startScore: number;
  players: PlayerId[];
  visits: any[];           // tes volées moteur X01 (adaptées au type Visit dans stats.ts)
  legNo: number;
  finishedAt?: number;
  winnerId?: PlayerId | null;
}) {
  const leg = computeLegStats({
    startScore: opts.startScore,
    players: opts.players,
    visits: opts.visits as any, // déjà au format attendu par stats.ts
    legNo: opts.legNo,
    finishedAt: opts.finishedAt ?? Date.now(),
    winnerId: opts.winnerId ?? null,
  });

  const saved: SavedLeg = { matchId: opts.matchId, ...leg };

  // Persistance: on ajoute la manche dans l'historique du match
  await History.upsert(opts.matchId, (prev: any) => {
    const legs: SavedLeg[] = Array.isArray(prev?.legs) ? prev.legs : [];
    // éviter doublons de legNo sur ce match
    const filtered = legs.filter((l) => l.legNo !== saved.legNo);
    return {
      ...prev,
      kind: "x01",
      status: (leg.winnerId ? "finished_or_inprogress" : "in_progress") as any,
      players: opts.players.map((id) => ({ id })), // léger
      updatedAt: Date.now(),
      legs: [...filtered, saved].sort((a, b) => a.legNo - b.legNo),
    };
  });

  return leg;
}

export async function getMatchStats(matchId: string): Promise<MatchStats | null> {
  const rec = await History.get(matchId).catch(() => null);
  if (!rec || !Array.isArray(rec.legs) || rec.legs.length === 0) return null;

  const legs = (rec.legs as SavedLeg[]).map((l) => {
    // enlève matchId pour matcher le type LegStats
    const { matchId: _m, ...rest } = l;
    return rest as LegStats;
  });

  const players: PlayerId[] =
    rec.players?.map((p: any) => p.id) ??
    Array.from(new Set(legs.flatMap((l) => l.players)));

  return aggregateMatch(legs, players);
}

// ---- Stats basiques d’un profil (tous matchs) ----
export type BasicProfileStats = {
  matches: number;
  legsPlayed: number;
  legsWon: number;
  avg3: number;        // moyenne / volée
  bestVisit: number;
  bins180: number;
  pctDB: number;
  pctTP: number;
  pctBull: number;
  pctDBull: number;
  highestCO: number;
};

export async function getBasicProfileStats(profileId: string): Promise<BasicProfileStats> {
  const all = await History.getAll(); // [{id, ...record}]
  let matches = 0;
  let legsPlayed = 0;
  let legsWon = 0;

  // cumuls
  let totalScored = 0;
  let visits = 0;
  let bestVisit = 0;
  let bins180 = 0;

  let dblAtt = 0, dblHit = 0;
  let triAtt = 0, triHit = 0;
  let bullAtt = 0, bullHit = 0;
  let dbuAtt = 0, dbuHit = 0;
  let highestCO = 0;

  for (const rec of all) {
    if (rec?.kind !== "x01") continue;
    const legs: SavedLeg[] = Array.isArray(rec.legs) ? rec.legs : [];
    if (!legs.length) continue;

    const players: PlayerId[] =
      rec.players?.map((p: any) => p.id) ??
      Array.from(new Set(legs.flatMap((l) => l.players)));
    if (!players.includes(profileId)) continue;

    matches += 1;

    const agg = aggregateMatch(
      legs.map((l) => {
        const { matchId: _m, ...rest } = l;
        return rest as LegStats;
      }),
      players
    );

    const me = agg.aggregates[profileId];
    if (!me) continue;

    legsPlayed += me.legsPlayed;
    legsWon += me.legsWon;

    totalScored += me.totalScored;
    visits += me.visits;
    bestVisit = Math.max(bestVisit, me.bestVisit);
    bins180 += me.bins["180"];

    dblAtt += me.rates.dblAttempts; dblHit += me.rates.dblHits;
    triAtt += me.rates.triAttempts; triHit += me.rates.triHits;
    bullAtt += me.rates.bullAttempts; bullHit += me.rates.bullHits;
    dbuAtt += me.rates.dbullAttempts; dbuHit += me.rates.dbullHits;

    highestCO = Math.max(highestCO, me.co.highestCO);
  }

  const avg3 = visits > 0 ? Math.round((totalScored / visits) * 100) / 100 : 0;
  const pct = (h: number, a: number) => (a > 0 ? Math.round((h * 1000) / a) / 10 : 0);

  return {
    matches,
    legsPlayed,
    legsWon,
    avg3,
    bestVisit,
    bins180,
    pctDB: pct(dblHit, dblAtt),
    pctTP: pct(triHit, triAtt),
    pctBull: pct(bullHit, bullAtt),
    pctDBull: pct(dbuHit, dbuAtt),
    highestCO,
  };
}

// ---- Sélecteurs UI communs ----
export const StatsSelectors = {
  // pour l’overlay “classement” d’une manche
  legToLeaderboard(leg: LegStats) {
    return leg.order;
  },
  legRow(leg: LegStats, playerId: PlayerId) {
    const s = leg.perPlayer[playerId];
    return {
      avg3: s.avgPerVisit,
      first9: s.first9Avg,
      best: s.bestVisit,
      bins60: s.bins["60+"],
      bins100: s.bins["100+"],
      bins140: s.bins["140+"],
      bins180: s.bins["180"],
      pctDB: s.rates.pctDB,
      pctTP: s.rates.pctTP,
      pctBull: s.rates.pctBull,
      pctDBull: s.rates.pctDBull,
      CO: s.co.coHits,
      pctCO: s.co.pctCO,
      dartsCO: s.co.avgCODarts,
      highestCO: s.co.highestCO,
    };
  },
};
