// ============================================
// src/lib/statsBridge.ts — "stats de base" unifiées (single source of truth)
// - getBasicProfileStats(pid) -> { avg3, winRate, bestVisit, bestCheckout, legs, games, wins }
// - mergeLegToBasics/mergeMatchToBasics keep working (optional light cache)
// - Falls back to stats.ts (avg3d, wins/legs...) so all screens show same values
// ============================================

type BasicLine = {
  games: number;        // parties jouées
  wins: number;         // victoires
  legs: number;         // manches jouées
  darts: number;        // fléchettes totales
  points: number;       // points marqués (estim.)
  bestVisit: number;    // meilleure volée
  bestCheckout: number; // meilleur checkout
};

export type BasicProfileStats = {
  avg3: number;         // moyenne par 3 darts
  winRate: number;      // % de victoires (0..100)
  bestVisit: number;
  bestCheckout: number;
  legs: number;
  games: number;
  wins: number;
};

type BasicStore = Record<string, BasicLine>; // key = playerId
const KEY = "dc5:basic-stats";

/* ---------------- Local cache ---------------- */
function readStore(): BasicStore {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch { return {}; }
}
function writeStore(s: BasicStore) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
}
export function resetBasicStats() { writeStore({}); }

/* --------------- Fallback to stats.ts --------------- */
async function loadStatsTs(pid: string): Promise<Partial<BasicProfileStats> & { wins?: number; legs?: number; games?: number }> {
  try {
    // lazy import to avoid cycles if any
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const mod = await import("./stats");
    if (typeof mod.getBasicProfileStats !== "function") return {};
    const s = await mod.getBasicProfileStats(pid);
    // s can be {games, legs, wins, avg3d, bestVisit, ...}
    const avg3 = Number.isFinite(s?.avg3d) ? Number(s.avg3d) : Number(s?.avg3 ?? 0);
    const games = Number(s?.games ?? 0);
    const legs  = Number(s?.legs ?? 0);
    const wins  = Number(s?.wins ?? 0);
    const winRate = games > 0 ? (wins / games) * 100 : (legs > 0 ? (wins / legs) * 100 : 0);
    return {
      avg3,
      winRate,
      bestVisit: Number(s?.bestVisit ?? 0),
      bestCheckout: Number((s as any)?.bestCheckout ?? 0),
      legs, games, wins,
    };
  } catch {
    return {};
  }
}

/* ---------------- Public unified getter ---------------- */
export async function getBasicProfileStats(playerId: string): Promise<BasicProfileStats> {
  const s = readStore();
  const line: BasicLine | undefined = s[playerId];

  // Start with local cache if present
  let avg3 = 0, winRate = 0, bestVisit = 0, bestCheckout = 0, legs = 0, games = 0, wins = 0;

  if (line) {
    const avgPerDart = line.darts > 0 ? line.points / line.darts : 0;
    avg3 = avgPerDart * 3;
    games = line.games;
    wins = line.wins;
    legs = line.legs;
    bestVisit = line.bestVisit || 0;
    bestCheckout = line.bestCheckout || 0;
    winRate = games > 0 ? (wins / games) * 100 : 0;
  }

  // Merge fallback from stats.ts (fills holes and stays consistent)
  const fb = await loadStatsTs(playerId);
  avg3 = Number.isFinite(fb.avg3!) && fb.avg3! > avg3 ? fb.avg3! : avg3;
  bestVisit = Math.max(bestVisit, Number(fb.bestVisit ?? 0));
  bestCheckout = Math.max(bestCheckout, Number(fb.bestCheckout ?? 0));
  legs  = Math.max(legs, Number(fb.legs ?? 0));
  games = Math.max(games, Number(fb.games ?? 0));
  wins  = Math.max(wins, Number(fb.wins ?? 0));
  if ((fb.winRate ?? 0) > 0) winRate = fb.winRate!;

  return {
    avg3: +avg3.toFixed(2),
    winRate: Math.round(winRate),
    bestVisit,
    bestCheckout,
    legs,
    games,
    wins,
  };
}

/* ----------------- Updaters (optional) ----------------- */
/** Accepte soit un objet "rich" (perPlayer...), soit un ancien format. */
export function mergeLegToBasics(result: any) {
  const store = readStore();

  const isRich = !!result?.perPlayer && !!result?.players;
  const players: string[] = isRich
    ? (result.players || []).map((p: any) => p.id || p)
    : Object.keys(result?.darts || {});

  const winnerId: string | null = result?.winnerId ?? null;

  for (const pid of players) {
    const cur: BasicLine = store[pid] ?? {
      games: 0, wins: 0, legs: 0, darts: 0, points: 0, bestVisit: 0, bestCheckout: 0,
    };

    cur.legs += 1;

    if (isRich) {
      const pp = result.perPlayer?.[pid] || {};
      cur.darts += Number(pp.dartsThrown ?? pp.darts ?? 0);
      cur.points += Number(pp.pointsScored ?? pp.points ?? 0);
      cur.bestVisit = Math.max(cur.bestVisit, Number(pp.bestVisit || 0));
      cur.bestCheckout = Math.max(cur.bestCheckout, Number(pp.highestCheckout || 0));
    } else {
      const darts = Number(result?.darts?.[pid] || 0);
      const visits = Number(result?.visits?.[pid] || Math.ceil(darts / 3));
      const avg3 = Number(result?.avg3?.[pid] || 0);
      const points = Math.round(avg3 * visits);
      const bestV = Number(result?.bestVisit?.[pid] || 0);
      const bestCO = Number(result?.bestCheckout?.[pid] || 0);

      cur.darts += darts;
      cur.points += points;
      cur.bestVisit = Math.max(cur.bestVisit, bestV);
      cur.bestCheckout = Math.max(cur.bestCheckout, bestCO);
    }

    store[pid] = cur;
  }

  // chaque manche commitée compte comme une "game"
  for (const pid of players) {
    const cur = store[pid];
    cur.games += 1;
    if (winnerId && pid === winnerId) cur.wins += 1;
    store[pid] = cur;
  }

  writeStore(store);
  return true;
}

export function mergeMatchToBasics(match: {
  players: string[]; winnerId?: string | null;
  dartsByPlayer?: Record<string, number>;
  pointsByPlayer?: Record<string, number>;
  bestVisitByPlayer?: Record<string, number>;
  bestCheckoutByPlayer?: Record<string, number>;
}) {
  const store = readStore();
  for (const pid of match.players) {
    const cur: BasicLine = store[pid] ?? {
      games: 0, wins: 0, legs: 0, darts: 0, points: 0, bestVisit: 0, bestCheckout: 0,
    };
    cur.games += 1;
    if (match.winnerId && pid === match.winnerId) cur.wins += 1;
    cur.darts += Number(match.dartsByPlayer?.[pid] || 0);
    cur.points += Number(match.pointsByPlayer?.[pid] || 0);
    cur.bestVisit = Math.max(cur.bestVisit, Number(match.bestVisitByPlayer?.[pid] || 0));
    cur.bestCheckout = Math.max(cur.bestCheckout, Number(match.bestCheckoutByPlayer?.[pid] || 0));
    store[pid] = cur;
  }
  writeStore(store);
  return true;
}
