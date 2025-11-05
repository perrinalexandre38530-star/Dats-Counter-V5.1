// ============================================
// src/lib/history.ts — Historique compact (localStorage)
// API: list(), get(id), upsert(rec), remove(id), clear()
// ============================================

export type PlayerLite = {
  id: string;
  name?: string;
  avatarDataUrl?: string | null;
};

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
const MAX_ROWS = 300;          // sécurité
const MAX_PAYLOAD_LEN = 60_000; // ~60 Ko, évite les QuotaExceeded

/* ------------------------------------------
   Helpers internes
------------------------------------------ */
function safeParse<T>(raw: string | null, fb: T): T {
  try {
    return raw ? (JSON.parse(raw) as T) : fb;
  } catch {
    return fb;
  }
}

function loadAll(): SavedMatch[] {
  return safeParse<SavedMatch[]>(localStorage.getItem(KEY), []);
}

function saveAll(rows: SavedMatch[]) {
  // tri décroissant (les plus récents d'abord)
  const sorted = rows
    .slice()
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
    .slice(0, MAX_ROWS);

  try {
    localStorage.setItem(KEY, JSON.stringify(sorted));
  } catch {
    // En cas de quota dépassé, on coupe à 80%
    const cut = Math.max(10, Math.floor(sorted.length * 0.8));
    localStorage.setItem(KEY, JSON.stringify(sorted.slice(0, cut)));
  }
}

function compactPayload(p: any): any {
  if (!p) return p;
  const s = JSON.stringify(p);
  if (s.length <= MAX_PAYLOAD_LEN) return p;
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

/* ------------------------------------------
   API publique
------------------------------------------ */
export const History = {
  list(): SavedMatch[] {
    return loadAll();
  },

  get(id: string): SavedMatch | null {
    return loadAll().find((r) => r.id === id) ?? null;
  },

  upsert(rec: SavedMatch): void {
    if (!rec || !rec.id) return;

    const now = Date.now();
    const row: SavedMatch = {
      id: rec.id,
      kind: rec.kind ?? "x01",
      status: rec.status ?? "finished", // ✅ garantit affichage dans “Terminées”
      players: Array.isArray(rec.players) ? rec.players : [],
      winnerId: rec.winnerId ?? null,
      createdAt: rec.createdAt ?? now,
      updatedAt: now, // ✅ forçage de date récente
      summary: rec.summary ?? null,
      payload: compactPayload(rec.payload),
    };

    const all = loadAll();
    const existingIndex = all.findIndex((r) => r.id === row.id);

    if (existingIndex >= 0) {
      // ✅ met à jour la partie existante (même id)
      all[existingIndex] = row;
    } else {
      // ✅ ajoute une nouvelle partie sans écraser les précédentes
      all.unshift(row);
    }

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
