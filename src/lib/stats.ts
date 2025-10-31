// ============================================
// src/lib/stats.ts — Calculs de statistiques X01 (pure functions)
// Inspiré des métriques standard des apps de darts (X01)
// - Accepte des volées avec ou sans segments détaillés
// - Retourne des stats par joueur, par manche (leg) et agrégées match
// - Classement déterministe (ordre identique TTS/affichage)
// ============================================

import { History } from "./history";

/* -------------------- Types -------------------- */

export type PlayerId = string;

export type Segment =
  | { mult: 1 | 2 | 3; bed: number; score: number } // bed 1..20
  | { mult: 1 | 2; bed: "Bull" | "DBull"; score: number }; // 25 / 50

export type Visit = {
  playerId: PlayerId;
  visitNo: number;            // 1..N (ordre des volées dans la manche)
  score?: number;             // total retiré à la volée (si pas de segments)
  segments?: Segment[] | null;// détails par flèche (si dispo)
  bust?: boolean;             // volée bust
  isCheckout?: boolean;       // cette volée termine la manche
  dartsUsed?: number;         // 1..3 si checkout avant 3 flèches
  remainingAfter: number;     // reste après la volée
};

export type LegInput = {
  startScore: number;         // 501, 301, etc.
  players: PlayerId[];
  visits: Visit[];            // toutes les volées de la manche (ordre réel)
  finishedAt?: number;        // timestamp
  legNo?: number;
  winnerId?: PlayerId | null; // optionnel: si déjà connu par le moteur
};

export type Bins = {
  "60+": number;
  "100+": number;
  "140+": number;
  "180": number;
};

export type Rates = {
  dblAttempts: number;
  dblHits: number;
  pctDB: number;

  triAttempts: number;
  triHits: number;
  pctTP: number;

  bullAttempts: number;
  bullHits: number;    // Bull (25)
  pctBull: number;

  dbullAttempts: number;
  dbullHits: number;   // DBull (50)
  pctDBull: number;
};

export type CheckoutStats = {
  coAttempts: number;     // occasions de checkout (<=170 restant)
  coHits: number;         // checkouts réussis
  pctCO: number;          // %
  highestCO: number;      // plus haut checkout
  totalCODarts: number;   // somme des flèches utilisées pour les CO réussis
  avgCODarts: number;     // "Darts CO" (moyenne)
};

export type PerPlayerLegStats = {
  playerId: PlayerId;

  // Volumétrie
  visits: number;
  darts: number;

  // Scores
  totalScored: number;  // somme des points retirés (sans bust)
  bestVisit: number;    // meilleur score d'une volée
  bins: Bins;

  // Moyennes
  avgPerDart: number;   // moyenne par flèche
  avgPerVisit: number;  // "Moy/3"
  first9Avg: number;    // moyenne sur les 3 premières volées (jusqu’à bust/finish)

  // Réussites par type
  rates: Rates;

  // Checkout
  co: CheckoutStats;

  // Fin de manche
  finished: boolean;
  dartsToFinish?: number; // nb de flèches utilisées dans la manche (si gagnant)
};

export type LegStats = {
  legNo: number;
  startScore: number;
  players: PlayerId[];
  finishedAt: number | null;
  winnerId: PlayerId | null;
  order: PlayerId[];               // classement final
  perPlayer: Record<PlayerId, PerPlayerLegStats>;
};

export type MatchStats = {
  legs: LegStats[];
  players: PlayerId[];
  aggregates: Record<PlayerId, PerPlayerMatchAgg>;
};

export type PerPlayerMatchAgg = {
  playerId: PlayerId;
  legsPlayed: number;
  legsWon: number;

  darts: number;
  visits: number;
  totalScored: number;

  avgPerDart: number;
  avgPerVisit: number;

  first9Avg: number; // moyenne pondérée (par legs joués)
  bestVisit: number;

  bins: Bins;

  rates: Rates;

  co: {
    coAttempts: number;
    coHits: number;
    pctCO: number;
    highestCO: number;
    totalCODarts: number;
    avgCODarts: number;
  };

  minDartsToFinish?: number; // meilleur (plus petit) nombre de flèches pour finir
};

/* -------------------- Utils numériques -------------------- */

const safeDiv = (a: number, b: number) => (b > 0 ? a / b : 0);
const round1 = (v: number) => Math.round(v * 10) / 10;
const round2 = (v: number) => Math.round(v * 100) / 100;

const emptyBins = (): Bins => ({ "60+": 0, "100+": 0, "140+": 0, "180": 0 });

/* -------------------- Détection segments -------------------- */

function isDouble(seg: Segment): boolean {
  if (seg.bed === "DBull") return true;
  return seg.mult === 2;
}
function isTriple(seg: Segment): boolean {
  return seg.mult === 3;
}
function isBull(seg: Segment): boolean {
  return seg.bed === "Bull";
}
function isDBull(seg: Segment): boolean {
  return seg.bed === "DBull";
}

/* -------------------- Aide bins (60+/100+/140+/180) -------------------- */

function addToBins(bins: Bins, visitScore: number, _segments?: Segment[] | null) {
  if (visitScore >= 180) bins["180"] += 1;
  else if (visitScore >= 140) bins["140+"] += 1;
  else if (visitScore >= 100) bins["100+"] += 1;
  else if (visitScore >= 60) bins["60+"] += 1;
}

/* -------------------- Checkout attempts -------------------- */
/**
 * Heuristique simple pour compter les tentatives de checkout :
 * - Si le joueur a <= 170 AVANT la volée (ou <= 130 si tu veux être plus strict),
 *   et ne bust pas, on considère une tentative (coAttempts++).
 * - Si la volée termine la manche (isCheckout), coHits++ et on additionne dartsUsed.
 * - highestCO: maximum (scoreAvant - remainingAfter) sur une volée isCheckout.
 */
function updateCheckoutStats(
  co: CheckoutStats,
  scoreBefore: number,
  visit: Visit,
  startScore: number
) {
  const remainingBefore = scoreBefore;
  const attempted = remainingBefore <= 170;
  if (attempted) co.coAttempts += 1;

  if (visit.isCheckout) {
    co.coHits += 1;
    const used = visit.dartsUsed ?? 3;
    co.totalCODarts += used;
    const checkoutValue = Math.max(0, remainingBefore - visit.remainingAfter);
    if (checkoutValue > co.highestCO) co.highestCO = checkoutValue;
  }

  co.pctCO = round1(safeDiv(co.coHits * 100, Math.max(1, co.coAttempts)));
  co.avgCODarts = round2(safeDiv(co.totalCODarts, Math.max(1, co.coHits)));
}

/* -------------------- Calcul par manche -------------------- */

export function computeLegStats(input: LegInput): LegStats {
  const { startScore, players, visits } = input;
  const legNo = input.legNo ?? 1;

  // État accumulé par joueur
  const byPlayer: Record<PlayerId, PerPlayerLegStats> = {};
  const runningScore: Record<PlayerId, number> = Object.fromEntries(
    players.map((p) => [p, startScore])
  );

  for (const p of players) {
    byPlayer[p] = {
      playerId: p,
      visits: 0,
      darts: 0,
      totalScored: 0,
      bestVisit: 0,
      bins: emptyBins(),
      avgPerDart: 0,
      avgPerVisit: 0,
      first9Avg: 0,
      rates: {
        dblAttempts: 0,
        dblHits: 0,
        pctDB: 0,

        triAttempts: 0,
        triHits: 0,
        pctTP: 0,

        bullAttempts: 0,
        bullHits: 0,
        pctBull: 0,

        dbullAttempts: 0,
        dbullHits: 0,
        pctDBull: 0,
      },
      co: {
        coAttempts: 0,
        coHits: 0,
        pctCO: 0,
        highestCO: 0,
        totalCODarts: 0,
        avgCODarts: 0,
      },
      finished: false,
      dartsToFinish: undefined,
    };
  }

  // Pour First 9 (3 premières volées) on cumule par joueur
  const first9Sum: Record<PlayerId, number> = Object.fromEntries(
    players.map((p) => [p, 0])
  );
  const first9Count: Record<PlayerId, number> = Object.fromEntries(
    players.map((p) => [p, 0])
  );

  // Détection vainqueur et ordre
  let winnerId: PlayerId | null = input.winnerId ?? null;
  const finishOrder: PlayerId[] = [];

  // Parcours dans l'ordre réel des volées
  for (const v of visits) {
    const p = v.playerId;
    const state = byPlayer[p];
    if (!state) continue;

    // Score avant volée
    const scoreBefore = runningScore[p];

    // Nombre de flèches réellement lancées dans la volée
    const dartsThis = v.isCheckout
      ? Math.max(1, Math.min(3, v.dartsUsed ?? 3))
      : v.bust
      ? 3
      : 3;

    // Score de la volée
    const visitScore =
      typeof v.score === "number"
        ? v.score
        : (v.segments ?? []).reduce((a, s) => a + s.score, 0);

    // ----- BUST -----
    if (v.bust) {
      state.visits += 1;
      state.darts += dartsThis;
      if (v.segments && v.segments.length) {
        for (const s of v.segments) {
          if (isDouble(s)) state.rates.dblAttempts += 1;
          if (isTriple(s)) state.rates.triAttempts += 1;
          if (isBull(s)) state.rates.bullAttempts += 1;
          if (isDBull(s)) state.rates.dbullAttempts += 1;
        }
      }
      continue;
    }

    // ----- VOLÉE VALIDE -----
    state.visits += 1;
    state.darts += dartsThis;

    // Mise à jour bins + best
    addToBins(state.bins, visitScore, v.segments);
    if (visitScore > state.bestVisit) state.bestVisit = visitScore;

    // Totaux de score & remaining
    state.totalScored += visitScore;
    runningScore[p] = Math.max(0, runningScore[p] - visitScore);

    // First 9
    if (first9Count[p] < 3) {
      first9Sum[p] += visitScore;
      first9Count[p] += 1;
    }

    // Comptes par type via segments si dispo
    if (v.segments && v.segments.length) {
      for (const s of v.segments) {
        if (isDouble(s)) {
          state.rates.dblAttempts += 1;
          if (v.isCheckout && isDouble(s)) state.rates.dblHits += 1;
        }
        if (isTriple(s)) {
          state.rates.triAttempts += 1;
          state.rates.triHits += 1;
        }
        if (isBull(s)) {
          state.rates.bullAttempts += 1;
          state.rates.bullHits += 1;
        }
        if (isDBull(s)) {
          state.rates.dbullAttempts += 1;
          state.rates.dbullHits += 1;
        }
      }
    }

    // Checkout stats
    updateCheckoutStats(state.co, scoreBefore, v, startScore);

    // Manche terminée ?
    if (v.isCheckout && runningScore[p] === 0 && !state.finished) {
      state.finished = true;
      state.dartsToFinish = state.darts;
      if (!winnerId) winnerId = p;
      if (!finishOrder.includes(p)) finishOrder.push(p);
    }
  }

  // Taux (%)
  for (const p of players) {
    const st = byPlayer[p];

    st.avgPerDart = round2(safeDiv(st.totalScored, Math.max(1, st.darts)));
    st.avgPerVisit = round2(safeDiv(st.totalScored, Math.max(1, st.visits)));

    const f9 = safeDiv(first9Sum[p], Math.max(1, first9Count[p]));
    st.first9Avg = round2(f9);

    st.rates.pctDB = round1(safeDiv(st.rates.dblHits * 100, Math.max(1, st.rates.dblAttempts)));
    st.rates.pctTP = round1(safeDiv(st.rates.triHits * 100, Math.max(1, st.rates.triAttempts)));
    st.rates.pctBull = round1(safeDiv(st.rates.bullHits * 100, Math.max(1, st.rates.bullAttempts)));
    st.rates.pctDBull = round1(safeDiv(st.rates.dbullHits * 100, Math.max(1, st.rates.dbullAttempts)));
  }

  // Classement stable
  const remainingNow: Record<PlayerId, number> = runningScore;
  const order = [...players].sort((a, b) => {
    const fa = finishOrder.includes(a) ? 0 : 1;
    const fb = finishOrder.includes(b) ? 0 : 1;
    if (fa !== fb) return fa - fb;

    const ra = remainingNow[a];
    const rb = remainingNow[b];
    if (ra !== rb) return ra - rb;

    const aa = byPlayer[a].avgPerVisit;
    const ab = byPlayer[b].avgPerVisit;
    if (aa !== ab) return ab - aa;

    return byPlayer[b].bestVisit - byPlayer[a].bestVisit;
  });

  const finishedAt = input.finishedAt ?? null;

  return {
    legNo,
    startScore,
    players,
    finishedAt,
    winnerId: winnerId ?? null,
    order,
    perPlayer: byPlayer,
  };
}

/* -------------------- Agrégation de match -------------------- */

export function aggregateMatch(legs: LegStats[], players: PlayerId[]): MatchStats {
  const agg: Record<PlayerId, PerPlayerMatchAgg> = Object.fromEntries(
    players.map((p) => [
      p,
      {
        playerId: p,
        legsPlayed: 0,
        legsWon: 0,
        darts: 0,
        visits: 0,
        totalScored: 0,
        avgPerDart: 0,
        avgPerVisit: 0,
        first9Avg: 0,
        bestVisit: 0,
        bins: emptyBins(),
        rates: {
          dblAttempts: 0,
          dblHits: 0,
          pctDB: 0,
          triAttempts: 0,
          triHits: 0,
          pctTP: 0,
          bullAttempts: 0,
          bullHits: 0,
          pctBull: 0,
          dbullAttempts: 0,
          dbullHits: 0,
          pctDBull: 0,
        },
        co: {
          coAttempts: 0,
          coHits: 0,
          pctCO: 0,
          highestCO: 0,
          totalCODarts: 0,
          avgCODarts: 0,
        },
        minDartsToFinish: undefined,
      },
    ])
  );

  for (const leg of legs) {
    for (const p of players) {
      const st = leg.perPlayer[p];
      if (!st) continue;
      const a = agg[p];

      a.legsPlayed += 1;
      if (leg.winnerId === p) {
        a.legsWon += 1;
        if (typeof st.dartsToFinish === "number") {
          a.minDartsToFinish =
            typeof a.minDartsToFinish === "number"
              ? Math.min(a.minDartsToFinish, st.dartsToFinish)
              : st.dartsToFinish;
        }
      }

      a.darts += st.darts;
      a.visits += st.visits;
      a.totalScored += st.totalScored;

      a.bestVisit = Math.max(a.bestVisit, st.bestVisit);

      // bins
      a.bins["60+"] += st.bins["60+"];
      a.bins["100+"] += st.bins["100+"];
      a.bins["140+"] += st.bins["140+"];
      a.bins["180"] += st.bins["180"];

      // rates
      a.rates.dblAttempts += st.rates.dblAttempts;
      a.rates.dblHits += st.rates.dblHits;

      a.rates.triAttempts += st.rates.triAttempts;
      a.rates.triHits += st.rates.triHits;

      a.rates.bullAttempts += st.rates.bullAttempts;
      a.rates.bullHits += st.rates.bullHits;

      a.rates.dbullAttempts += st.rates.dbullAttempts;
      a.rates.dbullHits += st.rates.dbullHits;

      // CO
      a.co.coAttempts += st.co.coAttempts;
      a.co.coHits += st.co.coHits;
      a.co.highestCO = Math.max(a.co.highestCO, st.co.highestCO);
      a.co.totalCODarts += st.co.totalCODarts;
    }
  }

  // Ratios agrégés
  for (const p of players) {
    const a = agg[p];
    a.avgPerDart = round2(safeDiv(a.totalScored, Math.max(1, a.darts)));
    a.avgPerVisit = round2(safeDiv(a.totalScored, Math.max(1, a.visits)));

    // First9: moyenne des First9 par leg
    a.first9Avg = round2(
      safeDiv(
        legs.reduce((sum, leg) => sum + (leg.perPlayer[p]?.first9Avg ?? 0), 0),
        Math.max(1, legs.length)
      )
    );

    // %
    a.rates.pctDB = round1(safeDiv(a.rates.dblHits * 100, Math.max(1, a.rates.dblAttempts)));
    a.rates.pctTP = round1(safeDiv(a.rates.triHits * 100, Math.max(1, a.rates.triAttempts)));
    a.rates.pctBull = round1(safeDiv(a.rates.bullHits * 100, Math.max(1, a.rates.bullAttempts)));
    a.rates.pctDBull = round1(safeDiv(a.rates.dbullHits * 100, Math.max(1, a.rates.dbullAttempts)));

    a.co.pctCO = round1(safeDiv(a.co.coHits * 100, Math.max(1, a.co.coAttempts)));
    a.co.avgCODarts = round2(safeDiv(a.co.totalCODarts, Math.max(1, a.co.coHits)));
  }

  return { legs, players, aggregates: agg };
}

/* -------------------- Helpers d’intégration UI -------------------- */

// Raccourcis pour affichage "Stats Darts"
export function formatStatsForTable(st: PerPlayerLegStats | PerPlayerMatchAgg) {
  return {
    avg3: st.avgPerVisit,           // "Moy/3"
    avgDart: st.avgPerDart,         // Moyenne flèche
    first9: st.first9Avg,           // First 9
    best: st.bestVisit,             // Meilleure volée
    bins60: st.bins["60+"],
    bins100: st.bins["100+"],
    bins140: st.bins["140+"],
    bins180: st.bins["180"],
    // Pourcentages (DB / TP / Bull / DBull)
    pctDB: st.rates.pctDB,
    pctTP: st.rates.pctTP,
    pctBull: st.rates.pctBull,
    pctDBull: st.rates.pctDBull,
    // Checkout
    CO: "co" in st ? st.co.coHits : 0, // #CO réussis
    pctCO: "co" in st ? st.co.pctCO : 0,
    dartsCO: "co" in st ? st.co.avgCODarts : 0, // "Darts CO"
    highestCO: "co" in st ? st.co.highestCO : 0,
  };
}

// Classement stable: utilise LegStats.order déjà trié
export function getLeaderboardFromLeg(leg: LegStats): PlayerId[] {
  return leg.order;
}

/* -------------------- Persistance match (ajouté) -------------------- */
// Enregistre le récapitulatif d’un match X01 dans l’historique.
// Utilisé par X01Play.tsx à la fin d’un match.
export function saveMatchStats(match: any) {
  try {
    if (!match?.id) match.id = crypto.randomUUID?.() ?? String(Date.now());
    match.kind = match.kind ?? "x01";
    match.status = "finished";
    match.updatedAt = Date.now();
    History.upsert(match);
    console.log("✅ Match stats sauvegardées :", match);
  } catch (e) {
    console.warn("❌ Erreur lors de saveMatchStats:", e);
  }
}

/* -------------------- Adapters (optionnels) -------------------- */
// export function adaptFromEngine(engineSnapshot: any): LegInput {
//   return { startScore: 501, players: [], visits: [] };
// }
