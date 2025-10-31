// ============================================
// src/lib/history.ts — Historique simple (LocalStorage)
// API: History.upsert(rec), History.listAll(), History.clear()
// ============================================

export type SavedMatch = {
  id: string;                    // id unique (ex: legId ou matchId)
  kind: "x01" | "cricket" | string;
  status: "in_progress" | "finished";
  players: { id: string; name: string }[];
  winnerId?: string | null;
  updatedAt: number;             // timestamp (ms)
  payload?: any;                 // LegStats / LegacyLegResult / etc.
};

const KEY = "dc-history-v1";

function loadAll(): SavedMatch[] {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveAll(list: SavedMatch[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

export const History = {
  upsert(rec: SavedMatch) {
    const list = loadAll();
    const i = list.findIndex((r) => r.id === rec.id);
    if (i >= 0) list[i] = rec;
    else list.unshift(rec); // récent en haut
    saveAll(list);
  },

  listAll(): SavedMatch[] {
    return loadAll().sort((a, b) => b.updatedAt - a.updatedAt);
  },

  clear() {
    saveAll([]);
  },
};