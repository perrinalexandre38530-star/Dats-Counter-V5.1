// ============================================
// src/lib/statsLiteIDB.ts — Agrégateur persistant (IndexedDB)
// - AUCUN store global requis
// - DB: "dc-stats", store: "agg", keyPath: "playerId"
// - API principale (à utiliser tel quel) :
//    addMatchSummary({ winnerId, perPlayer })
//    // pour lecture immédiate sans async dans tes composants :
//    getBasicProfileStatsSync(playerId)  ← lit un mini-cache (toujours tenu à jour)
//    // si tu veux une lecture stricte depuis IDB :
//    getBasicProfileStats(playerId) : Promise<BasicProfileStats>
// ============================================

export type BasicProfileStats = {
  games: number;
  darts: number;
  avg3: number;
  bestVisit: number;
  bestCheckout: number;
  wins: number;
  winRate?: number;
};

type Row = {
  playerId: string;
  games: number;
  wins: number;
  darts: number;
  points: number;
  bestVisit: number;
  bestCheckout: number;
  updatedAt: number;
};

const DB_NAME = "dc-stats";
const STORE = "agg";
const CACHE_KEY = "dc-stats-lite-cache-v1"; // mini-cache lecture sync (par joueur)

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "playerId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T = unknown>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  runner: (store: IDBObjectStore) => Promise<T>
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    runner(store)
      .then((res) => {
        t.oncomplete = () => resolve(res);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      })
      .catch(reject);
  });
}

function idbGet(db: IDBDatabase, playerId: string): Promise<Row | undefined> {
  return tx<Row | undefined>(db, "readonly", (store) => {
    return new Promise((resolve, reject) => {
      const r = store.get(playerId);
      r.onsuccess = () => resolve(r.result as Row | undefined);
      r.onerror = () => reject(r.error);
    });
  });
}

function idbPut(db: IDBDatabase, row: Row): Promise<void> {
  return tx<void>(db, "readwrite", (store) => {
    return new Promise((resolve, reject) => {
      const r = store.put(row);
      r.onsuccess = () => resolve();
      r.onerror = () => reject(r.error);
    });
  });
}

/* ---------- Mini-cache synchronisé (lecture instantanée côté UI) ---------- */
type CacheShape = { [playerId: string]: BasicProfileStats };
function loadCache(): CacheShape {
  try {
    const s = localStorage.getItem(CACHE_KEY);
    return s ? (JSON.parse(s) as CacheShape) : {};
  } catch {
    return {};
  }
}
function saveCache(c: CacheShape) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(c));
  } catch {
    // silencieux : le cache est facultatif
  }
}
function toPublic(row: Row | undefined): BasicProfileStats {
  if (!row)
    return { games: 0, darts: 0, avg3: 0, bestVisit: 0, bestCheckout: 0, wins: 0, winRate: 0 };
  const avg3 = row.darts > 0 ? Math.round(((row.points / row.darts) * 3) * 100) / 100 : 0;
  const winRate = row.games > 0 ? Math.round((row.wins / row.games) * 1000) / 10 : 0;
  return {
    games: row.games,
    darts: row.darts,
    avg3,
    bestVisit: row.bestVisit,
    bestCheckout: row.bestCheckout,
    wins: row.wins,
    winRate,
  };
}
function updateCacheFromRow(row: Row) {
  const cache = loadCache();
  cache[row.playerId] = toPublic(row);
  saveCache(cache);
}

/* ----------------------- API publique ----------------------- */

// Écrit/agrège dans IndexedDB (et met à jour le mini-cache)
export async function addMatchSummary(args: {
  winnerId: string | null | undefined;
  perPlayer: Record<
    string,
    { darts: number; points: number; bestVisit?: number; bestCheckout?: number }
  >;
}) {
  const { winnerId, perPlayer } = args || {};
  const db = await openDB();
  const now = Date.now();

  const pids = Object.keys(perPlayer || {});
  for (const pid of pids) {
    const delta = perPlayer[pid] || { darts: 0, points: 0 };
    const prev =
      (await idbGet(db, pid)) || {
        playerId: pid,
        games: 0,
        wins: 0,
        darts: 0,
        points: 0,
        bestVisit: 0,
        bestCheckout: 0,
        updatedAt: 0,
      };

    const next: Row = {
      ...prev,
      games: prev.games + 1,
      wins: prev.wins + (winnerId && pid === winnerId ? 1 : 0),
      darts: prev.darts + Math.max(0, Number(delta.darts || 0)),
      points: prev.points + Math.max(0, Number(delta.points || 0)),
      bestVisit: Math.max(prev.bestVisit, Number(delta.bestVisit || 0)),
      bestCheckout: Math.max(prev.bestCheckout, Number(delta.bestCheckout || 0)),
      updatedAt: now,
    };

    await idbPut(db, next);
    updateCacheFromRow(next); // pour lecture instantanée
  }
}

// Lecture stricte depuis IndexedDB (async)
export async function getBasicProfileStats(playerId: string): Promise<BasicProfileStats> {
  const db = await openDB();
  const row = await idbGet(db, playerId);
  // rafraîchir le cache au passage
  if (row) updateCacheFromRow(row);
  return toPublic(row);
}

// Lecture synchrone depuis le mini-cache (pour tes composants existants)
export function getBasicProfileStatsSync(playerId: string): BasicProfileStats {
  const cache = loadCache();
  return (
    cache[playerId] || {
      games: 0,
      darts: 0,
      avg3: 0,
      bestVisit: 0,
      bestCheckout: 0,
      wins: 0,
      winRate: 0,
    }
  );
}

// Pré-chauffage optionnel si tu veux (au launch app)
export async function warmUpCache(playerIds: string[]) {
  const db = await openDB();
  for (const pid of playerIds) {
    const row = await idbGet(db, pid);
    if (row) updateCacheFromRow(row);
  }
}

// Reset (optionnel)
export async function _resetAll() {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction(STORE, "readwrite");
    const s = t.objectStore(STORE);
    const r = s.clear();
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error);
  });
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {}
}
