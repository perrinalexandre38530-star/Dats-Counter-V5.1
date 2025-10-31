// ============================================
// src/lib/statsBridge.ts — pont Stats unifiées
// - getBasicProfileStats(pid)
// - mergeLegToBasics(legStats | legacy)
// ============================================

export type BasicProfileStats = {
  avg3: number;           // moyenne /3 cumulée (pondérée par visites)
  bestVisit: number;
  highestCheckout: number;
  legsPlayed: number;
  legsWon: number;
  // interne pour pondérer avg3
  _sumVisits?: number;
  _sumAvg3xVisits?: number;
};

const KEY = "dc-stats-basics-v1";

type MapByPid = Record<string, BasicProfileStats>;

function loadMap(): MapByPid {
  try {
    const raw = localStorage.getItem(KEY);
    const m = raw ? JSON.parse(raw) : {};
    return m && typeof m === "object" ? m : {};
  } catch {
    return {};
  }
}
function saveMap(m: MapByPid) {
  localStorage.setItem(KEY, JSON.stringify(m));
}

export async function getBasicProfileStats(pid: string): Promise<BasicProfileStats> {
  const m = loadMap();
  return m[pid] ?? { avg3: 0, bestVisit: 0, highestCheckout: 0, legsPlayed: 0, legsWon: 0 };
}

/** Accepte un LegStats *ou* un LegacyLegResult */
export function mergeLegToBasics(leg: any) {
  const m = loadMap();

  const isNew = !!(leg?.perPlayer && leg?.players && Array.isArray(leg.players));
  const players: string[] = isNew ? leg.players : Object.keys(leg?.darts ?? {});
  const winnerId: string | null =
    isNew ? (leg.winnerId ?? null) : (leg.winnerId ?? null);

  for (const pid of players) {
    const cur = m[pid] ?? {
      avg3: 0,
      bestVisit: 0,
      highestCheckout: 0,
      legsPlayed: 0,
      legsWon: 0,
      _sumVisits: 0,
      _sumAvg3xVisits: 0,
    };

    // ——— extraire mesures pour ce joueur selon le schéma
    let visits = 0;
    let avg3 = 0;
    let best = 0;
    let highestCO = 0;

    if (isNew) {
      const row = leg.perPlayer?.[pid];
      visits = row?.visits ?? 0;
      avg3 = row?.avg3 ?? 0;
      best = row?.best ?? 0;
      highestCO = row?.co?.highestCO ?? 0;
    } else {
      visits = leg.visits?.[pid] ?? 0;
      avg3 = leg.avg3?.[pid] ?? 0;
      best = (leg.bestVisit?.[pid] ?? 0) as number;
      highestCO = (leg.bestCheckout?.[pid] ?? 0) as number;
    }

    // ——— cumul pondéré pour avg3
    const sumV = (cur._sumVisits ?? 0) + (visits || 0);
    const sumAxV = (cur._sumAvg3xVisits ?? 0) + (avg3 || 0) * (visits || 0);
    const newAvg3 = sumV > 0 ? sumAxV / sumV : cur.avg3;

    m[pid] = {
      avg3: newAvg3 || 0,
      bestVisit: Math.max(cur.bestVisit || 0, best || 0),
      highestCheckout: Math.max(cur.highestCheckout || 0, highestCO || 0),
      legsPlayed: (cur.legsPlayed || 0) + 1,
      legsWon: (cur.legsWon || 0) + (winnerId && winnerId === pid ? 1 : 0),
      _sumVisits: sumV,
      _sumAvg3xVisits: sumAxV,
    };
  }

  saveMap(m);
}