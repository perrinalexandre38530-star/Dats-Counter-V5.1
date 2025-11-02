// ============================================
// src/lib/statsBridge.ts — "stats de base" unifiées
// ============================================
type BasicLine = {
  games: number;        // parties jouées
  wins: number;         // parties gagnées
  legs: number;         // manches jouées (compteur)
  darts: number;        // fléchettes totales
  points: number;       // points marqués (estim.)
  bestVisit: number;    // meilleure volée
  bestCheckout: number; // meilleur checkout
};

type BasicStore = Record<string, BasicLine>; // key = playerId

const KEY = "dc5:basic-stats";

function readStore(): BasicStore {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}
function writeStore(s: BasicStore) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
}

/** Retourne la ligne de stats d’un joueur (avec défauts) */
export function getBasicProfileStats(playerId: string) {
  const s = readStore();
  const line: BasicLine = s[playerId] ?? {
    games: 0, wins: 0, legs: 0, darts: 0, points: 0, bestVisit: 0, bestCheckout: 0,
  };

  const avgPerDart = line.darts > 0 ? line.points / line.darts : 0;
  const avg3 = avgPerDart * 3;
  const winRate = line.games > 0 ? (line.wins / line.games) * 100 : 0;

  return {
    raw: line,
    avg3: Number(avg3.toFixed(2)),
    winRate: Number(winRate.toFixed(0)),
    bestVisit: line.bestVisit,
    bestCheckout: line.bestCheckout,
    legs: line.legs,
    games: line.games,
  };
}

/** Réinitialise tout (utile en debug) */
export function resetBasicStats() {
  writeStore({});
}

/**
 * Fusionne une manche FINIE (Leg) dans les "stats de base".
 * Accepte au choix :
 *  - un objet "legacy" { winnerId, darts, avg3, bestVisit, bestCheckout, ... }
 *  - un objet riche { perPlayer, winnerId, players, ... } (statsOnce/computeLegStats)
 */
export function mergeLegToBasics(result: any) {
  const store = readStore();

  // ---- détecte le format
  const isRich = !!result?.perPlayer && !!result?.players;
  const players: string[] = isRich
    ? (result.players || []).map((p: any) => p.id || p)
    : Object.keys(result?.darts || {});

  // winner
  const winnerId: string | null = result?.winnerId ?? null;

  for (const pid of players) {
    const cur: BasicLine = store[pid] ?? {
      games: 0, wins: 0, legs: 0, darts: 0, points: 0, bestVisit: 0, bestCheckout: 0,
    };

    // incrément manche
    cur.legs += 1;

    if (isRich) {
      const pp = result.perPlayer?.[pid] || {};
      cur.darts += Number(pp.dartsThrown || 0);
      cur.points += Number(pp.pointsScored || 0);
      cur.bestVisit = Math.max(cur.bestVisit, Number(pp.bestVisit || 0));
      cur.bestCheckout = Math.max(cur.bestCheckout, Number(pp.highestCheckout || 0));
    } else {
      // legacy (reconstruit à partir de fields connus de ton overlay)
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

  // On compte la partie gagnée/perdue quand on détecte la dernière manche
  // Ici: on considère chaque "manche commitée" comme une "game".
  // Si tu veux: appelle mergeMatchToBasics pour le match complet.
  for (const pid of players) {
    const cur = store[pid];
    cur.games += 1;
    if (winnerId && pid === winnerId) cur.wins += 1;
    store[pid] = cur;
  }

  writeStore(store);
  return true;
}

/** Optionnel : fusionner un match complet pré-agrégé */
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
