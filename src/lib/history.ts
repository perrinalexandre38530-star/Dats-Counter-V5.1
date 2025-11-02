// ============================================
// src/lib/history.ts — Historique compact (localStorage)
// API: list(), get(id), upsert(rec), remove(id), clear()
// ============================================

export type PlayerLite = { id: string; name?: string; avatarDataUrl?: string | null };
export type SavedMatch = {
  id: string;
  kind?: "x01" | "cricket" | string;
  status?: "in_progress" | "finished";
  players?: PlayerLite[];
  winnerId?: string | null;
  createdAt?: number;
  updatedAt?: number;
  // Résumé ultra-léger pour les listes
  summary?: {
    legs?: number;
    darts?: number;
    avg3ByPlayer?: Record<string, number>;
    co?: number; // total checkouts du match
  } | null;
  // payload complet : on essaie de le garder petit; si trop gros on le coupe
  payload?: any;
};

const KEY = "dc-history-v1";
const MAX_ROWS = 300;         // sécurité
const MAX_PAYLOAD_LEN = 60_000; // ~60 Ko, évite les QuotaExceeded

function safeParse<T>(raw: string | null, fb: T): T {
  try { return raw ? (JSON.parse(raw) as T) : fb; } catch { return fb; }
}
function loadAll(): SavedMatch[] {
  return safeParse<SavedMatch[]>(localStorage.getItem(KEY), []);
}
function saveAll(rows: SavedMatch[]) {
  // Couper à MAX_ROWS (les plus récents en tête)
  const trimmed = rows
    .slice()
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
    .slice(0, MAX_ROWS);

  // Dernière barrière anti-quota: si setItem échoue, on coupe encore par 20%
  try {
    localStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch {
    const cut = Math.max(10, Math.floor(trimmed.length * 0.8));
    localStorage.setItem(KEY, JSON.stringify(trimmed.slice(0, cut)));
  }
}

function compactPayload(p: any): any {
  if (!p) return p;
  const s = JSON.stringify(p);
  if (s.length <= MAX_PAYLOAD_LEN) return p;
  // On garde le strict minimum en fallback
  try {
    return {
      ...(p.kind ? { kind: p.kind } : {}),
      ...(p.players ? { players: p.players } : {}),
      ...(p.result ? { result: p.result } : {}),
    };
  } catch {
    return undefined;
  }
}

export const History = {
  list(): SavedMatch[] {
    return loadAll();
  },

  get(id: string): SavedMatch | null {
    return loadAll().find((r) => r.id === id) ?? null;
  },

  upsert(rec: SavedMatch): void {
    if (!rec || !rec.id) return;
    // Normalisation minimale
    const now = Date.now();
    const row: SavedMatch = {
      id: rec.id,
      kind: rec.kind ?? "x01",
      status: rec.status ?? "finished",
      players: Array.isArray(rec.players) ? rec.players : [],
      winnerId: rec.winnerId ?? null,
      createdAt: rec.createdAt ?? now,
      updatedAt: rec.updatedAt ?? now,
      summary: rec.summary ?? null,
      payload: compactPayload(rec.payload),
    };

    const all = loadAll();
    const i = all.findIndex((r) => r.id === row.id);
    if (i >= 0) all[i] = row; else all.unshift(row);
    saveAll(all);
  },

  remove(id: string) {
    saveAll(loadAll().filter((r) => r.id !== id));
  },

  clear() {
    localStorage.removeItem(KEY);
  },
};

export default History;
