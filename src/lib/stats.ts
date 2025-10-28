// ============================================
// src/lib/stats.ts — Minimal Stats Engine (v1)
// - Per-player aggregates across all finished games
// - Safe to call at end of each match/leg
// - LocalStorage-backed (dc5_stats_v1) — easy to swap later
// ============================================

export type PlayerLite = { id: string; name: string };

export type PerPlayerInput = {
  dartsThrown: number;          // total darts thrown in the match
  pointsScored: number;         // total points scored in the match
  visits?: number;              // number of 3-dart visits
  avg3?: number;                // average points per 3 darts (= pointsScored / visits)
  bestVisit?: number;           // best 3-dart score in the match (e.g., 180, 140)
  highestCheckout?: number;     // best checkout value achieved in the match
  tons60?: number;              // count of 60+ visits (60..99)
  tons100?: number;             // 100..139
  tons140?: number;             // 140..179
  ton180?: number;              // 180s
  checkoutAttempts?: number;    // attempts on a finishing double (or out)
  checkoutHits?: number;        // successful finishes in the match
  legsPlayed?: number;          // optional: legs played contributed by this match
  legsWon?: number;             // optional: legs won in this match
};

export type MatchStatsInput = {
  id: string;                   // unique match id (for idempotency if you want later)
  kind: "x01" | "cricket" | string;
  finishedAt: number;           // timestamp (ms)
  players: PlayerLite[];        // roster snapshot
  winnerId?: string | null;     // winner for the match (if applicable)
  perPlayer: Record<string, PerPlayerInput>;
};

export type PlayerStats = {
  player: PlayerLite;

  // Totals
  matches: number;
  wins: number;
  legsPlayed: number;
  legsWon: number;
  dartsThrown: number;
  pointsScored: number;
  visits: number;

  // Rates / averages (derived on read, but we persist running sums)
  avgPerDart: number;           // pointsScored / dartsThrown
  avg3: number;                 // pointsScored / max(1, visits) * 3 normalizer handled
  checkoutAttempts: number;
  checkoutHits: number;
  checkoutPct: number;          // hits/attempts

  // Peaks
  bestVisit: number;            // best 3-dart score ever
  highestCheckout: number;      // best checkout ever

  // Buckets
  tons60: number;
  tons100: number;
  tons140: number;
  ton180: number;

  // Meta
  updatedAt: number;
};

export type StatsStore = {
  version: 1;
  players: Record<string, PlayerStats>;
  lastUpdated: number;
};

const LS_KEY = "dc5_stats_v1";

/* ---------------- Storage ---------------- */

function loadStore(): StatsStore {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return fresh();
    const parsed = JSON.parse(raw) as StatsStore;
    if (parsed?.version !== 1) return fresh();
    return parsed;
  } catch {
    return fresh();
  }
}

function saveStore(store: StatsStore) {
  store.lastUpdated = Date.now();
  localStorage.setItem(LS_KEY, JSON.stringify(store));
}

function fresh(): StatsStore {
  return { version: 1, players: {}, lastUpdated: Date.now() };
}

/* --------------- Helpers ----------------- */

function initPlayerStats(base: PlayerLite): PlayerStats {
  return {
    player: { ...base },

    matches: 0,
    wins: 0,
    legsPlayed: 0,
    legsWon: 0,
    dartsThrown: 0,
    pointsScored: 0,
    visits: 0,

    avgPerDart: 0,
    avg3: 0,
    checkoutAttempts: 0,
    checkoutHits: 0,
    checkoutPct: 0,

    bestVisit: 0,
    highestCheckout: 0,

    tons60: 0,
    tons100: 0,
    tons140: 0,
    ton180: 0,

    updatedAt: Date.now(),
  };
}

function recalcDerived(p: PlayerStats) {
  p.avgPerDart = p.dartsThrown > 0 ? p.pointsScored / p.dartsThrown : 0;
  p.avg3 = p.visits > 0 ? p.pointsScored / p.visits : 0;
  p.checkoutPct = p.checkoutAttempts > 0 ? p.checkoutHits / p.checkoutAttempts : 0;
  p.updatedAt = Date.now();
}

/* --------------- Public API -------------- */

/**
 * Save a finished match into global stats.
 * Call this ONCE per finished match (e.g., at end-of-leg or end-of-match overlay guard).
 */
export function saveMatchStats(input: MatchStatsInput) {
  const store = loadStore();

  // small safety: ensure roster is known
  for (const pl of input.players) {
    if (!store.players[pl.id]) {
      store.players[pl.id] = initPlayerStats(pl);
    } else {
      // keep latest display name
      store.players[pl.id].player.name = pl.name;
    }
  }

  // merge numbers per player
  for (const [pid, delta] of Object.entries(input.perPlayer)) {
    const plLite =
      input.players.find((p) => p.id === pid) ?? { id: pid, name: "?" };
    const agg = store.players[pid] ?? initPlayerStats(plLite);

    agg.matches += 1;
    if (input.winnerId && pid === input.winnerId) agg.wins += 1;

    agg.legsPlayed += delta.legsPlayed ?? 1; // default +1 leg per record if not provided
    agg.legsWon += delta.legsWon ?? (input.winnerId === pid ? 1 : 0);

    agg.dartsThrown += delta.dartsThrown || 0;
    agg.pointsScored += delta.pointsScored || 0;

    agg.visits += delta.visits || 0;

    agg.checkoutAttempts += delta.checkoutAttempts || 0;
    agg.checkoutHits += delta.checkoutHits || 0;

    agg.bestVisit = Math.max(agg.bestVisit, delta.bestVisit || 0);
    agg.highestCheckout = Math.max(agg.highestCheckout, delta.highestCheckout || 0);

    agg.tons60 += delta.tons60 || 0;
    agg.tons100 += delta.tons100 || 0;
    agg.tons140 += delta.tons140 || 0;
    agg.ton180 += delta.ton180 || 0;

    recalcDerived(agg);
    store.players[pid] = agg;
  }

  saveStore(store);
}

/** Get aggregated stats for one player (null if unknown). */
export function getPlayerStats(playerId: string): PlayerStats | null {
  const s = loadStore();
  const p = s.players[playerId];
  return p ? { ...p } : null;
}

/** Convenience for showing on profile medallions. Safe to call often. */
export function getPlayerMedallionStats(playerId: string) {
  const p = getPlayerStats(playerId);
  if (!p) {
    return {
      matches: 0,
      wins: 0,
      winRate: 0,
      avg3: 0,
      bestVisit: 0,
      highestCheckout: 0,
      ton180: 0,
      updatedAt: 0,
    };
  }
  return {
    matches: p.matches,
    wins: p.wins,
    winRate: p.matches > 0 ? p.wins / p.matches : 0,
    avg3: p.avg3,
    bestVisit: p.bestVisit,
    highestCheckout: p.highestCheckout,
    ton180: p.ton180,
    updatedAt: p.updatedAt,
  };
}

/** Simple leaderboard helper (e.g., top averages, most 180s) */
export function getLeaderboard(
  key: keyof PlayerStats,
  limit = 10
): PlayerStats[] {
  const s = loadStore();
  return Object.values(s.players)
    .sort((a, b) => (b[key] as number) - (a[key] as number))
    .slice(0, limit)
    .map((x) => ({ ...x }));
}

/** Nuke (for debugging / settings) */
export function resetAllStats() {
  saveStore(fresh());
}

/* ============ HOW TO INTEGRATE (quick) ============

1) At end of a leg/match (where you already build your overlay result),
   call saveMatchStats() with per-player numbers.

   Example from X01 end-of-leg:

   import { saveMatchStats } from "../lib/stats";

   // suppose you have these from your engine:
   // - players: { id, name }[]
   // - winnerId: string
   // - per-player metrics like dartsThrown, pointsScored, visits, avg3,
   //   bestVisit, highestCheckout, 60+/100+/140+/180, checkoutAttempts/Hits

   saveMatchStats({
     id: result.matchId ?? crypto.randomUUID(),
     kind: "x01",
     finishedAt: Date.now(),
     players,
     winnerId,
     perPlayer: {
       [p1.id]: {
         dartsThrown: engine.stats[p1.id].darts,
         pointsScored: engine.stats[p1.id].scored,
         visits: engine.stats[p1.id].visits,
         avg3: engine.stats[p1.id].avg3,
         bestVisit: engine.stats[p1.id].bestVisit,
         highestCheckout: engine.stats[p1.id].highestCO,
         tons60: engine.stats[p1.id].bins60,
         tons100: engine.stats[p1.id].bins100,
         tons140: engine.stats[p1.id].bins140,
         ton180: engine.stats[p1.id].bins180,
         checkoutAttempts: engine.stats[p1.id].coAttempts,
         checkoutHits: engine.stats[p1.id].coHits,
         legsPlayed: 1,
         legsWon: winnerId === p1.id ? 1 : 0,
       },
       [p2.id]: { ...same shape... },
     },
   });

2) On a Profile card (médaillon), display:
   const m = getPlayerMedallionStats(profile.id);
   // show m.winRate, m.avg3, m.bestVisit, m.highestCheckout, m.ton180, etc.

3) In your Stats page, you can quickly list top 10:
   const topAvg = getLeaderboard("avg3", 10);
   const top180 = getLeaderboard("ton180", 10);

==================================================== */
