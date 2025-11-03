// ============================================
// src/lib/statsBridge.ts — "stats de base" unifiées
// - Source 1 : store.statsByPlayer (loadStore)  ← CO & %win OK
// - Source 2 : localStorage (clé dc5:basic-stats) ← compat legacy
// - Source 3 : scan historique (fallback ultime)
// ============================================

import { loadStore } from "./storage";
import { getBasicProfileStats as scanHistoryBasic } from "./stats";

type BasicLine = {
  games: number;        // parties (ou manches) comptées (legacy)
  wins: number;         // gains (legacy)
  legs: number;         // manches (legacy)
  darts: number;        // fléchettes totales (legacy)
  points: number;       // points marqués (estim., legacy)
  bestVisit: number;    // meilleure volée (legacy)
  bestCheckout: number; // meilleur checkout (legacy)
};

export type BasicProfileStats = {
  games: number;
  legs: number;
  wins: number;

  // moyennes
  avg3d: number;        // moyenne / 3D (canon)
  avg3: number;         // alias pour UIs existantes

  // records
  bestVisit: number;
  bestCheckout: number; // CO

  // volumes
  darts: number;        // total fléchettes (pour le “D” de ton ruban)

  // ratios
  winPct: number;       // % victoires (legs prioritaire, sinon games)

  updatedAt: number;
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
function n(x: any, d = 0) {
  const v = Number(x);
  return Number.isFinite(v) ? v : d;
}

/** Retourne les stats d’un profil pour les mini-rubans de la page Profils. */
export async function getBasicProfileStats(playerId: string): Promise<BasicProfileStats> {
  // ---- Source 1 : store.statsByPlayer (live, cumulées par commitMatchSummary)
  try {
    const store = await loadStore().catch(() => null as any);
    const s = store || {};
    const cur = s.statsByPlayer?.[playerId];
    if (cur) {
      const games = n(cur.matches);
      const legs  = n(cur.legs);
      const wins  = n(cur.wins);

      const avg3d = n(cur.avg3);    // on garde l'appellation avg3d côté bridge
      const avg3  = avg3d;          // alias pour anciens UIs

      const bestVisit    = n(cur.bestVisit);
      const bestCheckout = n(cur.bestCheckout);

      const darts = n(cur.darts ?? cur._sumDarts);

      // %win prioritairement par legs (plus pertinent sur X01)
      const winPct =
        legs > 0 ? Math.round((wins / legs) * 1000) / 10
                 : (games > 0 ? Math.round((wins / games) * 1000) / 10 : 0);

      return {
        games, legs, wins,
        avg3d, avg3,
        bestVisit, bestCheckout,
        darts,
        winPct,
        updatedAt: n(cur.updatedAt, Date.now()),
      };
    }
  } catch {
    // on tombera sur les fallbacks
  }

  // ---- Source 2 : localStorage legacy (ta version précédente)
  {
    const s = readStore();
    const line: BasicLine = s[playerId] ?? {
      games: 0, wins: 0, legs: 0, darts: 0, points: 0, bestVisit: 0, bestCheckout: 0,
    };
    const avgPerDart = line.darts > 0 ? line.points / line.darts : 0;
    const avg3d = +(avgPerDart * 3).toFixed(2);
    const avg3  = avg3d;

    const winPct =
      line.legs > 0 ? Math.round((line.wins / line.legs) * 1000) / 10
                    : (line.games > 0 ? Math.round((line.wins / line.games) * 1000) / 10 : 0);

    // Si on a au moins une trace locale, on renvoie ça
    if (line.games || line.legs || line.darts || line.points || line.bestVisit || line.bestCheckout) {
      return {
        games: line.games,
        legs: line.legs,
        wins: line.wins,
        avg3d, avg3,
        bestVisit: line.bestVisit,
        bestCheckout: line.bestCheckout,
        darts: line.darts,
        winPct,
        updatedAt: Date.now(),
      };
    }
  }

  // ---- Source 3 : scan de l’historique (moins riche, CO inconnu)
  const hist = await scanHistoryBasic(playerId);
  return {
    games: hist.games,
    legs: hist.legs,
    wins: hist.wins,
    avg3d: hist.avg3d,
    avg3: hist.avg3d,
    bestVisit: hist.bestVisit,
    bestCheckout: 0,
    darts: 0,
    winPct: hist.legs > 0 ? Math.round((hist.wins / hist.legs) * 1000) / 10 : 0,
    updatedAt: hist.updatedAt,
  };
}

/** Réinitialise tout (utile en debug) */
export function resetBasicStats() {
  writeStore({});
}

/**
 * Fusionne une manche FINIE (Leg) dans les "stats de base" (legacy LS).
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
      // tolère plusieurs clés selon la source
      const darts = n(pp.darts ?? pp.dartsThrown);
      const points = n(pp.points ?? pp.pointsScored);
      const bestV = n(pp.bestVisit);
      const bestCO = n(pp.bestCheckout ?? pp.highestCheckout);

      cur.darts += darts;
      cur.points += points;
      cur.bestVisit = Math.max(cur.bestVisit, bestV);
      cur.bestCheckout = Math.max(cur.bestCheckout, bestCO);
    } else {
      // legacy (reconstruit à partir de fields connus de ton overlay)
      const darts = n(result?.darts?.[pid]);
      const visits = n(result?.visits?.[pid] ?? Math.ceil(darts / 3));
      const avg3 = n(result?.avg3?.[pid]);
      const points = Math.round(avg3 * visits);
      const bestV = n(result?.bestVisit?.[pid]);
      const bestCO = n(result?.bestCheckout?.[pid]);

      cur.darts += darts;
      cur.points += points;
      cur.bestVisit = Math.max(cur.bestVisit, bestV);
      cur.bestCheckout = Math.max(cur.bestCheckout, bestCO);
    }

    store[pid] = cur;
  }

  // On compte la partie gagnée/perdue (legacy : une “manche commitée” = 1 game)
  for (const pid of players) {
    const cur = store[pid];
    cur.games += 1;
    if (winnerId && pid === winnerId) cur.wins += 1;
    store[pid] = cur;
  }

  writeStore(store);
  return true;
}

/** Optionnel : fusionner un match complet pré-agrégé (legacy LS) */
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
    cur.darts += n(match.dartsByPlayer?.[pid]);
    cur.points += n(match.pointsByPlayer?.[pid]);
    cur.bestVisit = Math.max(cur.bestVisit, n(match.bestVisitByPlayer?.[pid]));
    cur.bestCheckout = Math.max(cur.bestCheckout, n(match.bestCheckoutByPlayer?.[pid]));
    store[pid] = cur;
  }

  writeStore(store);
  return true;
}
