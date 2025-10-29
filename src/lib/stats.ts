// ============================================
// src/lib/stats.ts  —  Store de stats globales (défensif)
// ============================================

const LS_KEY = "dc5_stats_v1";

type PerPlayerAgg = {
  dartsThrown: number;
  pointsScored: number;
  visits: number;
  avg3: number;            // moyenne par volée (affichée “Moy/3”)
  bestVisit: number;
  highestCheckout: number;
  tons60: number;
  tons100: number;
  tons140: number;
  ton180: number;
  checkoutAttempts: number;
  checkoutHits: number;
  legsPlayed: number;
  legsWon: number;
};

type StatsStore = {
  // par joueur
  perPlayer: Record<string, PerPlayerAgg>;
  // totaux, si besoin plus tard
  lastUpdatedAt: number;
};

function emptyAgg(): PerPlayerAgg {
  return {
    dartsThrown: 0,
    pointsScored: 0,
    visits: 0,
    avg3: 0,
    bestVisit: 0,
    highestCheckout: 0,
    tons60: 0,
    tons100: 0,
    tons140: 0,
    ton180: 0,
    checkoutAttempts: 0,
    checkoutHits: 0,
    legsPlayed: 0,
    legsWon: 0,
  };
}

function emptyStore(): StatsStore {
  return { perPlayer: {}, lastUpdatedAt: 0 };
}

function safeParse(json: string | null): StatsStore {
  if (!json) return emptyStore();
  try {
    const obj = JSON.parse(json);
    // garde-fous forts (anti-null/undefined)
    if (!obj || typeof obj !== "object") return emptyStore();
    const perPlayer: Record<string, PerPlayerAgg> = {};
    const src = (obj as any).perPlayer || {};
    if (src && typeof src === "object") {
      for (const pid of Object.keys(src)) {
        const a = src[pid] || {};
        perPlayer[pid] = {
          ...emptyAgg(),
          ...a,
        };
      }
    }
    return {
      perPlayer,
      lastUpdatedAt: Number((obj as any).lastUpdatedAt) || 0,
    };
  } catch {
    // JSON corrompu
    return emptyStore();
  }
}

function load(): StatsStore {
  try {
    return safeParse(localStorage.getItem(LS_KEY));
  } catch {
    return emptyStore();
  }
}

function save(s: StatsStore) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(s));
  } catch {
    // quota plein -> on ignore silencieusement
  }
}

// ============================================
// API publique
// ============================================

/** Merge d’un enregistrement (par joueur) dans le store. */
export function saveMatchStats(rec: {
  id: string;                // match id
  createdAt: number;
  rules?: any;
  players: string[];         // ids
  standing?: any;
  winnerId?: string | null;
  sets?: any[];
  perPlayerHitBuckets?: any; // non utilisé ici mais conservé si besoin
  // — pour compat (on merge juste perPlayer)
  perPlayer?: Record<string, Partial<PerPlayerAgg>>;
}) {
  const store = load();
  const src = rec.perPlayer || {};
  for (const pid of Object.keys(src || {})) {
    const prev = store.perPlayer[pid] ?? emptyAgg();
    const add = src[pid] || {};
    const merged: PerPlayerAgg = { ...prev };

    // cumul additif sur tous les compteurs
    merged.dartsThrown += Number(add.dartsThrown || 0);
    merged.pointsScored += Number(add.pointsScored || 0);
    merged.visits += Number(add.visits || 0);
    merged.bestVisit = Math.max(prev.bestVisit, Number(add.bestVisit || 0));
    merged.highestCheckout = Math.max(prev.highestCheckout, Number(add.highestCheckout || 0));
    merged.tons60 += Number(add.tons60 || 0);
    merged.tons100 += Number(add.tons100 || 0);
    merged.tons140 += Number(add.tons140 || 0);
    merged.ton180 += Number(add.ton180 || 0);
    merged.checkoutAttempts += Number(add.checkoutAttempts || 0);
    merged.checkoutHits += Number(add.checkoutHits || 0);
    merged.legsPlayed += Number(add.legsPlayed || 0);
    merged.legsWon += Number(add.legsWon || 0);

    // avg3 recalculée à partir des points cumulés / visites cumulées
    merged.avg3 =
      merged.visits > 0 ? Math.round((merged.pointsScored / merged.visits) * 100) / 100 : 0;

    store.perPlayer[pid] = merged;
  }
  store.lastUpdatedAt = Date.now();
  save(store);
}

/** Résumé “médaillon” ultraléger pour un joueur. */
export function getPlayerMedallionStats(playerId: string) {
  const s = load();
  const a = s.perPlayer[playerId] ?? emptyAgg();

  const winRate =
    a.legsPlayed > 0 ? Math.max(0, Math.min(1, a.legsWon / a.legsPlayed)) : 0;

  return {
    winRate,
    avg3: a.avg3 || 0,
    bestVisit: a.bestVisit || 0,
    highestCheckout: a.highestCheckout || 0,
    ton180: a.ton180 || 0,
  };
}

/** Classement simple par Avg3 (ou autre critère si besoin). */
export function getLeaderboard(by: "avg3" | "bestVisit" = "avg3") {
  const s = load();
  const rows = Object.keys(s.perPlayer).map((pid) => ({
    playerId: pid,
    ...s.perPlayer[pid],
  }));
  rows.sort((a, b) => (b[by] || 0) - (a[by] || 0));
  return rows;
}

/** Hard reset des stats (utile en debug). */
export function clearAllStats() {
  try {
    localStorage.removeItem(LS_KEY);
  } catch {}
}
