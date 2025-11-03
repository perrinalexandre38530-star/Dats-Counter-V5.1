// ============================================
// src/lib/playerStats.ts
// - buildX01Summary : normalise un résumé par joueur
// - commitMatchSummary : cumule dans store.statsByPlayer
//   (via loadStore/saveStore) pour lecture immédiate par StatsHub
// ============================================

import { loadStore, saveStore } from "./storage";

type PerPlayerInput = {
  playerId: string;
  name: string;

  // fondamentaux
  avg3: number;               // moyenne / 3 darts (ex: 45.33)
  bestVisit: number;          // meilleure volée
  bestCheckout: number;       // plus haut checkout
  darts: number;              // nb fléchettes
  win: boolean;               // a gagné la manche / match

  // optionnels (si computeLegStats les expose, on les prend)
  points?: number;            // points réellement scorés (précis)
  visits?: number;            // nb de visites (volées)

  buckets?: Record<string, number>; // "180","140+","100+","60-99","0-59"...
};

export type X01Summary = {
  kind: "x01";
  winnerId: string | null;
  players: Record<
    string,
    {
      id: string;
      name: string;

      // exposés
      avg3: number;
      bestVisit: number;
      bestCheckout: number;
      darts: number;
      win: boolean;
      buckets?: Record<string, number>;

      // méta
      updatedAt: number;
      matches: number;
      legs: number;

      // internes pour pondérer / reconstituer
      _sumPoints: number; // somme des points
      _sumDarts: number;  // somme des darts
      // facultatifs (utiles pour d'autres écrans)
      _sumVisits?: number;
    }
  >;
  updatedAt: number;
};

/** clamp safe number */
function n(x: any, def = 0): number {
  const v = Number(x);
  return Number.isFinite(v) ? v : def;
}

/** Fabrique un summary "plat" et stable à partir des inputs par joueur. */
export function buildX01Summary(opts: {
  kind: "x01";
  winnerId: string | null;
  perPlayer: PerPlayerInput[];
}): X01Summary {
  const now = Date.now();
  const players: X01Summary["players"] = {};

  for (const p of opts.perPlayer) {
    const darts = Math.max(0, n(p.darts));
    const visits = Math.max(0, n(p.visits));
    const pointsIn = n(p.points, NaN);

    // Si on a les points exacts, on les utilise.
    // Sinon on les approx à partir de avg3 (/3) * darts
    const points =
      Number.isFinite(pointsIn) ? pointsIn : Math.max(0, (n(p.avg3) / 3) * darts);

    // Si darts==0 mais visits>0 (et pas de darts fournis), on estime darts=visits*3
    const dartsEff = darts > 0 ? darts : (visits > 0 ? visits * 3 : 0);

    players[p.playerId] = {
      id: p.playerId,
      name: p.name,
      avg3: n(p.avg3),
      bestVisit: n(p.bestVisit),
      bestCheckout: n(p.bestCheckout),
      darts: dartsEff,
      win: !!p.win,
      buckets: p.buckets && Object.keys(p.buckets).length ? p.buckets : undefined,

      updatedAt: now,
      matches: 1,
      legs: 1,

      _sumPoints: points,
      _sumDarts: dartsEff,
      _sumVisits: visits || undefined,
    };
  }

  return { kind: "x01", winnerId: opts.winnerId ?? null, players, updatedAt: now };
}

/**
 * Cumule le summary dans store.statsByPlayer (persistance via storage.ts).
 * - pondère avg3 par le nb de darts cumulés (ou visits*3 estimés si besoin)
 * - conserve les meilleurs records (bestVisit / bestCheckout)
 * - incrémente matches/legs et wins
 * - additionne les buckets
 */
export async function commitMatchSummary(summary: X01Summary): Promise<void> {
  const store = await loadStore().catch(() => null as any);
  const s = store || {};
  if (!s.statsByPlayer) s.statsByPlayer = {};

  for (const pid of Object.keys(summary.players)) {
    const src = summary.players[pid];

    const cur = s.statsByPlayer[pid] || {
      id: pid,
      name: src.name,

      // cumul visibles
      matches: 0,
      legs: 0,
      wins: 0,
      bestVisit: 0,
      bestCheckout: 0,
      avg3: 0,
      darts: 0,

      // internes
      _sumPoints: 0,
      _sumDarts: 0,
      _sumVisits: 0,

      // buckets
      buckets: {} as Record<string, number>,
      updatedAt: 0,
    };

    // cumuls de compteurs
    cur.matches += 1;
    cur.legs += 1;
    if (src.win) cur.wins += 1;

    // records
    cur.bestVisit = Math.max(n(cur.bestVisit), n(src.bestVisit));
    cur.bestCheckout = Math.max(n(cur.bestCheckout), n(src.bestCheckout));

    // agrégats pondération
    cur._sumPoints += n(src._sumPoints);
    cur._sumDarts += n(src._sumDarts);
    if (src._sumVisits) cur._sumVisits += n(src._sumVisits);

    // mets à jour l’exposé
    cur.darts = cur._sumDarts;

    // moyenne pondérée (fallback si _sumDarts==0 mais _sumVisits>0)
    const denom =
      cur._sumDarts > 0 ? cur._sumDarts :
      (cur._sumVisits > 0 ? cur._sumVisits * 3 : 0);

    cur.avg3 = denom > 0 ? (cur._sumPoints / denom) * 3 : 0;

    // merge buckets
    if (src.buckets) {
      for (const k of Object.keys(src.buckets)) {
        cur.buckets[k] = (cur.buckets[k] || 0) + n(src.buckets[k]);
      }
    }

    cur.updatedAt = summary.updatedAt;
    cur.name = src.name || cur.name;

    s.statsByPlayer[pid] = cur;
  }

  await saveStore(s);

  // Ping UI
  try {
    localStorage.setItem("__stats_dirty", String(Date.now()));
  } catch {}
}
